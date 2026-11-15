import type { ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";

import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn("rounded-2xl border border-line bg-surface-card p-5", className)}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn("flex-row items-start justify-between gap-3", className)}>
      <View className="flex-1">
        <Text className="font-jakarta-bold text-[15px] leading-5 text-brand-navy">
          {title}
        </Text>
        {description ? (
          <Text className="mt-1 font-inter text-[11px] leading-5 text-ink-muted">
            {description}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
