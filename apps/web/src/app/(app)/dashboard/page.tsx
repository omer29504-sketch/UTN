import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileText,
  ScanFace,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { formatPitchDuration } from "@utn/shared";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VerificationBadge } from "@/components/verification-badge";
import { Alert } from "@/components/ui/alert";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";

export const dynamic = "force-dynamic";

/** Compact dark stat tile that lives inside the engraved hero banner. */
function HeroStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof BadgeCheck;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <SpotlightGlassCard tone="dark" className="p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/65">
        <Icon className="size-3.5 text-accent-emerald" aria-hidden />
        {label}
      </div>
      <p className="mt-2 font-display text-xl font-extrabold leading-tight text-white">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-white/60">{hint}</p>
    </SpotlightGlassCard>
  );
}

function HeroShell({
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
      <TopographicHeroBg fadeTo="navy" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-champagne">{eyebrow}</p>
            <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
              {title}
            </h1>
            <div className="mt-2 max-w-xl text-sm leading-6 text-white/60">{description}</div>
          </div>
          {badge}
        </div>
        {children}
      </div>
    </section>
  );
}

async function CandidateOverview({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: profile }, { data: media }, { data: reviews }, { count: viewCount }] =
    await Promise.all([
      supabase.from("candidate_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("candidate_media").select("*").eq("candidate_id", userId).maybeSingle(),
      supabase
        .from("verification_reviews")
        .select("decision, rejection_reason, created_at")
        .eq("candidate_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("candidate_profile_views")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", userId),
    ]);

  if (!profile) {
    return (
      <SpotlightGlassCard className="animate-slide-in p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-emerald-soft text-accent-emerald-hover ring-1 ring-inset ring-accent-emerald/15">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-brand-navy">
          Finish your candidate profile
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          Tell employers about your degree and target role. Once your profile is saved you can
          upload your certificate and record your live pitch.
        </p>
        <Link
          href="/candidate/profile"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-navy-soft"
        >
          Complete profile
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </SpotlightGlassCard>
    );
  }

  const latestReview = reviews?.[0];
  const status = profile.verification_status as "unverified" | "pending" | "verified" | "rejected";
  const displayName = profile.full_name ?? fullName ?? "there";

  const checklist = [
    {
      label: "Profile details",
      done: true,
      hint: `${profile.degree_level} · ${profile.university_name}`,
    },
    {
      label: "Private certificate",
      done: Boolean(media?.certificate_r2_key),
      hint: media?.certificate_r2_key ? "Uploaded securely" : "PDF, JPG, or PNG",
    },
    {
      label: "Live pitch video",
      done: Boolean(media?.video_r2_key),
      hint:
        media?.video_duration_seconds != null
          ? formatPitchDuration(media.video_duration_seconds)
          : "60–120 seconds, camera only",
    },
    {
      label: "Admin decision",
      done: status === "verified",
      hint:
        status === "rejected"
          ? "Changes requested"
          : status === "pending"
            ? "In the review queue"
            : status === "verified"
              ? "Approved"
              : "Not submitted yet",
    },
  ];

  return (
    <div className="space-y-6">
      <Reveal>
        <HeroShell
          eyebrow="Candidate dashboard"
          title={`Welcome back, ${displayName.split(" ")[0]}`}
          description={
            status === "verified"
              ? "Your profile is verified. Employers can watch your pitch and unlock your contact details."
              : status === "pending"
                ? "Your documents are with the review team. We will notify you when a decision is made."
                : status === "rejected"
                  ? "The reviewer asked for changes. Update your documents and resubmit when ready."
                  : "Complete your verification to become discoverable to employers."
          }
          badge={<VerificationBadge status={status} />}
        >
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/candidate/verification"
              className="inline-flex items-center gap-2 rounded-xl bg-jewel-gold bg-[length:200%_200%] px-4 py-2.5 text-sm font-semibold text-brand-navy shadow-gold-hairline transition hover:animate-gradient-pan"
            >
              <ScanFace className="size-4" aria-hidden />
              {status === "unverified" || status === "rejected"
                ? "Continue verification"
                : "View verification"}
            </Link>
            <Link
              href="/candidate/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Edit profile
            </Link>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat
              icon={ScanFace}
              label="Verification"
              value={
                status === "verified"
                  ? "Verified"
                  : status === "pending"
                    ? "In review"
                    : status === "rejected"
                      ? "Action needed"
                      : "Not started"
              }
              hint="University document + live pitch"
            />
            <HeroStat
              icon={Video}
              label="Pitch length"
              value={
                media?.video_duration_seconds
                  ? formatPitchDuration(media.video_duration_seconds)
                  : "—"
              }
              hint="Must stay between 01:00 and 02:00"
            />
            <HeroStat
              icon={Sparkles}
              label="Profile views"
              value={String(viewCount ?? 0)}
              hint={
                profile?.is_featured
                  ? "Priority Pro analytics"
                  : "Upgrade to Priority Pro for analytics"
              }
            />
            <HeroStat
              icon={FileText}
              label="Submission"
              value={media?.submitted_at ? "Submitted" : "Draft"}
              hint={
                latestReview
                  ? `Last decision ${new Date(latestReview.created_at).toLocaleDateString()}`
                  : "No review decisions yet"
              }
            />
          </div>
        </HeroShell>
      </Reveal>

      {status === "rejected" && profile.rejection_reason ? (
        <Alert tone="error" title="Changes requested">
          {profile.rejection_reason}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Verification checklist"
          description="Every gate must be complete before an admin can approve your profile."
        />
        <ol className="mt-5 space-y-3">
          {checklist.map((item, index) => (
            <li
              key={item.label}
              className="flex animate-slide-in items-center gap-3 rounded-xl border border-line bg-surface-canvas px-4 py-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  item.done
                    ? "animate-check-pop bg-verified-emerald text-white"
                    : "bg-surface-card text-ink-muted ring-1 ring-line"
                }`}
              >
                {item.done ? <BadgeCheck className="size-4" aria-hidden /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-navy">{item.label}</p>
                <p className="truncate text-xs text-ink-muted">{item.hint}</p>
              </div>
              <Badge tone={item.done ? "emerald" : "neutral"}>
                {item.done ? "Complete" : "Pending"}
              </Badge>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

async function EmployerOverview({ userId }: { userId: string }) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ data: company }, { data: balance }] = await Promise.all([
    supabase.from("companies").select("*").eq("owner_id", userId).maybeSingle(),
    supabase.rpc("get_my_credit_balance"),
  ]);

  if (!company) {
    return (
      <SpotlightGlassCard className="animate-slide-in p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-emerald-soft text-accent-emerald-hover ring-1 ring-inset ring-accent-emerald/15">
          <Building2 className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-brand-navy">
          Set up your company
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          Confirm your company name and logo consent. Your corporate email domain is verified
          automatically, and two trial credits are granted once per company.
        </p>
        <Link
          href="/employer/company"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create company profile
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </SpotlightGlassCard>
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <HeroShell
          eyebrow="Employer workspace"
          title={company.company_name}
          description={`${company.corporate_domain} · ${
            company.is_verified ? "Company verified" : "Verification pending"
          }`}
          badge={
            <Badge tone={company.is_verified ? "emerald" : "warning"}>
              {company.is_verified ? "Verified employer" : "Unverified employer"}
            </Badge>
          }
        >
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <HeroStat
              icon={Sparkles}
              label="Credit balance"
              value={
                <>
                  <CountUp value={Number(balance ?? 0)} /> credits
                </>
              }
              hint="Two trial credits are granted at company creation"
            />
            <HeroStat
              icon={Building2}
              label="Corporate domain"
              value={company.corporate_domain}
              hint="Locked to your work email"
            />
            <HeroStat
              icon={BadgeCheck}
              label="Logo consent"
              value={company.display_logo_consent ? "Opted in" : "Opted out"}
              hint="Controls the public landing-page marquee"
            />
          </div>
        </HeroShell>
      </Reveal>

      <Card>
        <CardHeader
          title="Candidate discovery"
          description="Search verified graduates, watch their pitches for free, and unlock full profiles."
          action={
            <Link
              href="/employer/candidates"
              className="inline-flex items-center gap-2 rounded-lg bg-jewel-ink px-3 py-2 text-xs font-semibold text-white"
            >
              Open search
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/employer/candidates"
            className="inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Search className="size-4" aria-hidden />
            Search candidates
          </Link>
          <Link
            href="/employer/billing"
            className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-surface-muted"
          >
            <CreditCard className="size-4" aria-hidden />
            Buy credits
          </Link>
        </div>
      </Card>
    </div>
  );
}

async function AdminOverview() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const [{ count: pendingCount }, { data: recentReviews }] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("verification_status", "pending"),
    supabase
      .from("verification_reviews")
      .select("id, decision, reviewer_email, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-6">
      <Reveal>
        <HeroShell
          eyebrow="Admin workspace"
          title="Verification review"
          description="Check each candidate's degree document against their profile and 60–120 second pitch, then record a decision with an audit trail."
        >
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <HeroStat
              icon={ClipboardCheck}
              label="Pending reviews"
              value={String(pendingCount ?? 0)}
              hint="Candidates waiting for a decision"
            />
            <HeroStat
              icon={BadgeCheck}
              label="Recent decisions"
              value={String(recentReviews?.length ?? 0)}
              hint="Latest review history entries"
            />
          </div>
        </HeroShell>
      </Reveal>

      <Card>
        <CardHeader
          title="Review queue"
          description="Open a candidate to inspect the certificate, OCR text, and pitch video."
          action={
            <Link
              href="/admin/verification"
              className="inline-flex items-center gap-2 rounded-lg bg-jewel-ink px-3 py-2 text-xs font-semibold text-white"
            >
              Open queue
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <ul className="mt-5 divide-y divide-line">
          {(recentReviews ?? []).length === 0 ? (
            <li className="py-4 text-sm text-ink-muted">No decisions recorded yet.</li>
          ) : (
            (recentReviews ?? []).map((review, index) => (
              <li
                key={review.id}
                className="flex animate-slide-in items-center justify-between gap-3 py-3"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div>
                  <p className="text-sm font-semibold capitalize text-brand-navy">
                    {review.decision}
                  </p>
                  <p className="text-xs text-ink-muted">{review.reviewer_email}</p>
                </div>
                <span className="text-xs text-ink-muted">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireSession("/dashboard");

  if (session.profile.role === "candidate") {
    return <CandidateOverview userId={session.user.id} fullName={session.user.fullName} />;
  }

  if (session.profile.role === "employer") {
    return <EmployerOverview userId={session.user.id} />;
  }

  return <AdminOverview />;
}
