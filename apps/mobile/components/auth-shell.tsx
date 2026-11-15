import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandMark } from "@/components/brand-mark";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-surface-canvas" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 py-4">
        <BrandMark href="/" />
        <View className="rounded-full border border-line bg-white px-2.5 py-1">
          <View className="h-1.5 w-1.5 rounded-full bg-verified-emerald" />
        </View>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
