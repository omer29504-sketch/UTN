import { buildWatermarkSignature, sniffContentType, uuidSchema } from "@utn/shared";
import { isR2Configured, readStorageObject } from "@utn/storage";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { requestFingerprint } from "@/lib/security/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zero-download certificate stream.
 *
 * The private R2 object is read server-side and piped back as bytes. No presigned
 * URL, redirect, or public link ever reaches the client, so the browser cannot
 * persist the document. The response is rendered into an in-memory <canvas>.
 *
 * Hard requirements enforced here (never in the client):
 *   * caller role === 'employer'
 *   * employer has accepted the confidentiality clause (employer_tos_accepted_at)
 *   * employer's company has unlocked the candidate
 *   * every successful read writes a 'certificate_viewed' audit row
 */

const ALLOWED_CONTENT_TYPES = new Set<string>(["application/pdf", "image/jpeg", "image/png"]);

/** Strict anti-cache headers — the document must never be stored anywhere. */
const SECURE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.certificateStream });
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "employer") {
    return apiError(
      403,
      "employer_only",
      "Only employer accounts can open candidate certificates.",
    );
  }

  const { candidateId } = await context.params;
  if (!uuidSchema.safeParse(candidateId).success) {
    return apiError(400, "invalid_candidate", "The candidate identifier is invalid.");
  }

  const kind = new URL(request.url).searchParams.get("kind") === "cv" ? "cv" : "certificate";

  if (!isR2Configured()) {
    return apiError(503, "storage_not_configured", "Object storage is not configured.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  const employerId = auth.caller.userId;

  try {
    const [{ data: company, error: companyError }, { data: profile, error: profileError }] =
      await Promise.all([
        admin.from("companies").select("id, company_name").eq("owner_id", employerId).maybeSingle(),
        admin
          .from("profiles")
          .select("email, employer_tos_accepted_at, employer_tos_version")
          .eq("id", employerId)
          .maybeSingle(),
      ]);

    if (companyError) throw companyError;
    if (profileError) throw profileError;

    if (!company) {
      return apiError(403, "company_missing", "Create your company profile first.");
    }

    if (!profile?.employer_tos_accepted_at) {
      return apiError(
        403,
        "confidentiality_consent_required",
        "Accept the Employer Confidentiality & Credential Security Terms before viewing candidate certificates.",
      );
    }

    const { data: unlock, error: unlockError } = await admin
      .from("company_unlocked_candidates")
      .select("candidate_id")
      .eq("company_id", company.id)
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (unlockError) throw unlockError;
    if (!unlock) {
      return apiError(
        403,
        "candidate_locked",
        "Unlock this candidate before opening their certificate.",
      );
    }

    const { data: media, error: mediaError } = await admin
      .from("candidate_media")
      .select("certificate_r2_key, cv_r2_key")
      .eq("candidate_id", candidateId)
      .maybeSingle();

    if (mediaError) throw mediaError;

    const storageKey = kind === "cv" ? media?.cv_r2_key : media?.certificate_r2_key;
    if (!storageKey) {
      return apiError(
        404,
        kind === "cv" ? "cv_not_found" : "certificate_not_found",
        kind === "cv"
          ? "This candidate has not uploaded a CV."
          : "This candidate has not uploaded a certificate.",
      );
    }

    const object = await readStorageObject({
      bucket: "private-credentials",
      key: storageKey,
    });

    const fingerprint = requestFingerprint(request);
    const watermarkSignature = buildWatermarkSignature({
      employerName: String(company.company_name),
      employerEmail: String(profile.email ?? auth.caller.email),
      employerId,
    });

    // Compliance is fail-closed: if the trail cannot be written, do not serve.
    const { error: auditError } = await admin.from("document_access_logs").insert({
      employer_id: employerId,
      candidate_id: candidateId,
      event_type: kind === "cv" ? "cv_viewed" : "certificate_viewed",
      ip_address: fingerprint.ip,
      user_agent: fingerprint.userAgent,
      watermark_signature: watermarkSignature,
    });

    if (auditError) {
      console.error("[certificate-stream] audit insert failed", auditError.message);
      return apiError(
        500,
        "audit_failed",
        "This document cannot be displayed because the access could not be audited.",
      );
    }

    const { bytes } = object;

    // Trust the bytes, not the declared Content-Type. A mismatched object is
    // never handed to the browser's PDF/image renderer.
    const contentType = sniffContentType(bytes);
    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      return apiError(415, "unsupported_document", "This certificate format cannot be displayed.");
    }

    // The Expo viewer cannot decode binary blobs reliably, so it asks for the
    // same audited bytes as an in-memory base64 payload. No URL is returned.
    if (new URL(request.url).searchParams.get("format") === "base64") {
      const payload = JSON.stringify({
        contentType,
        base64: Buffer.from(bytes).toString("base64"),
        watermarkSignature,
      });

      return new Response(payload, {
        status: 200,
        headers: {
          ...SECURE_HEADERS,
          "Content-Type": "application/json; charset=utf-8",
          "X-Watermark-Signature": encodeURIComponent(watermarkSignature),
        },
      });
    }

    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;

    return new Response(body, {
      status: 200,
      headers: {
        ...SECURE_HEADERS,
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        // Percent-encoded so the "•" separators stay valid ASCII header bytes.
        "X-Watermark-Signature": encodeURIComponent(watermarkSignature),
      },
    });
  } catch (error) {
    console.error("[certificate-stream] failed", error);
    return apiError(500, "stream_failed", "Could not open the secure certificate viewer.");
  }
}

export function POST() {
  return methodNotAllowed("GET");
}
