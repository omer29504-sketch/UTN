"use client";

import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BlurredCredentialTeaserProps {
  degreeLevel: string;
  universityName: string;
  graduationYear: number | string;
  major?: string | null;
  credits: number | null;
  unlocking: boolean;
  onUnlock: () => void;
  onTopUp?: () => void;
  className?: string;
}

/**
 * A purely synthetic, static certificate preview used for unpaid employers.
 *
 * It never touches the candidate's real file: the "document" is an inline SVG
 * illustration with a CSS blur, so no certificate bytes, URL, or storage key
 * can leak through it. It exists only to communicate that UTN has already
 * verified the degree and that one credit unlocks the real document.
 */
export function BlurredCredentialTeaser({
  degreeLevel,
  universityName,
  graduationYear,
  major,
  credits,
  unlocking,
  onUnlock,
  onTopUp,
  className,
}: BlurredCredentialTeaserProps) {
  const noCredits = credits !== null && credits <= 0;

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-surface-canvas", className)}>
      {/* Synthetic blurred certificate illustration — never the real file. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F2ECDF]">
        <svg
          viewBox="0 0 400 300"
          className="absolute inset-0 size-full select-none"
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter id="cert-blur" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
            <linearGradient id="cert-paper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFCF7" />
              <stop offset="100%" stopColor="#F0E8DA" />
            </linearGradient>
          </defs>
          <rect width="400" height="300" fill="url(#cert-paper)" />
          {/* Title lines */}
          <rect x="40" y="36" width="160" height="10" rx="5" fill="#C8A45D" opacity="0.55" />
          <rect x="40" y="56" width="260" height="6" rx="3" fill="#151B2E" opacity="0.18" />
          <rect x="40" y="70" width="220" height="6" rx="3" fill="#151B2E" opacity="0.14" />
          {/* Body lines */}
          {Array.from({ length: 6 }).map((_, i) => (
            <rect
              key={i}
              x="40"
              y={100 + i * 16}
              width={i === 5 ? 180 : 320}
              height="5"
              rx="2.5"
              fill="#151B2E"
              opacity="0.12"
            />
          ))}
          {/* Signature */}
          <rect x="40" y="210" width="120" height="4" rx="2" fill="#151B2E" opacity="0.22" />
          <rect x="40" y="222" width="90" height="3" rx="1.5" fill="#151B2E" opacity="0.14" />
          {/* Stamp circle */}
          <circle cx="330" cy="230" r="34" fill="none" stroke="#0E9F6E" strokeWidth="2" opacity="0.45" />
          <circle cx="330" cy="230" r="26" fill="none" stroke="#0E9F6E" strokeWidth="1" opacity="0.3" />
        </svg>

        {/* Blur veil over the synthetic document */}
        <div className="absolute inset-0 backdrop-blur-[6px] bg-[#F7F3EB]/30" aria-hidden />

        {/* UTN Verified Degree seal */}
        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-verified-emerald/40 bg-verified-emerald-soft/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-verified-emerald shadow-sm backdrop-blur-sm">
          <ShieldCheck className="size-3.5" aria-hidden />
          UTN Verified Degree
        </div>

        {/* Verified summary metadata (always visible, non-sensitive) */}
        <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-line bg-surface-card/90 p-3 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Verified credential
          </p>
          <p className="mt-0.5 truncate font-display text-sm font-bold text-ink-primary">
            {degreeLevel}
            {major ? ` · ${major}` : ""}
          </p>
          <p className="truncate text-[11px] text-ink-muted">
            {universityName} · Class of {graduationYear}
          </p>
        </div>
      </div>

      {/* Lock overlay */}
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3 rounded-xl border border-accent-gold/35 bg-accent-gold-soft/60 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-card text-accent-gold-hover ring-1 ring-inset ring-accent-gold/30">
            <Lock className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-gold-hover">
              Official university certificate &amp; PDF CV locked
            </p>
            <p className="mt-1 text-[11px] leading-5 text-ink-muted">
              Spend 1 credit to unblur and inspect the signed certificate and attached CV in the
              watermarked DRM viewer. Graduate registration and verification are always free.
            </p>
          </div>
        </div>

        {noCredits ? (
          <Button
            variant="secondary"
            onClick={onTopUp}
            className="w-full gap-2"
            disabled={!onTopUp}
          >
            <Sparkles className="size-4" aria-hidden />
            Top up credits to unlock
          </Button>
        ) : (
          <Button
            variant="emerald"
            onClick={onUnlock}
            loading={unlocking}
            className="w-full gap-2"
          >
            <Lock className="size-4" aria-hidden />
            Unlock Full Dossier (1 Credit)
          </Button>
        )}

        <p className="text-center text-[11px] text-ink-muted" aria-live="polite">
          {credits === null
            ? "Credit balance unavailable"
            : `${credits} credit${credits === 1 ? "" : "s"} remaining`}
        </p>
      </div>
    </div>
  );
}
