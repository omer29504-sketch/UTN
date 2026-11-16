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
import { GradCap } from "@/components/motion/grad-cap";
import { Reveal } from "@/components/motion/reveal";

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
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-24 -top-24 size-[26rem] animate-aurora-drift rounded-full bg-accent-indigo/30 blur-3xl motion-reduce:animate-none" />
          <div className="absolute -bottom-32 left-1/4 size-[22rem] animate-aurora-drift rounded-full bg-verified-emerald/15 blur-3xl [animation-delay:-7s] motion-reduce:animate-none" />
        </div>

        <div className="mb-7 size-20 sm:size-24 lg:absolute lg:right-16 lg:top-16 lg:mb-0 lg:size-52">
          <GradCap className="h-full w-full" />
        </div>

        <div className="relative max-w-3xl lg:max-w-[calc(100%-16rem)]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
              Verified talent. Real potential.
            </p>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Hire graduates who prove it on camera.
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              University Talent Network is a two-sided recruitment platform where graduates verify
              their degree once and pitch themselves in a 60–120 second live video. Employers browse
              pitches for free and unlock full profiles for one credit.
            </p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-floating motion-reduce:hover:translate-y-0"
              >
                I&apos;m a graduate
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:hover:translate-y-0"
              >
                I&apos;m hiring
                <Building2 className="size-4" aria-hidden />
              </Link>
              {signedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:hover:translate-y-0"
                >
                  Go to dashboard
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trusted by marquee */}
      <section>
        <Reveal className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-extrabold text-brand-navy">Trusted by</h2>
          <p className="text-sm text-ink-muted">Verified employers who granted logo consent</p>
        </Reveal>
        <LogoMarquee logos={logos} />
      </section>

      {/* Dual value props */}
      <section className="grid gap-6 md:grid-cols-2">
        <ValueCard
          delay={0}
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
          delay={80}
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
        <Reveal>
          <h2 className="font-display text-2xl font-extrabold text-brand-navy">How it works</h2>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Step
            delay={0}
            icon={ScanFace}
            title="1. Verify degree"
            description="Upload a private certificate and run OCR-assisted admin review."
          />
          <Step
            delay={60}
            icon={Video}
            title="2. Record pitch"
            description="Live 60–120s camera pitch with teleprompter cues. Submit unlocks at 01:00."
          />
          <Step
            delay={120}
            icon={ShieldCheck}
            title="3. Get approved"
            description="An admin reviews your document and pitch before you go live."
          />
          <Step
            delay={180}
            icon={Unlock}
            title="4. Get unlocked"
            description="Employers watch pitches free; one credit reveals your full profile."
          />
        </div>
      </section>

      {/* Trust / rules */}
      <section className="rounded-3xl border border-line bg-surface-card p-8 shadow-card">
        <Reveal>
          <h2 className="font-display text-2xl font-extrabold text-brand-navy">
            Built on rules, not promises
          </h2>
        </Reveal>
        <Reveal delay={80}>
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
        </Reveal>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-navy px-8 py-12 text-center text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -right-20 -top-24 size-72 animate-aurora-drift rounded-full bg-accent-indigo/25 blur-3xl motion-reduce:animate-none" />
        </div>
        <Reveal className="relative">
          <h2 className="font-display text-3xl font-extrabold">Ready to start?</h2>
          <p className="mt-3 text-white/70">
            Create an account in under a minute. No credit card required for candidates.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-floating motion-reduce:hover:translate-y-0"
            >
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function ValueCard({
  icon: Icon,
  title,
  points,
  cta,
  delay = 0,
}: {
  icon: typeof GraduationCap;
  title: string;
  points: string[];
  cta: { href: string; label: string };
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="lift flex h-full flex-col rounded-3xl border border-line bg-surface-card p-8 shadow-card hover:border-accent-indigo/25 hover:shadow-floating">
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
        <div className="mt-auto pt-6">
          <Link
            href={cta.href}
            className="sheen inline-flex w-fit items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition duration-300 ease-out-expo hover:bg-brand-navy-soft"
          >
            {cta.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

function Step({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: typeof ScanFace;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="lift h-full rounded-2xl border border-line bg-surface-card p-5 shadow-card hover:border-accent-indigo/25 hover:shadow-floating">
        <span className="grid size-10 place-items-center rounded-xl bg-accent-indigo-soft text-accent-indigo">
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-3 font-display text-base font-extrabold text-brand-navy">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
    </Reveal>
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
