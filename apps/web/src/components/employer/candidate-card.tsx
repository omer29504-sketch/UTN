"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Play, Sparkles, Unlock, Video } from "lucide-react";
import { authFetch, readApiError } from "@/lib/api/client";
import type { EmployerCandidateCard } from "@utn/shared";
import { formatPitchDuration } from "@utn/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  SecureCertificateViewer,
  type EmployerViewerIdentity,
} from "@/components/employer/secure-certificate-viewer";

interface Props {
  candidate: EmployerCandidateCard;
  companyId: string;
  employer: EmployerViewerIdentity;
}

export function CandidateCard({ candidate, companyId, employer }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(candidate.is_unlocked);
  const [balance, setBalance] = useState<number | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const displayName = unlocked
    ? (candidate.full_name ?? candidate.display_name)
    : candidate.display_name;

  async function loadVideo() {
    if (!candidate.video_r2_key) return;
    setVideoLoading(true);
    setVideoError(null);
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
        setVideoError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { url: string };
      setVideoUrl(body.url);
    } catch (e) {
      setVideoError(e instanceof Error ? e.message : "Could not load video.");
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleUnlock() {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await authFetch("/api/employer/unlock", {
        method: "POST",
        body: JSON.stringify({
          companyId,
          candidateId: candidate.candidate_id,
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        alreadyUnlocked?: boolean;
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
      } else {
        setUnlockError(body.message ?? "Unlock failed.");
      }
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-brand-navy">{displayName}</p>
          {candidate.headline ? (
            <p className="mt-0.5 truncate text-sm text-ink-muted">{candidate.headline}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {candidate.is_featured ? (
            <Badge tone="indigo">
              <Sparkles className="mr-1 size-3" aria-hidden />
              Priority Pro
            </Badge>
          ) : null}
          {unlocked ? (
            <Badge tone="emerald">
              <Unlock className="mr-1 size-3" aria-hidden />
              Unlocked
            </Badge>
          ) : (
            <Badge tone="neutral">
              <Lock className="mr-1 size-3" aria-hidden />
              Locked
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
        <span>{candidate.degree_level}</span>
        <span>{candidate.university_name}</span>
        <span>Grad {candidate.graduation_year}</span>
        <span>{candidate.experience_years} yrs exp</span>
        {candidate.industry ? <span className="col-span-2">{candidate.industry}</span> : null}
      </div>

      {candidate.video_r2_key ? (
        <div className="overflow-hidden rounded-xl border border-line bg-studio-obsidian">
          {videoUrl ? (
            <video src={videoUrl} controls className="aspect-video w-full" preload="metadata" />
          ) : (
            <button
              type="button"
              onClick={() => void loadVideo()}
              disabled={videoLoading}
              className="flex aspect-video w-full items-center justify-center text-white/80 transition hover:text-white"
            >
              {videoLoading ? (
                <span className="text-sm">Loading…</span>
              ) : (
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Play className="size-5" aria-hidden />
                  Watch pitch
                  {candidate.video_duration_seconds
                    ? ` (${formatPitchDuration(candidate.video_duration_seconds)})`
                    : ""}
                </span>
              )}
            </button>
          )}
          {videoError ? <p className="px-3 py-2 text-xs text-red-300">{videoError}</p> : null}
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-xl border border-line bg-surface-canvas text-xs text-ink-muted">
          <Video className="mr-2 size-4" aria-hidden />
          No pitch video
        </div>
      )}

      {unlocked ? (
        <div className="space-y-2 rounded-xl border border-verified-emerald/30 bg-verified-emerald/5 p-3 text-sm">
          <p className="font-semibold text-brand-navy">{candidate.full_name}</p>
          {candidate.email ? (
            <p className="text-ink-muted">
              <a className="text-accent-indigo hover:underline" href={`mailto:${candidate.email}`}>
                {candidate.email}
              </a>
            </p>
          ) : null}
          {candidate.phone ? <p className="text-ink-muted">{candidate.phone}</p> : null}
          {candidate.certificate_r2_key ? (
            <SecureCertificateViewer candidateId={candidate.candidate_id} employer={employer} />
          ) : null}
          <Link
            href={`/employer/candidates/${candidate.candidate_id}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-indigo hover:underline"
          >
            Open full profile <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {unlockError ? (
            <Alert tone="error" title="Unlock failed">
              {unlockError}
            </Alert>
          ) : null}
          <Button onClick={() => void handleUnlock()} loading={unlocking} className="gap-2">
            <Unlock className="size-4" aria-hidden />
            Unlock candidate (1 credit)
          </Button>
          {balance !== null ? (
            <p className="text-xs text-ink-muted">New balance: {balance} credits</p>
          ) : null}
        </div>
      )}
    </Card>
  );
}
