import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Clock3,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Unlock,
  Video,
} from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPitchDuration } from "@utn/shared";
import type { EmployerCandidateCard } from "@utn/shared";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SecureCertificateViewer,
  type EmployerViewerIdentity,
} from "@/components/employer/secure-certificate-viewer";
import { PitchVideo } from "@/components/employer/pitch-video";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ChatThread } from "@/components/chat/chat-thread";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";

export const dynamic = "force-dynamic";

export default async function UnlockedCandidatePage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  const session = await requireSession("/employer/candidates");
  const { candidateId } = await params;

  if (session.profile.role !== "employer" && session.profile.role !== "admin") {
    return (
      <Alert tone="error" title="Employer access required">
        This page is for employer accounts.
      </Alert>
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, company_name")
    .eq("owner_id", session.user.id)
    .maybeSingle();

  if (!company && session.profile.role !== "admin") {
    return (
      <Alert tone="error" title="Company required">
        Create your company profile first.
      </Alert>
    );
  }

  const { data, error } = await supabase.rpc("get_verified_candidates_for_employer", {
    p_search: null,
    p_industry: null,
    p_degree_level: null,
    p_university: null,
    p_graduation_year: null,
    p_max_experience_years: null,
    p_only_featured: false,
    p_limit: 60,
    p_offset: 0,
  });

  const rows = (data ?? []) as EmployerCandidateCard[];
  const candidate = rows.find((r) => r.candidate_id === candidateId);

  if (error || !candidate) {
    return (
      <Alert tone="error" title="Candidate not found">
        {error?.message ?? "This candidate is not available."}
      </Alert>
    );
  }

  if (!candidate.is_unlocked) {
    return (
      <div className="space-y-4">
        <Link
          href="/employer/candidates"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-emerald-hover hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to candidates
        </Link>
        <Alert tone="warning" title="Profile locked">
          Unlock this candidate from the discovery page to view full contact details.
        </Alert>
      </div>
    );
  }

  // Record a Priority Pro profile view (best-effort; RLS gates to verified employers).
  if (session.profile.role === "employer" && company) {
    await supabase
      .from("candidate_profile_views")
      .insert({ candidate_id: candidateId, viewer_company_id: company.id })
      .then(
        () => undefined,
        () => undefined,
      );
  }

  const { data: employerProfile } = await supabase
    .from("profiles")
    .select("employer_tos_accepted_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const employer: EmployerViewerIdentity = {
    employerId: session.user.id,
    employerName: company?.company_name ?? "Employer",
    employerEmail: session.user.email,
    tosAcceptedAt: (employerProfile?.employer_tos_accepted_at as string | null | undefined) ?? null,
  };

  return (
    <div className="space-y-6">
      <Link
        href="/employer/candidates"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent-emerald-hover hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to candidates
      </Link>

      <section className="border-white/12 relative isolate animate-slide-in overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-champagne">Unlocked candidate</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
              {candidate.full_name}
            </h1>
            {candidate.headline ? (
              <p className="mt-2 max-w-2xl text-sm text-white/70">{candidate.headline}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {candidate.is_featured ? (
              <Badge tone="gold">
                <Sparkles className="mr-1 size-3" aria-hidden />
                Priority Pro
              </Badge>
            ) : null}
            <Badge tone="emerald">
              <Unlock className="mr-1 size-3" aria-hidden />
              Unlocked
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <SpotlightGlassCard className="space-y-3 p-6">
          <CardHeader title="Contact" />
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-ink-primary">
              <Mail className="size-4 text-accent-emerald-hover" aria-hidden />
              {candidate.email ? (
                <a
                  className="text-accent-emerald-hover hover:underline"
                  href={`mailto:${candidate.email}`}
                >
                  {candidate.email}
                </a>
              ) : (
                "—"
              )}
            </p>
            <p className="flex items-center gap-2 text-ink-primary">
              <Phone className="size-4 text-accent-emerald-hover" aria-hidden />
              {candidate.phone ?? "—"}
            </p>
          </div>
        </SpotlightGlassCard>

        <SpotlightGlassCard className="space-y-3 p-6">
          <CardHeader title="Degree" />
          <div className="space-y-1 text-sm text-ink-muted">
            <p>
              <span className="font-semibold text-ink-primary">{candidate.degree_level}</span>
            </p>
            <p>{candidate.university_name}</p>
            <p>Graduated {candidate.graduation_year}</p>
            <p>{candidate.experience_years} years experience</p>
            {candidate.industry ? <p>{candidate.industry}</p> : null}
          </div>
          {candidate.certificate_r2_key && session.profile.role === "employer" ? (
            <SecureCertificateViewer candidateId={candidate.candidate_id} employer={employer} />
          ) : null}
        </SpotlightGlassCard>

        <SpotlightGlassCard className="space-y-3 p-6">
          <CardHeader title="Pitch video" />
          {candidate.video_r2_key ? (
            <PitchVideo storageKey={candidate.video_r2_key} />
          ) : (
            <p className="text-sm text-ink-muted">No pitch video.</p>
          )}
          {candidate.video_duration_seconds ? (
            <p className="text-xs text-ink-muted">
              {formatPitchDuration(candidate.video_duration_seconds)}
            </p>
          ) : null}
        </SpotlightGlassCard>
      </div>

      {company ? (
        <ChatThread
          companyId={String(company.id)}
          candidateId={candidate.candidate_id}
          currentUserId={session.user.id}
          title="Direct chat"
        />
      ) : (
        <Card>
          <CardHeader title="Direct chat" description="Sign in as the company owner to chat." />
        </Card>
      )}
    </div>
  );
}
