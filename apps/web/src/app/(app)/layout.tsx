import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSessionContext();

  if (!session) {
    redirect("/auth/sign-in?next=/dashboard");
  }

  let credits: number | null = null;

  if (session.profile.role === "employer") {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.rpc("get_my_credit_balance");
      credits = typeof data === "number" ? data : null;
    }
  }

  return (
    <AppShell session={session} credits={credits}>
      {children}
    </AppShell>
  );
}
