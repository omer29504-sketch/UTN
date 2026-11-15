import { NextResponse } from "next/server";
import {
  PRESIGN_TTL_SECONDS,
  extractOwnerFromStorageKey,
  presignRequestSchema,
  type StorageBucket,
} from "@utn/shared";
import {
  buildObjectKey,
  createPresignedGetUrl,
  createPresignedPutUrl,
  isR2Configured,
  readR2Config,
  type R2Config,
} from "@utn/storage";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return apiError(503, "storage_not_configured", "Object storage is not configured.");
  }

  let config: R2Config;
  try {
    config = readR2Config();
  } catch {
    return apiError(503, "storage_not_configured", "Object storage is not configured.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = presignRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "The upload request is invalid.", {
      issues: parsed.error.issues,
    });
  }

  const auth = await requireApiCaller(request);
  if (!auth.ok) return auth.response;

  const { userId, role } = auth.caller;
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  try {
    if (parsed.data.intent === "upload") {
      const { bucket, contentType, contentLength } = parsed.data;

      let ownerId: string;
      if (bucket === "company-logos") {
        if (role !== "employer") {
          return apiError(403, "employer_only", "Only employers can upload company logos.");
        }
        const { data: company, error } = await admin
          .from("companies")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!company) {
          return apiError(403, "company_missing", "Create your company profile first.");
        }
        ownerId = String(company.id);
      } else {
        if (role !== "candidate") {
          return apiError(
            403,
            "candidate_only",
            "Only candidates can upload verification media.",
          );
        }
        const { data: candidate, error } = await admin
          .from("candidate_profiles")
          .select("verification_status")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!candidate) {
          return apiError(
            403,
            "candidate_profile_missing",
            "Complete your candidate profile first.",
          );
        }
        if (["pending", "verified"].includes(String(candidate.verification_status))) {
          return apiError(
            409,
            "media_locked",
            "Your verification is under review. Media uploads are locked until a decision is made.",
          );
        }
        ownerId = userId;
      }

      const key = buildObjectKey({
        bucket,
        ownerId,
        contentType,
      });

      const presigned = await createPresignedPutUrl({
        bucket,
        key,
        contentType,
        contentLength,
        config,
      });

      return NextResponse.json({
        intent: "upload" as const,
        bucket,
        key,
        uploadUrl: presigned.url,
        expiresAt: presigned.expiresAt,
        requiredHeaders: {
          "Content-Type": contentType,
          "Content-Length": String(contentLength),
        },
      });
    }

    // ── Download ────────────────────────────────────────────────────────────
    const { bucket, key } = parsed.data;
    const ownerId = extractOwnerFromStorageKey(key);
    if (!ownerId) {
      return apiError(400, "invalid_key", "The storage key is malformed.");
    }

    const isAdmin = role === "admin";
    let allowed = false;

    if (isAdmin) {
      allowed = true;
    } else if (role === "candidate") {
      allowed = ownerId === userId;
    } else if (role === "employer") {
      const { data: company, error } = await admin
        .from("companies")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!company) {
        return apiError(403, "company_missing", "Create your company profile first.");
      }
      const companyId = String(company.id);

      if (bucket === "pitch-videos") {
        const { data: candidate, error: candidateError } = await admin
          .from("candidate_profiles")
          .select("verification_status")
          .eq("user_id", ownerId)
          .maybeSingle();
        if (candidateError) throw candidateError;
        allowed = candidate?.verification_status === "verified";
      } else {
        const { data: unlock, error: unlockError } = await admin
          .from("company_unlocked_candidates")
          .select("candidate_id")
          .eq("company_id", companyId)
          .eq("candidate_id", ownerId)
          .maybeSingle();
        if (unlockError) throw unlockError;
        allowed = Boolean(unlock);
      }
    }

    if (!allowed) {
      return apiError(403, "not_authorized", "You do not have access to this document.");
    }

    const privateBucket: StorageBucket = bucket;
    const presigned = await createPresignedGetUrl({
      bucket: privateBucket,
      key,
      expiresInSeconds:
        bucket === "private-credentials"
          ? PRESIGN_TTL_SECONDS.privateDownload
          : PRESIGN_TTL_SECONDS.mediaDownload,
      responseContentDisposition: "inline",
      config,
    });

    return NextResponse.json({
      intent: "download" as const,
      bucket,
      key,
      url: presigned.url,
      expiresAt: presigned.expiresAt,
    });
  } catch (error) {
    console.error("[presign] unexpected failure", error);
    return apiError(500, "storage_error", "Could not prepare the secure storage request.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
