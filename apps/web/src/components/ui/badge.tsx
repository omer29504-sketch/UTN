import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "gold" | "emerald" | "danger" | "warning" | "dark";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-muted text-ink-muted",
  gold: "border-accent-gold/35 bg-accent-gold-soft text-accent-gold-hover",
  emerald: "border-verified-emerald/25 bg-verified-emerald-soft text-emerald-700",
  danger: "border-danger/20 bg-red-50 text-danger",
  warning: "border-warning/20 bg-amber-50 text-warning",
  dark: "border-white/15 bg-white/10 text-white",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
