import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Timer,
  Unlock,
  Video,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Navbar } from "@/components/layout/Navbar";
import { LogoMarquee } from "@/components/landing/logo-marquee";
import { GradCap } from "@/components/motion/grad-cap";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { AuroraRibbons } from "@/components/ui/AuroraRibbons";

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
    <div className="min-h-dvh bg-surface-canvas">
      <Navbar />

      <main id="main">
        {/* Hero — engraved security stock fading into the alabaster workspace. */}
        <section className="relative isolate overflow-hidden bg-brand-navy pb-44 pt-32 text-white sm:pb-52 sm:pt-40">
          <AuroraRibbons tone="navy" fadeTo="canvas" withTopography intensity="hero" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Reveal>
                <p className="eyebrow text-accent-gold">Verified talent. Real potential.</p>
              </Reveal>
              <Reveal delay={90}>
                <h1 className="mt-6 max-w-2xl font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl">
                  Hire graduates who prove it <span className="text-accent-gold">on camera.</span>
                </h1>
              </Reveal>
              <Reveal delay={180}>
                <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
                  University Talent Network is a two-sided recruitment platform where graduates
                  verify their degree once and pitch themselves in a 60–120 second live video.
                  Employers browse pitches for free and unlock full profiles for one credit.
                </p>
              </Reveal>
              <Reveal delay={270}>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/auth/sign-up"
                    className="sheen inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-sm transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-floating motion-reduce:hover:translate-y-0"
                  >
                    I&apos;m a graduate
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/10 motion-reduce:hover:translate-y-0"
                  >
                    I&apos;m hiring
                    <Building2 className="size-4" aria-hidden />
                  </Link>
                  {signedIn ? (
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 rounded-xl border border-accent-gold/40 px-5 py-3 text-sm font-semibold text-accent-gold transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-accent-gold/10 motion-reduce:hover:translate-y-0"
                    >
                      Go to dashboard
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </Reveal>
              <Reveal delay={340}>
                <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-white/50">
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="size-4 text-accent-emerald" aria-hidden />
                    Registrar-verified degrees
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Timer className="size-4 text-accent-emerald" aria-hidden />
                    60–120 second live pitch
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <LockKeyhole className="size-4 text-accent-emerald" aria-hidden />
                    Forensic DRM on every dossier
                  </span>
                </div>
              </Reveal>
            </div>

            <div className="relative hidden justify-center lg:flex">
              <div
                className="absolute inset-x-8 top-1/2 h-56 -translate-y-1/2 rounded-full bg-accent-emerald/10 blur-3xl"
                aria-hidden
              />
              <div className="relative size-64 xl:size-80">
                <GradCap className="h-full w-full" />
              </div>
            </div>
          </div>
        </section>

        {/* Trusted by marquee */}
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
          <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow">Institutional trust</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-brand-navy">
                Trusted by
              </h2>
            </div>
            <p className="text-sm text-ink-muted">Verified employers who granted logo consent</p>
          </Reveal>
          <LogoMarquee logos={logos} />
        </section>

        {/* Dual value props */}
        <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div id="for-graduates" className="scroll-mt-28">
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
            </div>
            <div id="for-employers" className="scroll-mt-28">
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
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-28 px-5 pt-20 sm:px-8">
          <Reveal>
            <p className="eyebrow">The process</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-brand-navy">
              How it works
            </h2>
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
        <section className="mx-auto max-w-6xl px-5 pt-20 sm:px-8">
          <SpotlightGlassCard className="p-8 sm:p-10">
            <Reveal>
              <p className="eyebrow">Governance</p>
              <h2 className="mt-2 font-display text-2xl font-extrabold text-brand-navy">
                Built on rules, not promises
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          </SpotlightGlassCard>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8">
          <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-brand-navy px-6 py-14 text-center text-white shadow-luxe sm:px-12 sm:py-16">
            <AuroraRibbons tone="navy" fadeTo="navy" withTopography intensity="ambient" />
            <Reveal className="relative">
              <div className="flex justify-center">
                <p className="eyebrow text-accent-gold">Begin your file</p>
              </div>
              <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
                Ready to start?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-white/65">
                Create an account in under a minute. No credit card required for candidates.
              </p>
              <div className="mt-7 flex justify-center">
                <Link
                  href="/auth/sign-up"
                  className="sheen inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-navy shadow-sm transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-floating motion-reduce:hover:translate-y-0"
                >
                  Get started
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
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
      <SpotlightGlassCard interactive className="flex h-full flex-col p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-emerald-soft text-accent-emerald ring-1 ring-inset ring-accent-emerald/15">
            <Icon className="size-6" aria-hidden />
          </span>
          <h3 className="font-display text-xl font-extrabold text-brand-navy">{title}</h3>
        </div>
        <ul className="mt-5 space-y-2">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2 text-sm text-ink-muted">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-emerald" aria-hidden />
              {point}
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
      </SpotlightGlassCard>
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
      <SpotlightGlassCard interactive className="h-full p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-accent-emerald-soft text-accent-emerald ring-1 ring-inset ring-accent-emerald/15">
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-3 font-display text-base font-extrabold text-brand-navy">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </SpotlightGlassCard>
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
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent-gold/25 bg-accent-gold-soft text-accent-gold-hover">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-navy">{title}</p>
        <p className="text-xs leading-5 text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
