import Link from "next/link";
import { ArrowLeft, CreditCard, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREDIT_PACKS } from "@utn/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CheckoutButton } from "@/components/employer/checkout-button";

export const dynamic = "force-dynamic";

export default async function EmployerBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requireRole("employer", "/employer/billing");
  const params = await searchParams;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: company }, { data: balance }] = await Promise.all([
    supabase.from("companies").select("id, company_name").eq("owner_id", session.user.id).maybeSingle(),
    supabase.rpc("get_my_credit_balance"),
  ]);

  if (!company) {
    return (
      <Alert tone="error" title="Company required">
        Create your company profile first.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/employer/candidates"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent-indigo hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to candidates
      </Link>

      {params.checkout === "success" ? (
        <Alert tone="success" title="Payment received">
          Your credits will appear shortly once the payment is confirmed.
        </Alert>
      ) : null}
      {params.checkout === "cancelled" ? (
        <Alert tone="warning" title="Checkout cancelled">
          No charge was made.
        </Alert>
      ) : null}

      <div className="rounded-2xl border border-line bg-brand-navy p-6 text-white shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
          Billing
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
          {company.company_name}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Credit balance: <span className="font-bold text-white">{Number(balance ?? 0)}</span> credits
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.id} className={pack.highlight ? "border-accent-indigo" : undefined}>
            <CardHeader
              title={pack.label}
              description={`${pack.credits} unlock credits`}
              action={
                pack.highlight ? (
                  <Badge tone="indigo">
                    <Sparkles className="mr-1 size-3" aria-hidden />
                    Popular
                  </Badge>
                ) : null
              }
            />
            <div className="mt-4 flex items-center justify-between">
              <p className="font-display text-2xl font-extrabold text-brand-navy">
                {pack.credits} credits
              </p>
              <CheckoutButton
                kind="credit_pack"
                packId={pack.id}
                label="Buy pack"
                highlight={pack.highlight}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="How credits work"
          description="One credit unlocks one candidate's full profile, certificate download, and chat."
        />
        <ul className="mt-4 space-y-2 text-sm text-ink-muted">
          <li>• {2} trial credits are granted automatically when your company is created.</li>
          <li>• Pitch videos are always free to watch.</li>
          <li>• Unlocks are permanent and never expire.</li>
        </ul>
      </Card>
    </div>
  );
}
