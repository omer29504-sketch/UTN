import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { RoleBadge } from "@/components/verification-badge";
import type { SessionContext } from "@/lib/auth/session";

export function AppShell({ session, children }: { session: SessionContext; children: ReactNode }) {
  const initials = session.user.email.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-dvh bg-surface-canvas">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <BrandMark href="/dashboard" />
            <div className="hidden md:block">
              <AppNav role={session.profile.role} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="hidden size-8 place-items-center rounded-full bg-accent-indigo-soft font-display text-xs font-bold text-accent-indigo sm:grid"
              aria-hidden
            >
              {initials}
            </span>
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold text-brand-navy">
                {session.user.email}
              </p>
              <RoleBadge role={session.profile.role} />
            </div>
            <SignOutButton />
          </div>
        </div>
        <div className="border-t border-line/70 px-4 py-2 md:hidden">
          <AppNav role={session.profile.role} />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
