"use client";

import { GraduationCap, Lock, Play, ShieldCheck, Sparkles, Unlock } from "lucide-react";
import type { EmployerCandidateCard } from "@utn/shared";
import { formatPitchDuration } from "@utn/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  candidate: EmployerCandidateCard;
  /** Opens the dossier drawer on the summary panel. */
  onOpen: () => void;
  /** Opens the dossier drawer and starts the pitch. */
  onPlay: () => void;
  /** True while this candidate owns the open drawer. */
  active?: boolean;
}

/**
 * Employer talent-grid card.
 *
 * Deliberately carries exactly three scannable signals and nothing else:
 *   1. Trust  — verified degree, institution, emerald seal.
 *   2. Focus  — industry tag, class year, experience.
 *   3. Human  — pitch stage with duration and an explicit play trigger.
 *
 * Accreditation detail, OCR summaries, audit references, contact fields and
 * the certificate viewer live in the dossier drawer, so the grid never turns
 * into a wall of metadata.
 */
export function CandidateCard({ candidate, onOpen, onPlay, active }: Props) {
  const unlocked = candidate.is_unlocked;
  const displayName = unlocked
    ? (candidate.full_name ?? candidate.display_name)
    : candidate.display_name;
  const duration = candidate.video_duration_seconds
    ? formatPitchDuration(candidate.video_duration_seconds)
    : null;
  const initials = displayName
    .replace(/^Verified Candidate #?/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  // The whole card is one button, so its name carries all three signals for
  // screen-reader users instead of only the candidate label.
  const cardSignals = [
    `Verified ${candidate.degree_level} at ${candidate.university_name}`,
    candidate.industry,
    `Class of ${candidate.graduation_year}`,
    duration ? `pitch ${duration}` : "no pitch submitted",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article
      className={cn(
        "group atelier-card-hover relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-sm",
        active && "border-accent-emerald/50",
      )}
    >
      {/* The whole card is one target; the play control sits above it. */}
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/60 focus-visible:ring-offset-2"
        aria-label={`Open dossier for ${displayName}. ${cardSignals}`}
      />

      {/* Signal 3 — human: pitch stage, duration, explicit play. */}
      <div className="pointer-events-none relative z-10 aspect-[16/10] w-full overflow-hidden bg-studio-obsidian">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,#1E2740_0%,#0E1424_52%,#070B16_100%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center font-display text-4xl font-extrabold tracking-tight text-white/10"
        >
          {initials || "UTN"}
        </span>

        {candidate.is_featured ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-accent-gold/40 bg-[#070F24]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E9CF96] backdrop-blur-sm">
            <Sparkles className="size-3" aria-hidden />
            Priority Pro
          </span>
        ) : null}

        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#070F24]/70 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur-sm">
          {unlocked ? (
            <>
              <Unlock className="size-3 text-[#6EE7B7]" aria-hidden />
              Unlocked
            </>
          ) : (
            <>
              <Lock className="size-3" aria-hidden />
              Locked
            </>
          )}
        </span>

        <button
          type="button"
          onClick={onPlay}
          disabled={!candidate.video_r2_key}
          className="tactile-press pointer-events-auto absolute left-1/2 top-1/2 z-20 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1424] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={
            duration
              ? `Play ${displayName}'s pitch, ${duration}`
              : `Play ${displayName}'s pitch`
          }
        >
          <Play className="size-5 translate-x-px" aria-hidden />
        </button>

        {duration ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-[#070F24]/80 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-sm">
            {duration}
          </span>
        ) : (
          <span className="absolute bottom-3 right-3 rounded-md bg-[#070F24]/80 px-2 py-0.5 text-[10px] font-semibold text-white/70 backdrop-blur-sm">
            No pitch
          </span>
        )}
      </div>

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col gap-3 p-4">
        <h3 className="truncate font-display text-base font-bold text-ink-primary">
          {displayName}
        </h3>

        {/* Signal 1 — trust & institution. */}
        <div className="flex items-start gap-2">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-verified-emerald"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-primary">
              Verified {candidate.degree_level}
            </p>
            <p className="truncate text-xs text-ink-muted">{candidate.university_name}</p>
          </div>
        </div>

        {/* Signal 2 — focus & readiness. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.industry ? (
            <Badge tone="sapphire">{candidate.industry}</Badge>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted">
            <GraduationCap className="size-3" aria-hidden />
            Class of {candidate.graduation_year}
          </span>
          <span className="rounded-full border border-line bg-surface-canvas px-2.5 py-1 text-[11px] font-medium text-ink-muted">
            {candidate.experience_years} yr{candidate.experience_years === 1 ? "" : "s"} exp
          </span>
        </div>

        <p className="mt-auto flex items-center gap-1 text-[11px] font-semibold text-accent-emerald-hover opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:opacity-100">
          Open dossier
          <span aria-hidden>→</span>
        </p>
      </div>
    </article>
  );
}
