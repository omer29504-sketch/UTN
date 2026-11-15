import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/auth/session";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSessionContext();

  if (!session) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  return <AppShell session={session}>{children}</AppShell>;
}
