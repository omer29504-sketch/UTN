import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Play,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Timer,
  Unlock,
  Video,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface MarqueeRow {
  id: string;
  company_name: string;
  logo_r2_key: string | null;
  created_at: string;
}

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient();
  let signedIn = false;
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data?.user);
  }
  let logos: { id: string; name: string; logoUrl: string | null }[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("company_marquee")
      .select("id, company_name, logo_r2_key, created_at")
      .limit(40);
    const rows = (data ?? []) as MarqueeRow[];
    logos = rows.map((row) => ({
      id: row.id,
      name: row.company_name,
      logoUrl:
        row.logo_r2_key && env.publicLogosBaseUrl
          ? `${env.publicLogosBaseUrl}/${row.logo_r2_key
              .split("/")
              .map((s) => encodeURIComponent(s))
              .join("/")}`
          : null,
    }));
  }

  return (
    <div className="space-y-20 pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-brand-navy px-6 py-16 text-white shadow-card sm:px-12 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.35),transparent_55%)]" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
            Verified talent. Real potential.
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Hire graduates who prove it on camera.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
            University Talent Network is a two-sided recruitment platform where graduates verify
            their degree once and pitch themselves in a 60–120 second live video. Employers browse
            pitches for free and unlock full profiles for one credit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-white/90"
            >
              I&apos;m a graduate
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              I&apos;m hiring
              <Building2 className="size-4" aria-hidden />
            </Link>
            {signedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Go to dashboard
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Trusted by marquee */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold text-brand-navy">Trusted by</h2>
          <p className="text-sm text-ink-muted">Verified employers who granted logo consent</p>
        </div>
        <LogoMarquee logos={logos} />
      </section>

      {/* Dual value props */}
      <section className="grid gap-6 md:grid-cols-2">
        <ValueCard
          icon={GraduationCap}
          title="For graduates"
          points={[
            "Verify your degree once with a private certificate.",
            "Record a 60–120s live pitch — no gallery uploads.",
            "Get discovered by verified employers.",
            "Optional Priority Pro pins you higher in search.",
          ]}
          cta={{ href: "/auth/sign-up", label: "Create candidate account" }}
        />
        <ValueCard
          icon={Building2}
          title="For employers"
          points={[
            "Register with a corporate email — free consumer domains blocked.",
            "2 free trial unlock credits on signup.",
            "Watch every pitch video for free.",
            "Pay 1 credit to unlock full contact, certificate, and chat.",
          ]}
          cta={{ href: "/auth/sign-up", label: "Create employer account" }}
        />
      </section>

      {/* How it works */}
      <section>
        <h2 className="font-display text-2xl font-extrabold text-brand-navy">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Step
            icon={ScanFace}
            title="1. Verify degree"
            description="Upload a private certificate and run OCR-assisted admin review."
          />
          <Step
            icon={Video}
            title="2. Record pitch"
            description="Live 60–120s camera pitch with teleprompter cues. Submit unlocks at 01:00."
          />
          <Step
            icon={ShieldCheck}
            title="3. Get approved"
            description="An admin reviews your document and pitch before you go live."
          />
          <Step
            icon={Unlock}
            title="4. Get unlocked"
            description="Employers watch pitches free; one credit reveals your full profile."
          />
        </div>
      </section>

      {/* Trust / rules */}
      <section className="rounded-3xl border border-line bg-surface-card p-8 shadow-card">
        <h2 className="font-display text-2xl font-extrabold text-brand-navy">Built on rules, not promises</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Rule
            icon={Timer}
            title="60–120s pitch"
            description="Submit locked below 01:00; auto-stops at 02:00. Camera only."
          />
          <Rule
            icon={LockKeyhole}
            title="Private credentials"
            description="Certificates never get a public URL. Short-lived signed links only."
          />
          <Rule
            icon={BadgeCheck}
            title="Atomic unlocks"
            description="Credit spending is transactional and idempotent."
          />
          <Rule
            icon={Clock3}
            title="Realtime chat"
            description="Direct messaging opens only after an unlock."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-3xl bg-brand-navy px-8 py-12 text-center text-white">
        <h2 className="font-display text-3xl font-extrabold">Ready to start?</h2>
        <p className="mt-3 text-white/70">
          Create an account in under a minute. No credit card required for candidates.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition hover:bg-white/90"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ValueCard({
  icon: Icon,
  title,
  points,
  cta,
}: {
  icon: typeof GraduationCap;
  title: string;
  points: string[];
  cta: { href: string; label: string };
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface-card p-8 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-indigo-soft text-accent-indigo">
          <Icon className="size-6" aria-hidden />
        </span>
        <h3 className="font-display text-xl font-extrabold text-brand-navy">{title}</h3>
      </div>
      <ul className="mt-5 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-ink-muted">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-verified-emerald" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white"
      >
        {cta.label}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function Step({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ScanFace;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-card p-5 shadow-card">
      <span className="grid size-10 place-items-center rounded-xl bg-accent-indigo-soft text-accent-indigo">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-3 font-display text-base font-extrabold text-brand-navy">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function Rule({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Timer;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-indigo-soft text-accent-indigo">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-navy">{title}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
