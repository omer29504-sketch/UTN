"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { authFetch, readApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface Props {
  kind: "credit_pack" | "candidate_pro";
  packId?: string;
  label: string;
  highlight?: boolean;
}

export function CheckoutButton({ kind, packId, label, highlight }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const body =
        kind === "credit_pack" ? { kind: "credit_pack", packId } : { kind: "candidate_pro" };
      const res = await authFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={() => void start()}
        loading={loading}
        className={`gap-2 ${highlight ? "bg-accent-emerald" : ""}`}
      >
        <CreditCard className="size-4" aria-hidden />
        {label}
      </Button>
      {error ? (
        <Alert tone="error" title="Checkout failed">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
