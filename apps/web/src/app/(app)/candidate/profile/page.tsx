import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ScanFace } from "lucide-react";
import type { CandidateProfile } from "@utn/shared";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PriorityProCard } from "@/components/candidate/priority-pro-card";
import { VerificationBadge } from "@/components/verification-badge";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";
import { CandidateProfileForm } from "./candidate-profile-form";

export const metadata: Metadata = {
  title: "Candidate profile",
};

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage() {
  const session = await requireRole("candidate", "/candidate/profile");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const candidate = (profile as CandidateProfile | null) ?? null;

  return (
    <div className="space-y-6">
      <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-champagne">Candidate onboarding</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
              Your profile
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Employers see this summary before they unlock your full details. Keep it specific and
              honest — it is checked against your certificate.
            </p>
          </div>
          {candidate ? <VerificationBadge status={candidate.verification_status} /> : null}
        </div>
      </section>

      <Card>
        <CardHeader
          title={candidate ? "Profile details" : "Create your profile"}
          description="Required fields are marked with an asterisk."
        />
        <div className="mt-5">
          <CandidateProfileForm
            userId={session.user.id}
            profile={candidate}
            defaultName={session.user.fullName}
          />
        </div>
      </Card>

      <PriorityProCard isFeatured={Boolean(candidate?.is_featured)} />

      <Card className="border-accent-emerald/20 bg-gradient-to-br from-surface-card to-accent-emerald-soft/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-emerald-soft text-accent-emerald-hover">
              <ScanFace className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink-primary">
                Next: verify your degree
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
                Upload a private certificate and record a live 60–120 second pitch. Submit unlocks
                at exactly one minute.
              </p>
            </div>
          </div>
          <Link
            href="/candidate/verification"
            className="inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open verification
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  );
}
