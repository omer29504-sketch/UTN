"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { authFetch, readApiError } from "@/lib/api/client";

export function PeerClipPlayer({
  peerId,
  peerLabel,
  major,
}: {
  peerId: string;
  peerLabel: string;
  major: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{
    clipStartSeconds: number;
    clipEndSeconds: number;
    questionText: string;
    videoUrl: string;
    viewsRemainingToday: number;
  } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);

  const loadClip = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCompleted(false);
    try {
      const res = await authFetch("/api/candidate/peer-clip", {
        method: "POST",
        body: JSON.stringify({ targetId: peerId, questionIndex: 1 }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      setClip({
        clipStartSeconds: data.clip_start_seconds,
        clipEndSeconds: data.clip_end_seconds,
        questionText: data.question_text,
        videoUrl: data.videoUrl,
        viewsRemainingToday: data.views_remaining_today,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load clip.");
    } finally {
      setLoading(false);
    }
  }, [peerId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;
    const onTime = () => {
      if (video.currentTime < clip.clipStartSeconds) {
        video.currentTime = clip.clipStartSeconds;
      }
      if (video.currentTime >= clip.clipEndSeconds) {
        video.pause();
        video.currentTime = clip.clipEndSeconds;
        setPlaying(false);
        setCompleted(true);
      }
    };
    const onSeeking = () => {
      if (video.currentTime < clip.clipStartSeconds || video.currentTime > clip.clipEndSeconds) {
        video.currentTime = Math.min(Math.max(video.currentTime, clip.clipStartSeconds), clip.clipEndSeconds);
      }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeking", onSeeking);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeking", onSeeking);
    };
  }, [clip]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video || !clip) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      if (completed) {
        video.currentTime = clip.clipStartSeconds;
        setCompleted(false);
      }
      void video.play().catch(() => undefined);
      setPlaying(true);
    }
  }

  if (!clip) {
    return (
      <Card className="p-4 space-y-3">
        <CardHeader title="Watch Peer Answer" description="One question clip (max 60s)." />
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button onClick={() => void loadClip()} loading={loading} className="w-full">
          <Play className="size-4" aria-hidden />
          Watch Peer Answer (1 Question)
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <CardHeader title="Peer Question" description={`${peerLabel} · ${major || ""}`} />
      <p className="text-sm font-medium text-brand-navy">{clip.questionText}</p>
      <div className="relative overflow-hidden rounded-xl border border-line bg-black">
        <video
          ref={videoRef}
          src={clip.videoUrl}
          playsInline
          preload="metadata"
          className="aspect-video w-full"
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.currentTime = clip.clipStartSeconds;
          }}
        />
        {completed ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-sm">
            <p className="text-sm font-semibold text-white">Peer Clip Complete — 1 Question Limit</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={togglePlay} variant="secondary" size="sm">
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {playing ? "Pause" : "Play"}
        </Button>
        <span className="text-xs text-ink-muted">
          {clip.clipStartSeconds}s – {clip.clipEndSeconds}s · {clip.viewsRemainingToday} views remaining today
        </span>
      </div>
    </Card>
  );
}
