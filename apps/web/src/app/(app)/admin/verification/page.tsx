import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Inbox,
  ShieldCheck,
  Video,
} from "lucide-react";
import { formatPitchDuration, type CandidateMedia, type CandidateProfile } from "@utn/shared";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verification queue",
};

export const dynamic = "force-dynamic";

export default async function AdminVerificationQueuePage() {
  await requireRole("admin", "/admin/verification");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data: profileData, error: profileError } = await supabase
    .from("candidate_profiles")
    .select(
      "user_id, full_name, headline, industry, university_name, degree_level, graduation_year, experience_years, verification_status, rejection_reason, certificate_verification_ref, registrar_consent_given, registrar_consent_at, is_featured, created_at, updated_at",
    )
    .eq("verification_status", "pending")
    .order("updated_at", { ascending: true });

  if (profileError) {
    return (
      <Alert tone="error" title="Could not load the queue">
        {profileError.message}
      </Alert>
    );
  }

  const candidates = (profileData ?? []) as CandidateProfile[];
  const ids = candidates.map((candidate) => candidate.user_id);

  let mediaRows: CandidateMedia[] = [];
  if (ids.length > 0) {
    const { data: mediaData } = await supabase
      .from("candidate_media")
      .select("*")
      .in("candidate_id", ids);
    mediaRows = (mediaData ?? []) as CandidateMedia[];
  }

  const mediaByCandidate = new Map(mediaRows.map((media) => [media.candidate_id, media]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-indigo">
            Admin review
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-navy">
            Verification queue
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Oldest submissions first. Open a candidate to compare the certificate, extracted text,
            and live pitch before recording a decision.
          </p>
        </div>
        <Badge tone={candidates.length > 0 ? "warning" : "emerald"}>
          <ClipboardCheck className="size-3.5" aria-hidden />
          {candidates.length} pending
        </Badge>
      </div>

      {candidates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-verified-emerald-soft text-verified-emerald">
            <Inbox className="size-7" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold text-brand-navy">Queue is clear</h2>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            New candidate submissions will appear here automatically once both media files are
            uploaded and finalized.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {candidates.map((candidate) => {
            const media = mediaByCandidate.get(candidate.user_id);
            const initials = candidate.full_name
              .split(" ")
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("");

            return (
              <li key={candidate.user_id}>
                <Link
                  href={`/admin/verification/${candidate.user_id}`}
                  className="group flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface-card p-4 shadow-card transition hover:border-accent-indigo/30 hover:shadow-floating sm:p-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-indigo-soft font-display text-sm font-bold text-accent-indigo">
                    {initials || "C"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-base font-bold text-brand-navy">
                        {candidate.full_name}
                      </p>
                      <Badge tone="warning">Pending</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {candidate.degree_level} · {candidate.university_name} ·{" "}
                      {candidate.graduation_year}
                    </p>
                    {candidate.headline ? (
                      <p className="mt-1 truncate text-xs text-ink-muted/80">
                        {candidate.headline}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-muted">
                      <FileCheck2 className="size-3.5" aria-hidden />
                      Certificate
                    </span>
                    {candidate.registrar_consent_given ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-verified-emerald-soft px-2.5 py-1.5 text-[11px] font-medium text-emerald-700">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Registrar consent
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-muted">
                      <Video className="size-3.5" aria-hidden />
                      {formatPitchDuration(media?.video_duration_seconds ?? 0)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] font-medium text-ink-muted">
                      <Clock3 className="size-3.5" aria-hidden />
                      {new Date(candidate.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-indigo">
                    Review
                    <ArrowRight
                      className="size-4 transition group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
