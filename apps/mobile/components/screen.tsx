import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/cn";

export function Screen({
  children,
  showHeader = true,
  scroll = true,
  className,
  contentClassName,
}: {
  children: ReactNode;
  showHeader?: boolean;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <SafeAreaView className={cn("flex-1 bg-surface-canvas", className)} edges={["top"]}>
      {showHeader ? <AppHeader /> : null}
      {scroll ? (
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className={contentClassName}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View className={cn("flex-1", contentClassName)}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-surface-canvas">
      <ActivityIndicator size="large" color="#4F46E5" />
      <Text className="font-inter text-[12px] text-ink-muted">{label}</Text>
    </SafeAreaView>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View className="items-center justify-center rounded-2xl border border-line bg-surface-card px-6 py-12">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent-indigo-soft">
        {icon}
      </View>
      <Text className="mt-4 font-jakarta-bold text-lg text-brand-navy">{title}</Text>
      <Text className="mt-1.5 max-w-xs text-center font-inter text-[12px] leading-5 text-ink-muted">
        {body}
      </Text>
    </View>
  );
}
