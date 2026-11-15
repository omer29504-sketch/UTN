import type { Metadata } from "next";
import { Building2, CreditCard, ShieldCheck } from "lucide-react";
import type { Company } from "@utn/shared";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { CompanyForm } from "./company-form";

export const metadata: Metadata = {
  title: "Company",
};

export const dynamic = "force-dynamic";

export default async function EmployerCompanyPage() {
  const session = await requireRole("employer", "/employer/company");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: companyData }, { data: balance }] = await Promise.all([
    supabase.from("companies").select("*").eq("owner_id", session.user.id).maybeSingle(),
    supabase.rpc("get_my_credit_balance"),
  ]);

  const company = (companyData as Company | null) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-indigo">
            Employer onboarding
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-navy">
            {company ? "Company profile" : "Set up your company"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Your corporate domain gates employer access. The trial credit grant is applied once per
            company by the database.
          </p>
        </div>
        <Badge tone={company?.is_verified ? "emerald" : "warning"}>
          {company?.is_verified ? "Verified employer" : "Awaiting verification"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface-card p-5 shadow-card">
          <Building2 className="size-5 text-accent-indigo" aria-hidden />
          <p className="mt-3 font-display text-xl font-extrabold text-brand-navy">
            {company?.company_name ?? "Not set"}
          </p>
          <p className="text-xs text-ink-muted">Company</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-5 shadow-card">
          <CreditCard className="size-5 text-accent-indigo" aria-hidden />
          <p className="mt-3 font-display text-xl font-extrabold text-brand-navy">
            {Number(balance ?? 0)} credits
          </p>
          <p className="text-xs text-ink-muted">Trial balance from the immutable ledger</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-card p-5 shadow-card">
          <ShieldCheck className="size-5 text-accent-indigo" aria-hidden />
          <p className="mt-3 font-display text-xl font-extrabold text-brand-navy">
            {company?.corporate_domain ?? "—"}
          </p>
          <p className="text-xs text-ink-muted">Corporate domain</p>
        </div>
      </div>

      <Card>
        <CardHeader
          title={company ? "Company details" : "Create your company profile"}
          description="Your work email must match the corporate domain."
        />
        <div className="mt-5">
          <CompanyForm
            userId={session.user.id}
            email={session.user.email}
            company={company}
          />
        </div>
      </Card>
    </div>
  );
}
