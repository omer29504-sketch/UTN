"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { authFetch, readApiError } from "@/lib/api/client";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
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
      <SpotlightGlassCard className="jewel-border hairline-gold relative p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-accent-gold/40 bg-jewel-gold text-brand-navy shadow-gold-hairline">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-primary">Priority Pro active</h2>
            <p className="text-sm text-ink-muted">
              Your profile is pinned higher in employer search results.
            </p>
          </div>
        </div>
      </SpotlightGlassCard>
    );
  }

  return (
    <SpotlightGlassCard className="jewel-border relative p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent-gold/40 bg-jewel-gold text-brand-navy shadow-gold-hairline">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div>
            <p className="eyebrow">Prestige placement</p>
            <h2 className="mt-1.5 font-display text-lg font-bold text-ink-primary">Priority Pro</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-ink-muted">
              Pin your profile higher in search results and unlock profile-view analytics.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={() => void startCheckout()}
            loading={loading}
            variant="gold"
            className="gap-2"
          >
            <Sparkles className="size-4" aria-hidden />
            Upgrade
          </Button>
          {error ? (
            <Alert tone="error" title="Checkout failed">
              {error}
            </Alert>
          ) : null}
        </div>
      </div>
    </SpotlightGlassCard>
  );
}
