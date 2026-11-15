import type { NextResponse } from "next/server";
import type { Role } from "@utn/shared";
import { isSupabaseAdminConfigured, isSupabasePublicConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import { apiError } from "./http";

export interface ApiCaller {
  userId: string;
  email: string;
  role: Role;
}

type ApiAuthResult =
  | { ok: true; caller: ApiCaller }
  | { ok: false; response: NextResponse };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

/**
 * Bearer-token authentication shared by web (`authFetch`) and mobile. The
 * service-role client is used only after Supabase verifies the token.
 */
export async function requireApiCaller(request: Request): Promise<ApiAuthResult> {
  if (!isSupabasePublicConfigured() || !isSupabaseAdminConfigured()) {
    return {
      ok: false,
      response: apiError(
        503,
        "supabase_not_configured",
        "Authentication is not configured on this deployment.",
      ),
    };
  }

  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: apiError(401, "missing_token", "Sign in to continue."),
    };
  }

  const authClient = createSupabaseAuthClient();
  const admin = createSupabaseAdminClient();

  if (!authClient || !admin) {
    return {
      ok: false,
      response: apiError(
        503,
        "supabase_not_configured",
        "Authentication is not configured on this deployment.",
      ),
    };
  }

  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return {
      ok: false,
      response: apiError(401, "invalid_token", "Your session has expired. Sign in again."),
    };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[api-auth] profile lookup failed", profileError.message);
    return {
      ok: false,
      response: apiError(500, "profile_lookup_failed", "Could not verify your account."),
    };
  }

  if (!profile) {
    return {
      ok: false,
      response: apiError(403, "profile_missing", "Finish creating your account first."),
    };
  }

  return {
    ok: true,
    caller: {
      userId: authData.user.id,
      email: authData.user.email ?? String(profile.email),
      role: String(profile.role) as Role,
    },
  };
}
