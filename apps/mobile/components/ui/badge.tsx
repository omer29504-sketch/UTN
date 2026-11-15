import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "indigo" | "emerald" | "danger" | "warning" | "dark";

const tones: Record<Tone, { wrapper: string; text: string }> = {
  neutral: { wrapper: "border-line bg-surface-muted", text: "text-ink-muted" },
  indigo: {
    wrapper: "border-accent-indigo/20 bg-accent-indigo-soft",
    text: "text-accent-indigo",
  },
  emerald: {
    wrapper: "border-verified-emerald/25 bg-verified-emerald-soft",
    text: "text-emerald-700",
  },
  danger: { wrapper: "border-danger/20 bg-red-50", text: "text-danger" },
  warning: { wrapper: "border-warning/20 bg-amber-50", text: "text-warning" },
  dark: { wrapper: "border-white/15 bg-white/10", text: "text-white" },
};

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  const style = tones[tone];
  return (
    <View
      className={cn(
        "flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1",
        style.wrapper,
        className,
      )}
    >
      {icon}
      <Text className={cn("font-inter-semibold text-[10px]", style.text)}>
        {children}
      </Text>
    </View>
  );
}
