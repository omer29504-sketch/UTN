import { NextResponse } from "next/server";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import { provisionAccount } from "@/lib/auth/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotent post-signup provisioning. Called by the client when a session is
 * available immediately (email confirmation disabled). Safe to call repeatedly.
 */
export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.authProvision });
  if (!auth.ok) return auth.response;

  const admin = createSupabaseAdminClient();
  const authClient = createSupabaseAuthClient();
  if (!admin || !authClient) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) {
    return apiError(401, "missing_token", "Sign in to continue.");
  }

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return apiError(401, "invalid_token", "Your session has expired. Sign in again.");
  }

  try {
    const result = await provisionAccount(admin, data.user);
    return NextResponse.json(result);
  } catch (provisionError) {
    console.error("[auth/provision] failed", provisionError);
    return apiError(500, "provision_failed", "Could not finish setting up your account.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
