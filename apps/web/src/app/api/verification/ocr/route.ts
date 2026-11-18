import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { MAX_UPLOAD_BYTES, isPrivateCredentialKey, sniffContentType } from "@utn/shared";
import { headStorageObject, readStorageObject } from "@utn/storage";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_OCR_CHARACTERS = 20_000;
const OCR_ACCEPTED_TYPES = new Set<string>(["application/pdf", "image/jpeg", "image/png"]);

/**
 * Per-instance concurrency cap. Tesseract spawns a WASM worker per request;
 * without a ceiling a single account could exhaust CPU and memory. The
 * distributed rate limit above caps the same account across instances.
 */
const OCR_CONCURRENCY_LIMIT = 2;
let activeOcrJobs = 0;

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

/**
 * Draft certificates are OCR'd before finalization, so `candidate_media` may
 * not exist yet. Upsert keys the result to the candidate; finalize later fills
 * in the certificate/video keys without clearing the extracted text.
 */
async function persistOcrText(
  admin: AdminClient,
  userId: string,
  text: string | null,
  certificateR2Key?: string | null,
): Promise<void> {
  const payload: Record<string, unknown> = { candidate_id: userId, ocr_extracted_text: text };
  if (certificateR2Key) payload.certificate_r2_key = certificateR2Key;
  const { error } = await admin
    .from("candidate_media")
    .upsert(payload, { onConflict: "candidate_id" });

  if (error) throw error;
}

function cleanOcrText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_OCR_CHARACTERS);
}

function looksLikePdf(contentType: string | null, key: string): boolean {
  return (contentType ?? "").toLowerCase().includes("pdf") || key.toLowerCase().endsWith(".pdf");
}

export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.ocr });
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "candidate") {
    return apiError(403, "candidate_only", "Only candidates can extract their document text.");
  }

  const userId = auth.caller.userId;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  // The studio OCRs a certificate before it is finalized, so accept the freshly
  // uploaded key. The legacy path (stored media) still works for resubmissions.
  let requestedKey: string | null = null;
  try {
    const body = (await request.json()) as { certificateR2Key?: unknown };
    if (typeof body.certificateR2Key === "string" && body.certificateR2Key.trim()) {
      requestedKey = body.certificateR2Key.trim();
    }
  } catch {
    // No body is a valid request: fall back to the stored certificate.
  }

  if (requestedKey && !isPrivateCredentialKey(requestedKey, userId)) {
    return apiError(400, "invalid_certificate_key", "The certificate key is not yours.");
  }

  if (activeOcrJobs >= OCR_CONCURRENCY_LIMIT) {
    return apiError(
      429,
      "ocr_busy",
      "Automatic reading is busy right now. Try again in a moment.",
      undefined,
      { "Retry-After": "15" },
    );
  }

  activeOcrJobs += 1;
  try {
    const { data: candidate, error: candidateError } = await admin
      .from("candidate_profiles")
      .select("verification_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return apiError(403, "candidate_profile_missing", "Complete your profile first.");
    }
    if (candidate.verification_status === "verified") {
      return apiError(409, "already_verified", "Your certificate is already approved.");
    }

    const { data: media, error: mediaError } = await admin
      .from("candidate_media")
      .select("certificate_r2_key")
      .eq("candidate_id", userId)
      .maybeSingle();

    if (mediaError) throw mediaError;

    let key = requestedKey ?? (media?.certificate_r2_key ? String(media.certificate_r2_key) : null);

    if (!key) {
      return apiError(400, "certificate_missing", "Upload your certificate first.");
    }

    if (requestedKey) {
      const head = await headStorageObject({ bucket: "private-credentials", key });
      if (!head) {
        return apiError(400, "certificate_missing", "The certificate upload did not complete.");
      }
      if (looksLikePdf(head.contentType, key)) {
        return NextResponse.json({
          status: "skipped",
          reason: "pdf",
          message:
            "PDF received. Automatic text extraction runs on images; an admin will review this document manually.",
        });
      }
    }

    const object = await readStorageObject({ bucket: "private-credentials", key });

    if (object.bytes.byteLength > MAX_UPLOAD_BYTES["private-credentials"]) {
      return apiError(
        413,
        "certificate_too_large",
        "The certificate exceeds the 10 MB upload limit.",
      );
    }

    // Validate the bytes themselves, not the declared upload type, before the
    // buffer reaches the WASM worker.
    const detected = sniffContentType(object.bytes);
    if (!detected || !OCR_ACCEPTED_TYPES.has(detected)) {
      return apiError(415, "unsupported_document", "Upload a PDF, JPEG, or PNG certificate.");
    }

    // OCR only works on raster images. PDFs stay available for manual admin
    // review; we never imply that an unreadable document was checked.
    if (detected === "application/pdf") {
      await persistOcrText(admin, userId, null, requestedKey);

      return NextResponse.json({
        status: "skipped",
        reason: "pdf",
        message:
          "PDF received. Automatic text extraction runs on images; an admin will review this document manually.",
      });
    }

    await persistOcrText(admin, userId, null, requestedKey);

    // Dynamic import keeps the WASM worker out of the Next build graph. The
    // package is declared in serverExternalPackages.
    const { createWorker } = await import("tesseract.js");
    const cachePath = path.join(tmpdir(), "utn-tesseract-cache");

    let text = "";
    let confidence = 0;

    const worker = await createWorker("eng", 1, { cachePath });
    try {
      const result = await worker.recognize(Buffer.from(object.bytes));
      text = cleanOcrText(result.data.text);
      confidence = Math.round(result.data.confidence);
    } finally {
      await worker.terminate();
    }

    if (!text) {
      return NextResponse.json({
        status: "empty",
        message:
          "No readable text was found. Retake the photo in good light, or submit for manual review.",
      });
    }

    await persistOcrText(admin, userId, text, requestedKey);

    return NextResponse.json({
      status: "completed",
      text,
      confidence,
      characters: text.length,
      fingerprint: createHash("sha256").update(key).digest("hex").slice(0, 12),
    });
  } catch (error) {
    console.error("[verification/ocr] failed", error);
    return apiError(
      502,
      "ocr_failed",
      "We could not read the document automatically. You can still submit it for manual review.",
    );
  } finally {
    activeOcrJobs -= 1;
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
