import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-inter-semibold text-[12px] text-brand-navy">
        {label}
        {required ? <Text className="text-danger"> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text className="font-inter text-[10px] text-danger">{error}</Text>
      ) : hint ? (
        <Text className="font-inter text-[10px] leading-4 text-ink-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
