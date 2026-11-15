import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  ScanFace,
  ShieldAlert,
} from "lucide-react";
import {
  formatPitchDuration,
  type CandidateMedia,
  type CandidateProfile,
} from "@utn/shared";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VerificationBadge } from "@/components/verification-badge";
import { VerificationStudio } from "./verification-studio";

export const metadata: Metadata = {
  title: "Verification",
};

export const dynamic = "force-dynamic";

function LockedSubmission({
  profile,
  media,
  decision,
}: {
  profile: CandidateProfile;
  media: CandidateMedia | null;
  decision: "pending" | "verified";
}) {
  const verified = decision === "verified";
  const steps = [
    { label: "Certificate uploaded", done: Boolean(media?.certificate_r2_key) },
    { label: `Live pitch recorded (${formatPitchDuration(media?.video_duration_seconds ?? 0)})`, done: Boolean(media?.video_r2_key) },
    { label: verified ? "University verified" : "Admin review in progress", done: verified },
  ];

  return (
    <div className="space-y-5">
      <Card
        className={
          verified
            ? "border-verified-emerald/30 bg-gradient-to-br from-white to-verified-emerald-soft/40"
            : "border-warning/20 bg-gradient-to-br from-white to-amber-50"
        }
      >
        <div className="flex items-start gap-4">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-2xl text-white ${
              verified ? "bg-verified-emerald" : "bg-warning"
            }`}
          >
            {verified ? <BadgeCheck className="size-6" aria-hidden /> : <Clock3 className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
              Verification status
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-brand-navy">
              {verified ? "Your degree is verified" : "Your submission is under review"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              {verified
                ? "Employers can now find your profile, watch your pitch, and unlock your contact details with a credit."
                : "Media is locked while an admin compares your certificate with your profile and live pitch. You will see the decision here as soon as it is recorded."}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.label}
              className="flex items-center gap-2 rounded-xl border border-line bg-white/70 px-3 py-2.5"
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full ${
                  step.done
                    ? "bg-verified-emerald text-white"
                    : "bg-surface-muted text-ink-muted ring-1 ring-line"
                }`}
              >
                {step.done ? (
                  <CheckCircle2 className="size-3.5" aria-hidden />
                ) : (
                  <Clock3 className="size-3.5" aria-hidden />
                )}
              </span>
              <span className="text-[11px] font-medium leading-4 text-brand-navy">{step.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Submitted profile" description="What the reviewer sees." />
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Name", profile.full_name],
              ["University", profile.university_name],
              ["Degree", profile.degree_level],
              ["Graduation", String(profile.graduation_year)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
                <dt className="text-xs text-ink-muted">{label}</dt>
                <dd className="text-right text-xs font-semibold text-brand-navy">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Private media" description="Short-lived signed links only." />
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-canvas p-3">
              <FileCheck2 className="size-4 text-accent-indigo" aria-hidden />
              <span className="flex-1 text-xs font-medium text-brand-navy">Degree certificate</span>
              <Badge tone="emerald">Stored</Badge>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-canvas p-3">
              <Camera className="size-4 text-accent-indigo" aria-hidden />
              <span className="flex-1 text-xs font-medium text-brand-navy">
                Live pitch · {formatPitchDuration(media?.video_duration_seconds ?? 0)}
              </span>
              <Badge tone="emerald">Stored</Badge>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-ink-muted">
            <LockKeyhole className="mt-0.5 size-3 shrink-0" aria-hidden />
            Uploads are locked while your verification is {verified ? "approved" : "pending"}.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to dashboard
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href="/candidate/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy"
        >
          View profile
        </Link>
      </div>
    </div>
  );
}

export default async function CandidateVerificationPage() {
  const session = await requireRole("candidate", "/candidate/verification");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: profileData }, { data: mediaData }, { data: reviews }] = await Promise.all([
    supabase.from("candidate_profiles").select("*").eq("user_id", session.user.id).maybeSingle(),
    supabase.from("candidate_media").select("*").eq("candidate_id", session.user.id).maybeSingle(),
    supabase
      .from("verification_reviews")
      .select("decision, rejection_reason, created_at, reviewer_email")
      .eq("candidate_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const profile = (profileData as CandidateProfile | null) ?? null;
  const media = (mediaData as CandidateMedia | null) ?? null;

  if (!profile) {
    return (
      <Card className="border-accent-indigo/20 bg-gradient-to-br from-white to-accent-indigo-soft/40">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-indigo-soft text-accent-indigo">
          <ScanFace className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-brand-navy">
          Complete your profile first
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          Verification compares your certificate with your degree, university, and graduation year.
          Add those details before uploading documents.
        </p>
        <Link
          href="/candidate/profile"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          Go to profile
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Card>
    );
  }

  const status = profile.verification_status;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-indigo">
            Candidate verification
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-navy">
            Prove your degree. Pitch live.
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Two gates: a private degree document and an unedited 60–120 second pitch recorded from
            your camera. Submit unlocks at exactly 01:00.
          </p>
        </div>
        <VerificationBadge status={status} />
      </div>

      {status === "pending" ? (
        <LockedSubmission profile={profile} media={media} decision="pending" />
      ) : status === "verified" ? (
        <LockedSubmission profile={profile} media={media} decision="verified" />
      ) : (
        <>
          {status === "rejected" ? (
            <Alert tone="error" title="Changes requested">
              {profile.rejection_reason ??
                "A reviewer asked for a new submission. Re-upload a clear document and re-record your pitch."}
            </Alert>
          ) : null}

          <VerificationStudio />

          {status === "rejected" ? (
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <RotateCcw className="size-3.5" aria-hidden />
              Resubmitting replaces your previous certificate and pitch once you send it for review.
            </div>
          ) : null}
        </>
      )}

      {reviews && reviews.length > 0 ? (
        <Card>
          <CardHeader
            title="Review history"
            description="Append-only decisions from the verification team."
          />
          <ol className="mt-4 space-y-3">
            {reviews.map((review, index) => (
              <li
                key={`${review.created_at}-${index}`}
                className="flex items-start gap-3 rounded-xl border border-line bg-surface-canvas p-3.5"
              >
                <span
                  className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${
                    review.decision === "verified"
                      ? "bg-verified-emerald-soft text-verified-emerald"
                      : "bg-red-50 text-danger"
                  }`}
                >
                  {review.decision === "verified" ? (
                    <BadgeCheck className="size-4" aria-hidden />
                  ) : (
                    <ShieldAlert className="size-4" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold capitalize text-brand-navy">
                      {review.decision === "verified" ? "Approved" : "Changes requested"}
                    </p>
                    <span className="text-[11px] text-ink-muted">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.rejection_reason ? (
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{review.rejection_reason}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </div>
  );
}
