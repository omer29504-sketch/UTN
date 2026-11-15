import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from "react-native";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "emerald";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-navy active:bg-brand-navy-soft",
  secondary: "border border-line bg-white active:bg-surface-muted",
  ghost: "bg-transparent active:bg-surface-muted",
  danger: "bg-danger active:bg-red-700",
  emerald: "bg-verified-emerald active:bg-emerald-600",
};

const textVariants: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-brand-navy",
  ghost: "text-ink-muted",
  danger: "text-white",
  emerald: "text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3",
  md: "h-11 gap-2 rounded-xl px-4",
  lg: "h-12 gap-2 rounded-xl px-5",
};

const textSizes: Record<Size, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-sm",
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  icon?: ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
}

export function Button({
  label,
  icon,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;
  const indicatorColor =
    variant === "primary" || variant === "danger" || variant === "emerald"
      ? "#FFFFFF"
      : "#0F172A";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center",
        variants[variant],
        sizes[size],
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={indicatorColor} />
      ) : (
        icon
      )}
      <Text className={cn("font-inter-semibold", textVariants[variant], textSizes[size])}>
        {label}
      </Text>
    </Pressable>
  );
}
