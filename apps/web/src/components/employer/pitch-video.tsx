"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { authFetch } from "@/lib/api/client";

export function PitchVideo({ storageKey }: { storageKey: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/storage/presign", {
        method: "POST",
        body: JSON.stringify({
          intent: "download",
          bucket: "pitch-videos",
          key: storageKey,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Could not load video.");
        return;
      }
      const body = (await res.json()) as { url: string };
      setUrl(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load video.");
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <video src={url} controls className="aspect-video w-full rounded-xl" preload="metadata" />
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="flex aspect-video w-full items-center justify-center rounded-xl border border-line bg-studio-obsidian text-white/80 transition hover:text-white"
      >
        {loading ? (
          <span className="text-sm">Loading…</span>
        ) : (
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Play className="size-5" aria-hidden />
            Play pitch
          </span>
        )}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
