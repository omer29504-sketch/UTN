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
    <div className="relative min-h-dvh bg-surface-canvas">
      {/*
       * Ambient aurora wash. Three radial gradients masked to nothing by the
       * fold, so workspace pages carry the same Northern Lights signature as
       * the dark hero banners without competing with the data.
       */}
      <div
        aria-hidden
        className="aurora-wash pointer-events-none absolute inset-x-0 top-0 h-[520px]"
      />

      <Navbar role={session.profile.role} email={session.user.email} credits={credits} />

      <main
        id="main"
        className="relative mx-auto max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32"
      >
        {children}
      </main>
    </div>
  );
}
