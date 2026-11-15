import { Link } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

export function BrandMark({
  href = "/",
  inverted = false,
  className,
}: {
  href?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} asChild>
      <View className={cn("flex-row items-center gap-2.5", className)}>
        <View
          className={cn(
            "h-9 w-9 items-center justify-center rounded-xl",
            inverted ? "bg-white" : "bg-brand-navy",
          )}
        >
          <ShieldCheck
            size={18}
            color={inverted ? "#0F172A" : "#FFFFFF"}
            strokeWidth={2.2}
          />
        </View>
        <View>
          <Text
            className={cn(
              "font-jakarta-bold text-[14px] leading-5",
              inverted ? "text-white" : "text-brand-navy",
            )}
          >
            University Talent
          </Text>
          <Text
            className={cn(
              "font-inter-semibold text-[8px] uppercase tracking-[1.8px]",
              inverted ? "text-white/50" : "text-ink-muted",
            )}
          >
            Network
          </Text>
        </View>
      </View>
    </Link>
  );
}
