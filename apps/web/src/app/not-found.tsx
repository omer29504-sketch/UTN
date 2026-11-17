import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Home } from "lucide-react";
import { AuroraRibbons } from "@/components/ui/AuroraRibbons";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

const SIGNPOSTS = [
  { href: "/", label: "Home" },
  { href: "/auth/sign-in", label: "Sign in" },
  { href: "/auth/sign-up", label: "Create an account" },
];

export default function NotFound() {
  return (
    <main
      id="main"
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-jewel-ink px-5 py-20 text-white sm:px-8"
    >
      <AuroraRibbons tone="navy" fadeTo="navy" withTopography intensity="hero" />

      <div className="relative w-full max-w-xl text-center">
        <span className="border-white/12 text-champagne mx-auto grid size-14 place-items-center rounded-2xl border bg-white/[0.06] shadow-gold-hairline backdrop-blur-md">
          <Compass className="size-7" aria-hidden />
        </span>

        <p className="eyebrow text-champagne mt-6 justify-center">Error 404 · Off the map</p>

        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          This page graduated <span className="text-champagne">somewhere else.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/65">
          The link may be old, mistyped, or retired. Nothing is lost — your profile, verification,
          and conversations are exactly where you left them.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="sheen inline-flex h-12 items-center gap-2 rounded-xl bg-jewel-gold bg-[length:200%_200%] px-5 text-sm font-semibold text-brand-navy shadow-gold-hairline transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:animate-gradient-pan motion-reduce:hover:translate-y-0"
          >
            <Home className="size-4" aria-hidden />
            Back to home
          </Link>
          <Link
            href="/auth/sign-in"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] motion-reduce:hover:translate-y-0"
          >
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="jewel-line mx-auto mt-10 h-px w-24" aria-hidden />

        <nav aria-label="Helpful links" className="mt-6">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
            {SIGNPOSTS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-champagne transition">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
