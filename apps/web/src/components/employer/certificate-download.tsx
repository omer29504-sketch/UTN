"use client";

import { useState } from "react";
import { authFetch } from "@/lib/api/client";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateDownload({ storageKey }: { storageKey: string }) {
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
          bucket: "private-credentials",
          key: storageKey,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Could not prepare certificate link.");
        return;
      }
      const body = (await res.json()) as { url: string };
      setUrl(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare certificate link.");
    } finally {
      setLoading(false);
    }
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-navy-soft"
      >
        <BadgeCheck className="size-4" aria-hidden />
        Open certificate (5-min link)
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={() => void load()} loading={loading} className="gap-2">
        <BadgeCheck className="size-4" aria-hidden />
        View certificate
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
