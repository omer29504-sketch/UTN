import type { NextResponse } from "next/server";
import type { Role } from "@utn/shared";
import { isSupabaseAdminConfigured, isSupabasePublicConfigured } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth";
import { securityLog, requestPath } from "@/lib/security/log";
import { isAllowedOrigin, isStateChanging } from "@/lib/security/origin";
import { RATE_LIMITS, enforceRateLimit, type RateLimitPolicy } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/security/request-context";
import { apiError } from "./http";

/**
 * Route handlers have no built-in body limit, so an authenticated caller could
 * stream an arbitrarily large JSON document into memory. Every API route here
 * accepts a small payload; 64 KiB is comfortably above the largest one.
 */
const MAX_STATE_CHANGING_BODY_BYTES = 64 * 1024;

export interface ApiCaller {
  userId: string;
  email: string;
  role: Role;
}

export interface RequireApiCallerOptions {
  /** Route-specific per-user budget. Defaults to the general API budget. */
  rateLimit?: RateLimitPolicy;
  /** Skip the same-origin check (e.g. a machine-to-machine endpoint). */
  allowCrossOrigin?: boolean;
}

type ApiAuthResult = { ok: true; caller: ApiCaller } | { ok: false; response: NextResponse };

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

function exceedsBodyLimit(request: Request): boolean {
  if (!isStateChanging(request.method)) return false;
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > MAX_STATE_CHANGING_BODY_BYTES;
}

/**
 * Bearer-token authentication shared by web (`authFetch`) and mobile. The
 * service-role client is used only after Supabase verifies the token.
 *
 * Every API route funnels through here, so this is also where cross-origin
 * rejection and rate limiting live: a new route cannot forget them.
 */
export async function requireApiCaller(
  request: Request,
  options: RequireApiCallerOptions = {},
): Promise<ApiAuthResult> {
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

  if (!options.allowCrossOrigin && !isAllowedOrigin(request)) {
    securityLog("api_cross_origin_blocked", {
      method: request.method,
      path: requestPath(request),
      ip: requestIp(request),
      origin: request.headers.get("origin"),
    });
    return {
      ok: false,
      response: apiError(
        403,
        "cross_origin_blocked",
        "This request did not come from the application.",
      ),
    };
  }

  if (exceedsBodyLimit(request)) {
    securityLog("api_payload_too_large", {
      path: requestPath(request),
      ip: requestIp(request),
    });
    return {
      ok: false,
      response: apiError(413, "payload_too_large", "The request body is too large."),
    };
  }

  // Pre-auth IP budget: caps token-guessing and floods before we spend a
  // Supabase round-trip on every request.
  const ipLimited = await enforceRateLimit(requestIp(request) ?? "unknown-ip", RATE_LIMITS.apiByIp);
  if (ipLimited) {
    securityLog("api_ip_rate_limited", {
      path: requestPath(request),
      ip: requestIp(request),
    });
    return { ok: false, response: ipLimited };
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
    securityLog("api_invalid_token", {
      path: requestPath(request),
      ip: requestIp(request),
    });
    return {
      ok: false,
      response: apiError(401, "invalid_token", "Your session has expired. Sign in again."),
    };
  }

  // Per-user budget. Checked before the profile lookup so an abusive caller
  // cannot amplify load on the database.
  const userLimited = await enforceRateLimit(
    authData.user.id,
    options.rateLimit ?? RATE_LIMITS.apiDefault,
  );
  if (userLimited) {
    securityLog("api_user_rate_limited", {
      path: requestPath(request),
      userId: authData.user.id,
    });
    return { ok: false, response: userLimited };
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
