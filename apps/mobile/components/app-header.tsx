import { usePathname, useRouter } from "expo-router";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ScanFace,
  UserRound,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Role } from "@utn/shared";

import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const linksByRole: Record<
  Role,
  { href: string; label: string; icon: typeof LayoutDashboard }[]
> = {
  candidate: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/candidate/profile", label: "Profile", icon: UserRound },
    { href: "/candidate/verification", label: "Verification", icon: ScanFace },
  ],
  employer: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/employer/company", label: "Company", icon: Building2 },
  ],
  admin: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard }],
};

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      className={cn(
        "flex-row items-center gap-1.5 rounded-lg px-3 py-2",
        active ? "bg-brand-navy" : "bg-transparent active:bg-surface-muted",
      )}
    >
      <Icon size={14} color={active ? "#FFFFFF" : "#64748B"} />
      <Text
        className={cn(
          "font-inter-semibold text-[11px]",
          active ? "text-white" : "text-ink-muted",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppHeader() {
  const { role, profile, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const links = role ? linksByRole[role] : [];

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/sign-in");
  }

  return (
    <View className="border-b border-line/80 bg-white/90">
      <View className="flex-row items-center justify-between gap-3 px-5 py-3">
        <BrandMark href="/dashboard" />
        <View className="flex-row items-center gap-2">
          {role ? (
            <Badge tone={role === "admin" ? "indigo" : "neutral"}>
              {role}
            </Badge>
          ) : null}
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => void handleSignOut()}
            className="h-9 w-9 items-center justify-center rounded-lg active:bg-surface-muted"
          >
            <LogOut size={17} color="#64748B" />
          </Pressable>
        </View>
      </View>

      {links.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 4 }}
        >
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
            return (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={active}
              />
            );
          })}
        </ScrollView>
      ) : null}

      {profile ? (
        <Text className="px-5 pb-2 font-inter text-[9px] text-ink-muted/70" numberOfLines={1}>
          {user?.email ?? profile.email}
        </Text>
      ) : null}
    </View>
  );
}
