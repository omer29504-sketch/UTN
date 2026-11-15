import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/components/screen";
import { useAuth } from "@/lib/auth-context";

export default function ProtectedLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Restoring your session…" />;
  }

  if (!session) {
    return <Redirect href="/auth/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F8FAFC" },
      }}
    />
  );
}
