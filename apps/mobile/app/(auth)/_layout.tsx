import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/components/screen";
import { useAuth } from "@/lib/auth-context";

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen label="Checking your session…" />;
  }

  if (session) {
    return <Redirect href="/dashboard" />;
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
