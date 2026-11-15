import { NextResponse } from "next/server";
import {
  candidateVerificationSubmissionSchema,
  isPitchVideoKey,
  isPrivateCredentialKey,
} from "@utn/shared";
import { headStorageObject } from "@utn/storage";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalized(value: string | null | undefined): string {
  return (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export async function POST(request: Request) {
  const auth = await requireApiCaller(request);
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "candidate") {
    return apiError(403, "candidate_only", "Only candidates submit verification media.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = candidateVerificationSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Check your documents and pitch, then retry.", {
      issues: parsed.error.issues,
    });
  }

  const { certificate, video, certificateVerificationRef, registrarConsentGiven } = parsed.data;
  const userId = auth.caller.userId;

  if (!isPrivateCredentialKey(certificate.r2Key, userId)) {
    return apiError(400, "invalid_certificate_key", "The certificate key is not yours.");
  }
  if (!isPitchVideoKey(video.r2Key, userId)) {
    return apiError(400, "invalid_video_key", "The pitch video key is not yours.");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

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
    if (["pending", "verified"].includes(String(candidate.verification_status))) {
      return apiError(
        409,
        "media_locked",
        "Your verification is already under review or approved.",
      );
    }

    const [certificateHead, videoHead] = await Promise.all([
      headStorageObject({ bucket: "private-credentials", key: certificate.r2Key }),
      headStorageObject({ bucket: "pitch-videos", key: video.r2Key }),
    ]);

    if (!certificateHead) {
      return apiError(400, "certificate_missing", "The certificate upload did not complete.");
    }
    if (!videoHead) {
      return apiError(400, "video_missing", "The pitch video upload did not complete.");
    }

    if (certificateHead.contentLength !== certificate.sizeBytes) {
      return apiError(400, "certificate_size_mismatch", "The certificate upload is incomplete.");
    }
    if (videoHead.contentLength !== video.sizeBytes) {
      return apiError(400, "video_size_mismatch", "The pitch video upload is incomplete.");
    }

    if (normalized(certificateHead.contentType) !== normalized(certificate.contentType)) {
      return apiError(400, "certificate_type_mismatch", "The certificate type is invalid.");
    }
    if (normalized(videoHead.contentType) !== normalized(video.contentType)) {
      return apiError(400, "video_type_mismatch", "The pitch video type is invalid.");
    }

    const submittedAt = new Date().toISOString();

    // Persist consent before the media upsert: the candidate_media trigger
    // promotes the profile to 'pending', and chk_registrar_consent requires
    // consent to already be true at that point.
    const { error: consentError } = await admin
      .from("candidate_profiles")
      .update({
        certificate_verification_ref: certificateVerificationRef ?? null,
        registrar_consent_given: registrarConsentGiven,
        registrar_consent_at: submittedAt,
      })
      .eq("user_id", userId);

    if (consentError) throw consentError;

    const { error: upsertError } = await admin.from("candidate_media").upsert(
      {
        candidate_id: userId,
        certificate_r2_key: certificate.r2Key,
        video_r2_key: video.r2Key,
        video_duration_seconds: video.durationSeconds,
        submitted_at: submittedAt,
      },
      { onConflict: "candidate_id" },
    );

    if (upsertError) throw upsertError;

    // The candidate_media trigger promotes unverified/rejected profiles to
    // pending; read it back so the UI can trust the persisted state.
    const { data: refreshed, error: refreshError } = await admin
      .from("candidate_profiles")
      .select("verification_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (refreshError) throw refreshError;

    return NextResponse.json({
      status: refreshed?.verification_status ?? "pending",
      submittedAt,
      registrarConsentAt: submittedAt,
      certificateVerificationRef: certificateVerificationRef ?? null,
    });
  } catch (error) {
    console.error("[verification/finalize] failed", error);
    return apiError(500, "submission_failed", "We could not submit your verification.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
