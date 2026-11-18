"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import type { VideoSessionQuestion } from "@utn/shared";
import { formatPitchDuration } from "@utn/shared";
import { cn } from "@/lib/utils";

export interface QuestionChapterPlayerProps {
  src: string | null;
  questions: VideoSessionQuestion[] | null;
  /** Total duration (seconds) shown in the header. */
  durationSeconds?: number | null;
  title?: string;
  className?: string;
  /** Start playback automatically once the source is ready. */
  autoPlay?: boolean;
}

/**
 * A single <video> element with 4 clickable question chapter cards below it.
 * Clicking a chapter seeks the video to its start offset and highlights the
 * active chapter as playback progresses. Used by the employer dossier drawer
 * and the admin review queue.
 */
export function QuestionChapterPlayer({
  src,
  questions,
  durationSeconds,
  title = "Assessment video",
  className,
  autoPlay = false,
}: QuestionChapterPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const hasChapters = Array.isArray(questions) && questions.length === 4;

  const syncActive = useCallback(() => {
    const video = videoRef.current;
    if (!video || !questions) return;
    const t = video.currentTime;
    let next = 0;
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i]!;
      if (t >= q.start_offset_seconds && t < q.end_offset_seconds) {
        next = i;
        break;
      }
      if (t >= q.end_offset_seconds) next = i;
    }
    setActiveIndex(next);
  }, [questions]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => syncActive();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [syncActive]);

  useEffect(() => {
    setActiveIndex(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, [src, questions]);

  useEffect(() => {
    if (!autoPlay || !src) return;
    const video = videoRef.current;
    if (!video) return;
    const tryPlay = () => {
      void video.play().catch(() => undefined);
    };
    if (video.readyState >= 2) tryPlay();
    else video.addEventListener("loadedmetadata", tryPlay, { once: true });
    return () => video.removeEventListener("loadedmetadata", tryPlay);
  }, [autoPlay, src]);

  function seekTo(index: number) {
    const video = videoRef.current;
    if (!video || !questions) return;
    const q = questions[index];
    if (!q) return;
    video.currentTime = q.start_offset_seconds;
    void video.play().catch(() => undefined);
  }

  if (!src) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-surface-canvas text-xs text-ink-muted",
          className,
        )}
      >
        No playable video.
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border border-studio-obsidian bg-studio-obsidian">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          className="aspect-video w-full bg-black"
        />
      </div>

      {durationSeconds ? (
        <p className="text-[11px] text-ink-muted">
          {formatPitchDuration(durationSeconds)} · 4-question assessment
        </p>
      ) : null}

      {hasChapters ? (
        <div
          role="group"
          aria-label="Question chapters"
          className="grid gap-2 sm:grid-cols-2"
        >
          {questions!.map((q, i) => {
            const active = i === activeIndex && playing;
            return (
              <button
                key={q.index}
                type="button"
                onClick={() => seekTo(i)}
                aria-pressed={active}
                aria-label={`Question ${q.index}: ${q.question_text}. Seek to ${formatPitchDuration(q.start_offset_seconds)}.`}
                className={cn(
                  "tactile-press flex min-h-11 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-accent-emerald bg-accent-emerald-soft/60 ring-1 ring-accent-emerald/40"
                    : "border-line bg-surface-card hover:border-accent-emerald/40",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-emerald-hover">
                    Q{q.index}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-ink-muted">
                    {formatPitchDuration(q.start_offset_seconds)}–
                    {formatPitchDuration(q.end_offset_seconds)}
                  </span>
                </span>
                <span className="line-clamp-3 text-xs leading-5 text-ink-primary">
                  {q.question_text}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
