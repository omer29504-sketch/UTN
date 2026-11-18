"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  FileCheck2,
  Loader2,
  Lock,
  Mail,
  Phone,
  Play,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import type { EmployerCandidateCard } from "@utn/shared";
import { formatPitchDuration } from "@utn/shared";
import { authFetch, readApiError } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/chat-thread";
import {
  SecureCertificateViewer,
  type EmployerViewerIdentity,
} from "@/components/employer/secure-certificate-viewer";
import { QuestionChapterPlayer } from "@/components/verification/question-chapter-player";
import { cn } from "@/lib/utils";

const SLIDE_MS = 320;

export interface CandidateDossierDrawerProps {
  candidates: EmployerCandidateCard[];
  index: number;
  companyId: string;
  employer: EmployerViewerIdentity;
  /** Live company credit balance, refreshed by the server after each unlock. */
  credits: number | null;
  /** True when the drawer was opened from a card's play control. */
  autoPlay: boolean;
  onClose: () => void;
  onStep: (index: number) => void;
  onUnlocked: (candidateId: string, balance: number | null) => void;
}

/**
 * Playlist-style candidate dossier.
 *
 * A right-hand slide-over that keeps the search grid, filters and scroll
 * position intact underneath. Employers can step candidate-to-candidate with
 * ↑/K and ↓/J without ever closing the panel.
 */
export function CandidateDossierDrawer({
  candidates,
  index,
  companyId,
  employer,
  credits,
  autoPlay,
  onClose,
  onStep,
  onUnlocked,
}: CandidateDossierDrawerProps) {
  const candidate = candidates[index];
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const closingRef = useRef(false);

  const [phase, setPhase] = useState<"enter" | "open" | "exit">("enter");

  const canPrev = index > 0;
  const canNext = index < candidates.length - 1;

  // Keep stepping state in refs so the focus trap mounts once and never
  // re-runs (and re-restores focus) when the employer steps candidates.
  const stepStateRef = useRef({ index, total: candidates.length });
  stepStateRef.current = { index, total: candidates.length };
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("exit");
    window.setTimeout(() => closeRef.current(), SLIDE_MS);
  }, []);

  const step = useCallback((delta: -1 | 1) => {
    const { index: current, total } = stepStateRef.current;
    const next = current + delta;
    if (next < 0 || next >= total) return;
    onStepRef.current(next);
  }, []);

  // Enter animation: mount translated off-screen, then settle in on the next frame.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Lock the page behind the drawer without moving the scroll position.
  useEffect(() => {
    const { body, documentElement } = document;
    const scrollbar = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, []);

  // Focus trap, Escape to close, and ↑/K ↓/J playlist stepping.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const opener = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    panel.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key === "Tab") {
        const items = focusable();
        if (items.length === 0) {
          event.preventDefault();
          panel?.focus();
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        // If focus fell to the body (e.g. after stepping remounted the body),
        // pull it back to the nearest edge of the dialog.
        if (!items.includes(active as HTMLElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
          return;
        }
        if (event.shiftKey && (active === first || active === panel)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.tagName === "VIDEO" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "k") {
        event.preventDefault();
        step(-1);
      } else if (key === "arrowdown" || key === "j") {
        event.preventDefault();
        step(1);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the exact card control that opened the dossier.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [panelRef, requestClose, step]);

  if (!candidate) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close candidate dossier"
        onClick={requestClose}
        tabIndex={-1}
        className={cn(
          "absolute inset-0 bg-[#070F24]/30 backdrop-blur-[2px] transition-opacity duration-[320ms] ease-[var(--ease-luxury)]",
          phase === "open" ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-surface-card shadow-floating outline-none transition-transform duration-[320ms] ease-[var(--ease-luxury)]",
          phase === "open" ? "translate-x-0" : "translate-x-full",
        )}
      >
        <DossierBody
          key={candidate.candidate_id}
          candidate={candidate}
          index={index}
          total={candidates.length}
          titleId={titleId}
          companyId={companyId}
          employer={employer}
          credits={credits}
          autoPlay={autoPlay}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={requestClose}
          onUnlocked={onUnlocked}
        />
      </div>
    </div>
  );
}

function DossierBody({
  candidate,
  index,
  total,
  titleId,
  companyId,
  employer,
  credits,
  autoPlay,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
  onUnlocked,
}: {
  candidate: EmployerCandidateCard;
  index: number;
  total: number;
  titleId: string;
  companyId: string;
  employer: EmployerViewerIdentity;
  credits: number | null;
  autoPlay: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onUnlocked: (candidateId: string, balance: number | null) => void;
}) {
  const detailsId = useId();

  const [unlocked, setUnlocked] = useState(candidate.is_unlocked);
  const [balance, setBalance] = useState<number | null>(credits);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const displayName = unlocked
    ? (candidate.full_name ?? candidate.display_name)
    : candidate.display_name;
  const duration = candidate.video_duration_seconds
    ? formatPitchDuration(candidate.video_duration_seconds)
    : null;

  useEffect(() => {
    setBalance(credits);
  }, [credits]);

  useEffect(() => {
    if (!candidate.video_r2_key) return;
    let cancelled = false;
    setVideoLoading(true);
    setVideoError(null);

    void (async () => {
      try {
        const res = await authFetch("/api/storage/presign", {
          method: "POST",
          body: JSON.stringify({
            intent: "download",
            bucket: "pitch-videos",
            key: candidate.video_r2_key,
          }),
        });
        if (!res.ok) {
          if (!cancelled) setVideoError(await readApiError(res));
          return;
        }
        const body = (await res.json()) as { url: string };
        if (!cancelled) setVideoUrl(body.url);
      } catch (error) {
        if (!cancelled) {
          setVideoError(error instanceof Error ? error.message : "Could not load the pitch.");
        }
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candidate.video_r2_key]);

  async function handleUnlock() {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await authFetch("/api/employer/unlock", {
        method: "POST",
        body: JSON.stringify({ companyId, candidateId: candidate.candidate_id }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        creditBalance?: number | null;
        message?: string;
      };
      if (!res.ok) {
        setUnlockError(await readApiError(res));
        return;
      }
      if (body.success) {
        setUnlocked(true);
        setBalance(body.creditBalance ?? null);
        onUnlocked(candidate.candidate_id, body.creditBalance ?? null);
      } else {
        setUnlockError(body.message ?? "Unlock failed.");
      }
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Unlock failed.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface-card/95 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-gold-hover">
              Candidate dossier · {index + 1} of {total}
            </p>
            <h2
              id={titleId}
              className="mt-1 flex items-center gap-2 truncate font-display text-xl font-extrabold tracking-tight text-ink-primary"
            >
              {unlocked ? (
                <Unlock className="size-4 shrink-0 text-verified-emerald" aria-hidden />
              ) : (
                <Lock className="size-4 shrink-0 text-ink-muted" aria-hidden />
              )}
              <span className="truncate">{displayName}</span>
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="emerald">
                <ShieldCheck className="size-3" aria-hidden />
                Verified {candidate.degree_level}
              </Badge>
              <span className="truncate text-xs text-ink-muted">{candidate.university_name}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Previous candidate"
              aria-keyshortcuts="ArrowUp K"
              title="Previous candidate (↑ or K)"
              className="tactile-press grid size-11 place-items-center rounded-xl border border-line bg-surface-canvas text-ink-primary hover:border-accent-emerald/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next candidate"
              aria-keyshortcuts="ArrowDown J"
              title="Next candidate (↓ or J)"
              className="tactile-press grid size-11 place-items-center rounded-xl border border-line bg-surface-canvas text-ink-primary hover:border-accent-emerald/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dossier"
              className="tactile-press ml-1 grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/50 focus-visible:ring-offset-2"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <div className="space-y-5">
          {/* Primary media stage */}
          <section aria-label="Pitch video">
            {videoUrl ? (
              <QuestionChapterPlayer
                src={videoUrl}
                questions={candidate.video_session_questions ?? null}
                durationSeconds={candidate.video_duration_seconds}
                title={`Assessment video for ${displayName}`}
                autoPlay={autoPlay}
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-line bg-studio-obsidian">
                <div className="relative grid aspect-video w-full place-items-center bg-[radial-gradient(circle_at_50%_18%,#1E2740_0%,#0E1424_52%,#070B16_100%)]">
                  {videoLoading ? (
                    <span className="flex items-center gap-2 text-sm text-white/70">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading pitch…
                    </span>
                  ) : candidate.video_r2_key ? (
                    <span className="flex flex-col items-center gap-2 text-white/70">
                      <Play className="size-7" aria-hidden />
                      <span className="text-xs">Pitch unavailable right now</span>
                    </span>
                  ) : (
                    <span className="text-xs text-white/60">No pitch video submitted</span>
                  )}
                </div>
              </div>
            )}
            {videoError ? (
              <p className="mt-2 text-xs text-danger" role="status">
                {videoError}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              <Badge tone="neutral">{duration ?? "No duration"}</Badge>
              <span>Camera-only, unedited take.</span>
            </div>
          </section>

          {/* Progressive disclosure: credential detail */}
          <section className="rounded-2xl border border-line bg-surface-canvas">
            <button
              type="button"
              onClick={() => setDetailsOpen((value) => !value)}
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              className="tactile-press flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/50 focus-visible:ring-inset"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                <FileCheck2 className="size-4 text-accent-emerald-hover" aria-hidden />
                Credential &amp; verification details
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-ink-muted transition-transform duration-200",
                  detailsOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            <div
              id={detailsId}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-[var(--ease-luxury)]",
                detailsOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-line px-4 py-4">
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <Detail label="Institution" value={candidate.university_name} />
                    <Detail label="Credential" value={candidate.degree_level} />
                    <Detail label="Class of" value={String(candidate.graduation_year)} />
                    <Detail
                      label="Experience"
                      value={`${candidate.experience_years} yr${candidate.experience_years === 1 ? "" : "s"}`}
                    />
                    {candidate.industry ? (
                      <Detail label="Industry" value={candidate.industry} />
                    ) : null}
                    <Detail
                      label="Verification ref"
                      value={`UTN-${candidate.candidate_id.slice(0, 8).toUpperCase()}`}
                    />
                  </dl>
                  <p className="mt-3 flex items-start gap-2 rounded-xl border border-verified-emerald/25 bg-verified-emerald-soft/50 p-3 text-[11px] leading-5 text-ink-primary">
                    <ShieldCheck
                      className="mt-0.5 size-3.5 shrink-0 text-verified-emerald"
                      aria-hidden
                    />
                    Degree document reviewed and approved by the UTN registrar team. Contact
                    details and the signed certificate are released only after a credit unlock.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Action panel */}
          {unlocked ? (
            <section className="space-y-3" aria-label="Unlocked candidate">
              <div className="rounded-2xl border border-accent-emerald/30 bg-accent-emerald-soft/50 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-emerald-hover">
                  <Unlock className="size-3.5" aria-hidden />
                  Unlocked dossier
                </p>
                <div className="mt-3 space-y-1.5 text-sm">
                  {candidate.email ? (
                    <a
                      href={`mailto:${candidate.email}`}
                      className="flex min-h-11 items-center gap-2 break-all text-accent-emerald-hover hover:underline"
                    >
                      <Mail className="size-4 shrink-0" aria-hidden />
                      {candidate.email}
                    </a>
                  ) : null}
                  {candidate.phone ? (
                    <a
                      href={`tel:${candidate.phone.replace(/\s+/g, "")}`}
                      className="flex min-h-11 items-center gap-2 text-ink-primary hover:underline"
                    >
                      <Phone className="size-4 shrink-0" aria-hidden />
                      {candidate.phone}
                    </a>
                  ) : null}
                </div>
              </div>

              {candidate.certificate_r2_key ? (
                <SecureCertificateViewer
                  candidateId={candidate.candidate_id}
                  employer={employer}
                />
              ) : null}

              <ChatThread
                companyId={companyId}
                candidateId={candidate.candidate_id}
                currentUserId={employer.employerId}
                title="Direct message"
              />
            </section>
          ) : (
            <section
              className="rounded-2xl border border-accent-gold/35 bg-accent-gold-soft/60 p-4"
              aria-label="Unlock this candidate"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-gold-hover">
                Confidential dossier
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                One credit releases the candidate&rsquo;s name, contact details, signed certificate
                and direct message thread.
              </p>

              {unlockError ? (
                <Alert tone="error" title="Unlock failed" className="mt-3">
                  {unlockError}
                </Alert>
              ) : null}

              <Button
                variant="emerald"
                onClick={() => void handleUnlock()}
                loading={unlocking}
                className="mt-3 w-full gap-2"
              >
                <Unlock className="size-4" aria-hidden />
                Unlock candidate — 1 credit
              </Button>

              <p className="mt-2 text-center text-xs text-ink-muted" aria-live="polite">
                {balance === null
                  ? "Credit balance unavailable"
                  : `${balance} credit${balance === 1 ? "" : "s"} remaining`}
              </p>
            </section>
          )}

          <p className="pb-2 text-center text-[11px] text-ink-muted">
            <kbd className="rounded border border-line bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px]">
              ↑
            </kbd>{" "}
            <kbd className="rounded border border-line bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px]">
              K
            </kbd>{" "}
            previous ·{" "}
            <kbd className="rounded border border-line bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px]">
              ↓
            </kbd>{" "}
            <kbd className="rounded border border-line bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px]">
              J
            </kbd>{" "}
            next · <kbd className="rounded border border-line bg-surface-canvas px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>{" "}
            close
          </p>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-medium text-ink-primary">{value}</dd>
    </div>
  );
}
