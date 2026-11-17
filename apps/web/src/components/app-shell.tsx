import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import type { SessionContext } from "@/lib/auth/session";

export function AppShell({
  session,
  credits,
  children,
}: {
  session: SessionContext;
  /** Employer unlock balance surfaced in the floating nav. */
  credits?: number | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface-canvas">
      <Navbar role={session.profile.role} email={session.user.email} credits={credits} />

      <main id="main" className="mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
        {children}
      </main>
    </div>
  );
}
