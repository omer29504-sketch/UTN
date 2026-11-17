import { NextResponse } from "next/server";
import {
  EMPLOYER_TOS_VERSION,
  buildWatermarkSignature,
  documentAuditEventSchema,
} from "@utn/shared";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { requestFingerprint } from "@/lib/security/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Confidentiality consent + anti-capture telemetry.
 *
 * Every call appends an immutable row to document_access_logs. The server —
 * never the browser — derives the employer identity, IP, user agent and
 * watermark signature, so a client cannot forge an audit entry.
 */
export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.certificateEvent });
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "employer") {
    return apiError(
      403,
      "employer_only",
      "Only employer accounts can record certificate security events.",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = documentAuditEventSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Invalid security event.", {
      issues: parsed.error.issues,
    });
  }

  const { eventType, candidateId } = parsed.data;
  const employerId = auth.caller.userId;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

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

    const { data: candidate, error: candidateError } = await admin
      .from("candidate_profiles")
      .select("user_id")
      .eq("user_id", candidateId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return apiError(404, "candidate_not_found", "This candidate no longer exists.");
    }

    // Every event other than the initial consent happens while a document is on
    // screen, which is only possible after an unlock.
    if (eventType !== "tos_accepted") {
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
          "Unlock this candidate before recording certificate security events.",
        );
      }
    }

    let tosAcceptedAt = (profile?.employer_tos_accepted_at as string | null) ?? null;

    if (eventType === "tos_accepted") {
      const acceptedAt = new Date().toISOString();

      const { error: updateError } = await admin
        .from("profiles")
        .update({
          employer_tos_accepted_at: acceptedAt,
          employer_tos_version: EMPLOYER_TOS_VERSION,
        })
        .eq("id", employerId);

      if (updateError) throw updateError;
      tosAcceptedAt = acceptedAt;
    }

    const fingerprint = requestFingerprint(request);
    const watermarkSignature = buildWatermarkSignature({
      employerName: String(company.company_name),
      employerEmail: String(profile?.email ?? auth.caller.email),
      employerId,
    });

    const { error: auditError } = await admin.from("document_access_logs").insert({
      employer_id: employerId,
      candidate_id: candidateId,
      event_type: eventType,
      ip_address: fingerprint.ip,
      user_agent: fingerprint.userAgent,
      watermark_signature: watermarkSignature,
    });

    if (auditError) throw auditError;

    return NextResponse.json({
      ok: true,
      eventType,
      employerTosAcceptedAt: tosAcceptedAt,
      employerTosVersion: EMPLOYER_TOS_VERSION,
      watermarkSignature,
    });
  } catch (error) {
    console.error("[certificate-security-event] failed", error);
    return apiError(
      500,
      "security_event_failed",
      "Could not record the security event. Please try again.",
    );
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
