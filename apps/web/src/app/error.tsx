"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { AuroraRibbons } from "@/components/ui/AuroraRibbons";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle support has on a production stack trace.
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <main
      id="main"
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-jewel-ink px-5 py-20 text-white sm:px-8"
    >
      <AuroraRibbons tone="navy" fadeTo="navy" withTopography intensity="hero" />

      <div className="relative w-full max-w-xl text-center">
        <span className="border-white/12 text-champagne mx-auto grid size-14 place-items-center rounded-2xl border bg-white/[0.06] shadow-gold-hairline backdrop-blur-md">
          <TriangleAlert className="size-7" aria-hidden />
        </span>

        <p className="eyebrow text-champagne mt-6 justify-center">Unexpected turn</p>

        <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Something slipped <span className="text-champagne">out of the frame.</span>
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/65">
          This screen hit an error before it finished loading. Your data is safe — try again, and if
          it keeps happening the reference below helps us trace it.
        </p>

        {error.digest ? (
          <p className="border-white/12 mt-5 inline-flex items-center gap-2 rounded-lg border bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] tracking-wide text-white/60">
            <span className="uppercase tracking-[0.14em] text-white/40">Ref</span>
            {error.digest}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="sheen inline-flex h-12 items-center gap-2 rounded-xl bg-jewel-gold bg-[length:200%_200%] px-5 text-sm font-semibold text-brand-navy shadow-gold-hairline transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:animate-gradient-pan motion-reduce:hover:translate-y-0"
          >
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 text-sm font-semibold text-white transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] motion-reduce:hover:translate-y-0"
          >
            <Home className="size-4" aria-hidden />
            Back to home
          </Link>
        </div>

        <div className="jewel-line mx-auto mt-10 h-px w-24" aria-hidden />
      </div>
    </main>
  );
}
