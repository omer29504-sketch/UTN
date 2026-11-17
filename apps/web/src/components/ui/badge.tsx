import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone =
  "neutral" | "gold" | "emerald" | "danger" | "warning" | "dark" | "sapphire" | "amethyst";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-surface-muted/80 text-ink-muted",
  gold: "border-accent-gold/40 bg-accent-gold-soft text-accent-gold-hover",
  emerald: "border-verified-emerald/30 bg-verified-emerald-soft text-accent-emerald-hover",
  danger: "border-danger/25 bg-accent-rose-soft text-danger",
  warning: "border-warning/25 bg-[#FBF0DA] text-warning",
  dark: "border-white/15 bg-white/10 text-white",
  sapphire: "border-accent-sapphire/30 bg-accent-sapphire-soft text-accent-sapphire",
  amethyst: "border-accent-amethyst/30 bg-accent-amethyst-soft text-accent-amethyst",
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
