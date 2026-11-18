import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldAlert,
  Video,
} from "lucide-react";
import {
  formatPitchDuration,
  uuidSchema,
  type CandidateMedia,
  type CandidateProfile,
  type VerificationReview,
} from "@utn/shared";
import { createPresignedGetUrl, isR2Configured } from "@utn/storage";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";
import { VerificationBadge } from "@/components/verification-badge";
import { QuestionChapterPlayer } from "@/components/verification/question-chapter-player";
import { AdminDecisionPanel } from "../admin-decision-panel";
import { RegistrarVerificationPanel } from "./registrar-verification-panel";

export const metadata: Metadata = {
  title: "Review candidate",
};

export const dynamic = "force-dynamic";

async function signObject(
  bucket: "private-credentials" | "pitch-videos",
  key: string | null,
  expiresInSeconds: number,
): Promise<string | null> {
  if (!key || !isR2Configured()) return null;
  try {
    const signed = await createPresignedGetUrl({
      bucket,
      key,
      expiresInSeconds,
      responseContentDisposition: "inline",
    });
    return signed.url;
  } catch (error) {
    console.error("[admin/review] could not sign object", bucket, error);
    return null;
  }
}

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ candidateId: string }>;
}) {
  await requireRole("admin", "/admin/verification");
  const { candidateId } = await params;

  if (!uuidSchema.safeParse(candidateId).success) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: profileData }, { data: mediaData }, { data: reviewsData }] = await Promise.all([
    supabase.from("candidate_profiles").select("*").eq("user_id", candidateId).maybeSingle(),
    supabase.from("candidate_media").select("*").eq("candidate_id", candidateId).maybeSingle(),
    supabase
      .from("verification_reviews")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false }),
  ]);

  const profile = (profileData as CandidateProfile | null) ?? null;
  const media = (mediaData as CandidateMedia | null) ?? null;
  const reviews = (reviewsData ?? []) as VerificationReview[];

  if (!profile) notFound();

  const certificateUrl = await signObject(
    "private-credentials",
    media?.certificate_r2_key ?? null,
    300,
  );
  const videoUrl = await signObject("pitch-videos", media?.video_r2_key ?? null, 600);
  const isPdf = (media?.certificate_r2_key ?? "").toLowerCase().endsWith(".pdf");
  const storageReady = isR2Configured();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/verification"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition hover:text-brand-navy"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to queue
      </Link>

      <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-champagne">Candidate review</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
              {profile.full_name}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {profile.degree_level} · {profile.university_name} · Graduated{" "}
              {profile.graduation_year}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={profile.verification_status} />
            {profile.is_featured ? <Badge tone="gold">Priority Pro</Badge> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Profile claims"
              description="Compare every value with the document."
            />
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["University", profile.university_name],
                ["Degree", profile.degree_level],
                ["Graduation year", String(profile.graduation_year)],
                ["Industry", profile.industry ?? "Not provided"],
                ["Experience", `${profile.experience_years} year(s)`],
                ["Headline", profile.headline ?? "Not provided"],
                ["Phone", profile.phone ?? "Not provided"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-3 border-b border-line pb-2.5 last:border-0 last:pb-0"
                >
                  <dt className="text-xs text-ink-muted">{label}</dt>
                  <dd className="max-w-[60%] text-right text-xs font-semibold text-brand-navy">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Decision"
              description="Writes the status and an immutable audit row."
            />
            <div className="mt-4">
              <AdminDecisionPanel
                candidateId={profile.user_id}
                candidateName={profile.full_name}
                status={profile.verification_status}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Review history" description="Most recent first." />
            <ol className="mt-4 space-y-3">
              {reviews.length === 0 ? (
                <li className="text-sm text-ink-muted">No decisions yet.</li>
              ) : (
                reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-xl border border-line bg-surface-canvas p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={review.decision === "verified" ? "emerald" : "danger"}>
                        {review.decision === "verified" ? (
                          <BadgeCheck className="size-3" aria-hidden />
                        ) : (
                          <ShieldAlert className="size-3" aria-hidden />
                        )}
                        {review.decision === "verified" ? "Approved" : "Rejected"}
                      </Badge>
                      <span className="text-[11px] text-ink-muted">
                        {new Date(review.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-muted">{review.reviewer_email}</p>
                    {review.rejection_reason ? (
                      <p className="mt-1 text-xs leading-5 text-ink-primary/80">
                        {review.rejection_reason}
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Degree certificate"
              description="Private object · signed link expires in 5 minutes."
              action={
                certificateUrl ? (
                  <a
                    href={certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-card px-2.5 py-1.5 text-[11px] font-semibold text-ink-primary"
                  >
                    Open
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null
              }
            />

            <div className="mt-4">
              {!storageReady ? (
                <Alert tone="info">
                  R2 is not configured in this environment, so signed document links cannot be
                  generated.
                </Alert>
              ) : !certificateUrl ? (
                <Alert tone="warning" title="No accessible certificate">
                  The media row exists but this object could not be signed. Check the R2 bucket and
                  key.
                </Alert>
              ) : isPdf ? (
                <iframe
                  title={`Certificate for ${profile.full_name}`}
                  src={certificateUrl}
                  className="h-[420px] w-full rounded-xl border border-line bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={certificateUrl}
                  alt={`Certificate for ${profile.full_name}`}
                  className="max-h-[420px] w-full rounded-xl border border-line bg-white object-contain"
                />
              )}
            </div>
          </Card>

          <RegistrarVerificationPanel
            candidateName={profile.full_name}
            universityName={profile.university_name}
            degreeLevel={profile.degree_level}
            graduationYear={profile.graduation_year}
            certificateVerificationRef={profile.certificate_verification_ref}
            registrarConsentGiven={profile.registrar_consent_given}
            registrarConsentAt={profile.registrar_consent_at}
          />

          <Card>
            <CardHeader
              title="Extracted text"
              description="tesseract.js output for images. PDFs are read manually."
              action={<Badge tone={media?.ocr_extracted_text ? "emerald" : "neutral"}>OCR</Badge>}
            />
            <div className="mt-4">
              {media?.ocr_extracted_text ? (
                <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-canvas p-3 font-mono text-[11px] leading-5 text-ink-primary/80">
                  {media.ocr_extracted_text}
                </pre>
              ) : (
                <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-canvas p-3 text-xs leading-5 text-ink-muted">
                  <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                  No extracted text on file. Read the certificate directly and compare the degree
                  title, institution, and graduate name.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Live pitch"
              description={
                media?.video_duration_seconds
                  ? `${formatPitchDuration(media.video_duration_seconds)} · camera-only recording · signed link expires in 10 minutes.`
                  : "Signed link expires in 10 minutes."
              }
              action={<Video className="size-4 text-accent-emerald-hover" aria-hidden />}
            />
            <div className="mt-4">
              {videoUrl ? (
                <QuestionChapterPlayer
                  src={videoUrl}
                  questions={media?.video_session_questions ?? null}
                  durationSeconds={media?.video_duration_seconds ?? null}
                  title={`Assessment video for ${profile.full_name}`}
                />
              ) : (
                <Alert tone="warning" title="No playable pitch">
                  {storageReady
                    ? "The pitch object could not be signed. Check the R2 bucket and key."
                    : "Configure R2 to review pitch videos."}
                </Alert>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
              <LockKeyhole className="size-3" aria-hidden />
              Never share signed links outside the review team.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
