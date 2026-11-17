import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CreditCard, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREDIT_PACKS } from "@utn/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { CheckoutButton } from "@/components/employer/checkout-button";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing" };

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
    supabase
      .from("companies")
      .select("id, company_name")
      .eq("owner_id", session.user.id)
      .maybeSingle(),
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
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent-emerald-hover hover:underline"
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

      <section className="border-white/12 relative isolate animate-slide-in overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-champagne">Billing</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
              {company.company_name}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Credit balance: <span className="font-bold text-white">{Number(balance ?? 0)}</span>{" "}
              credits
            </p>
          </div>
          <Badge tone="dark">
            <CreditCard className="size-3.5" aria-hidden />
            Secure checkout
          </Badge>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <SpotlightGlassCard
            key={pack.id}
            interactive
            className={pack.highlight ? "hairline-gold p-6" : "p-6"}
          >
            <CardHeader
              title={pack.label}
              description={`${pack.credits} unlock credits`}
              action={
                pack.highlight ? (
                  <Badge tone="gold">
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
          </SpotlightGlassCard>
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
