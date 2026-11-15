import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { provisionAccount } from "@/lib/auth/provision";
import { safeNextPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PKCE callback for email-confirmation links. Supabase redirects here with a
 * `code`; we exchange it for a cookie session, then finish employer onboarding.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const errorDescription =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?error=${encodeURIComponent(errorDescription)}`, url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=Missing%20confirmation%20code", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=Authentication%20is%20not%20configured", url.origin),
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        `/auth/sign-in?error=${encodeURIComponent(error?.message ?? "Could not confirm your email")}`,
        url.origin,
      ),
    );
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    try {
      await provisionAccount(admin, data.user);
    } catch (provisionError) {
      console.error("[auth/callback] provisioning failed", provisionError);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
