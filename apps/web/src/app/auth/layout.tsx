import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole, Video } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { GradCap } from "@/components/motion/grad-cap";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { AuroraRibbons } from "@/components/ui/AuroraRibbons";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account",
};

const highlights = [
  {
    icon: LockKeyhole,
    title: "Documents stay private",
    body: "Certificates are only visible to you and the review team.",
  },
  {
    icon: Video,
    title: "One 60–120 second pitch",
    body: "Recorded live in the browser. No gallery uploads, no edits.",
  },
  {
    icon: BadgeCheck,
    title: "Verified once, trusted everywhere",
    body: "Employers see the badge before they ever see your details.",
  },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-brand-navy p-10 lg:flex lg:flex-col lg:justify-between">
        <AuroraRibbons tone="navy" fadeTo="navy" withTopography intensity="hero" />

        <div className="relative">
          <BrandMark inverted />
        </div>

        <div className="relative max-w-md">
          <div className="mb-8 size-16 xl:size-20">
            <GradCap className="h-full w-full" />
          </div>
          <Reveal>
            <p className="eyebrow text-champagne">Verified talent. Real potential.</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-white">
              Prove your degree once.{" "}
              <span className="text-champagne">Let your pitch do the talking.</span>
            </h1>
          </Reveal>
          <div className="mt-10 space-y-3">
            {highlights.map((item, index) => {
              const tones = [
                "border-accent-emerald/30 bg-accent-emerald/10 text-accent-emerald",
                "border-accent-sapphire/30 bg-accent-sapphire/10 text-accent-sapphire",
                "border-accent-gold/30 bg-accent-gold/10 text-accent-gold",
              ];
              return (
                <Reveal key={item.title} delay={160 + index * 70}>
                  <div className="jewel-border relative flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-md">
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-xl border",
                        tones[index % tones.length],
                      )}
                    >
                      <item.icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-white/55">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <p className="relative text-xs text-white/60">
          University Talent Network · Private by design
        </p>
      </aside>

      <div className="relative flex flex-col overflow-hidden bg-surface-canvas">
        <div
          aria-hidden
          className="aurora-wash pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        />
        <div
          className="bg-luxury-grain pointer-events-none absolute inset-0 opacity-60"
          aria-hidden
        />

        <div className="relative flex items-center justify-between px-5 py-5 sm:px-8">
          <BrandMark href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-surface-card hover:text-ink-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to home
          </Link>
        </div>

        <main
          id="main"
          className="relative flex flex-1 items-center justify-center px-5 pb-12 sm:px-8"
        >
          <div className="w-full max-w-md">
            <SpotlightGlassCard className="jewel-border relative p-6 sm:p-8">
              {children}
            </SpotlightGlassCard>
          </div>
        </main>
      </div>
    </div>
  );
}
