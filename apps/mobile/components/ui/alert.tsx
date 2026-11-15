import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error" | "warning";

const styles: Record<
  Tone,
  { wrapper: string; text: string; color: string; icon: typeof Info }
> = {
  info: {
    wrapper: "border-accent-indigo/20 bg-accent-indigo-soft",
    text: "text-accent-indigo",
    color: "#4F46E5",
    icon: Info,
  },
  success: {
    wrapper: "border-verified-emerald/25 bg-verified-emerald-soft",
    text: "text-emerald-700",
    color: "#10B981",
    icon: CheckCircle2,
  },
  error: {
    wrapper: "border-danger/20 bg-red-50",
    text: "text-danger",
    color: "#DC2626",
    icon: AlertCircle,
  },
  warning: {
    wrapper: "border-warning/25 bg-amber-50",
    text: "text-warning",
    color: "#D97706",
    icon: AlertTriangle,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = styles[tone];
  const Icon = style.icon;

  return (
    <View
      className={cn(
        "flex-row gap-2.5 rounded-xl border p-3",
        style.wrapper,
        className,
      )}
      accessibilityRole={tone === "error" ? "alert" : "text"}
    >
      <Icon size={15} color={style.color} style={{ marginTop: 1 }} />
      <View className="flex-1">
        {title ? (
          <Text className={cn("font-inter-semibold text-[12px]", style.text)}>
            {title}
          </Text>
        ) : null}
        {typeof children === "string" ? (
          <Text
            className={cn(
              "font-inter text-[11px] leading-5",
              title ? style.text : "text-ink-primary/80",
            )}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
