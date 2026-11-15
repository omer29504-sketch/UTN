import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getEmailDomain, isCorporateEmail } from "@utn/shared";

export interface ProvisionResult {
  role: "candidate" | "employer" | "admin";
  companyCreated: boolean;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Completes the account rows that cannot be created reliably on the client when
 * email confirmation is enabled. The auth trigger always creates `profiles`;
 * this fills in the employer's company record from signup metadata.
 *
 * Uses the service role, so it is only called from server routes after Supabase
 * has verified the caller (or immediately after a verified auth callback).
 */
export async function provisionAccount(
  admin: SupabaseClient,
  user: User,
): Promise<ProvisionResult> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const metadata = user.user_metadata ?? {};
  const requestedRole = readString(metadata.role) === "employer" ? "employer" : "candidate";
  const role = (profile?.role as ProvisionResult["role"] | undefined) ?? requestedRole;

  if (role !== "employer") {
    return { role, companyCreated: false };
  }

  const { data: existing } = await admin
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing) {
    return { role, companyCreated: false };
  }

  const companyName =
    readString(metadata.company_name) || readString(metadata.companyName);
  const email = (user.email ?? "").toLowerCase();
  const domain = getEmailDomain(email);

  if (!companyName || !domain || !isCorporateEmail(email)) {
    // The employer can still finish onboarding on /employer/company.
    return { role, companyCreated: false };
  }

  const { error } = await admin.from("companies").insert({
    owner_id: user.id,
    company_name: companyName.slice(0, 120),
    corporate_domain: domain,
    display_logo_consent: metadata.display_logo_consent !== false,
  });

  if (error) {
    console.error("[provision] company insert failed", error.message);
    return { role, companyCreated: false };
  }

  return { role, companyCreated: true };
}
