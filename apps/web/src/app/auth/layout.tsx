import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, LockKeyhole, Video } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

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
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent-indigo/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-verified-emerald/20 blur-3xl"
          aria-hidden
        />
        <BrandMark inverted />
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
            Verified talent. Real potential.
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white">
            Prove your degree once. Let your pitch do the talking.
          </h1>
          <div className="mt-10 space-y-5">
            {highlights.map((item) => (
              <div key={item.title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/55">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">
          University Talent Network · Phase 2
        </p>
      </aside>

      <div className="flex flex-col bg-surface-canvas">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <BrandMark href="/" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-white hover:text-brand-navy"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to home
          </Link>
        </div>
        <main id="main" className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
