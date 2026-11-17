import { NextResponse } from "next/server";
import { unlockCandidateSchema } from "@utn/shared";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.unlock });
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "employer") {
    return apiError(403, "employer_only", "Only employers can unlock candidates.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = unlockCandidateSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Invalid unlock request.", {
      issues: parsed.error.issues,
    });
  }

  const { companyId: requestedCompanyId, candidateId } = parsed.data;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!bearer) {
    return apiError(401, "missing_token", "Sign in to continue.");
  }
  const userClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  try {
    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("id, owner_id")
      .eq("owner_id", auth.caller.userId)
      .maybeSingle();

    if (companyError) throw companyError;
    if (!company) {
      return apiError(403, "company_missing", "Create your company profile first.");
    }

    const companyId = String(company.id);
    if (requestedCompanyId !== companyId) {
      return apiError(403, "company_mismatch", "You can only spend your own company's credits.");
    }

    const { data, error } = await userClient.rpc("unlock_candidate", {
      p_company_id: companyId,
      p_candidate_id: candidateId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({
      success: Boolean(row?.success),
      alreadyUnlocked: Boolean(row?.already_unlocked),
      creditBalance: row?.credit_balance ?? null,
      message: row?.message ?? "unknown",
    });
  } catch (error) {
    console.error("[employer/unlock] failed", error);
    return apiError(500, "unlock_failed", "Could not unlock this candidate.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
