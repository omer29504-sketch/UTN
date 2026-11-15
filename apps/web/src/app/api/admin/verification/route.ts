import { NextResponse } from "next/server";
import { adminVerificationDecisionSchema } from "@utn/shared";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a verification decision and appends an immutable review row. The
 * decision lives on candidate_profiles; verification_reviews preserves history.
 */
export async function POST(request: Request) {
  const auth = await requireApiCaller(request);
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "admin") {
    return apiError(403, "admin_only", "Only administrators can review verification.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = adminVerificationDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Check the decision and try again.", {
      issues: parsed.error.issues,
    });
  }

  const { candidateId, decision, rejectionReason } = parsed.data;
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  try {
    const { data: candidate, error: candidateError } = await admin
      .from("candidate_profiles")
      .select("user_id, verification_status")
      .eq("user_id", candidateId)
      .maybeSingle();

    if (candidateError) throw candidateError;
    if (!candidate) {
      return apiError(404, "candidate_not_found", "That candidate does not exist.");
    }
    if (candidate.verification_status !== "pending") {
      return apiError(
        409,
        "not_pending",
        "This candidate is not awaiting review. Refresh the queue and try again.",
      );
    }

    const nextStatus = decision === "approve" ? "verified" : "rejected";
    const reason = decision === "reject" ? (rejectionReason?.trim() ?? null) : null;

    // Write the audit row first so a failed update cannot hide a decision, then
    // roll the audit row back if the profile update fails.
    const { data: review, error: reviewError } = await admin
      .from("verification_reviews")
      .insert({
        candidate_id: candidateId,
        reviewer_id: auth.caller.userId,
        reviewer_email: auth.caller.email,
        decision: nextStatus,
        rejection_reason: reason,
      })
      .select("id")
      .single();

    if (reviewError) throw reviewError;

    const { error: updateError } = await admin
      .from("candidate_profiles")
      .update({
        verification_status: nextStatus,
        rejection_reason: reason,
      })
      .eq("user_id", candidateId);

    if (updateError) {
      await admin.from("verification_reviews").delete().eq("id", review.id);
      throw updateError;
    }

    return NextResponse.json({
      status: nextStatus,
      decision,
      rejectionReason: reason,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[admin/verification] decision failed", error);
    return apiError(500, "decision_failed", "The review decision could not be saved.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
