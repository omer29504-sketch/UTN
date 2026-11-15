"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { authFetch, readApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function PriorityProCard({ isFeatured }: { isFeatured: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "candidate_pro" }),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const body = (await res.json()) as { url?: string };
      if (body.url) window.location.href = body.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  if (isFeatured) {
    return (
      <Card className="border-accent-indigo/20 bg-gradient-to-br from-white to-accent-indigo-soft/40">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-accent-indigo-soft text-accent-indigo">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">Priority Pro active</h2>
            <p className="text-sm text-ink-muted">
              Your profile is pinned higher in employer search results.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-indigo-soft text-accent-indigo">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-brand-navy">Priority Pro</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
              Pin your profile higher in search results and unlock profile-view analytics.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={() => void startCheckout()} loading={loading} className="gap-2">
            <Sparkles className="size-4" aria-hidden />
            Upgrade
          </Button>
          {error ? <Alert tone="error" title="Checkout failed">{error}</Alert> : null}
        </div>
      </div>
    </Card>
  );
}
