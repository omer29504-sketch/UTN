"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  ScanFace,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { Role } from "@utn/shared";
import { BrandMark } from "@/components/brand-mark";
import { SignOutButton } from "@/components/sign-out-button";
import { RoleBadge } from "@/components/verification-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Icon = typeof LayoutDashboard;

const linksByRole: Record<Role, { href: string; label: string; icon: Icon }[]> = {
  candidate: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/candidate/profile", label: "Profile", icon: UserRound },
    { href: "/candidate/verification", label: "Verification", icon: ScanFace },
    { href: "/candidate/messages", label: "Messages", icon: MessageSquare },
  ],
  employer: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/employer/candidates", label: "Candidates", icon: Search },
    { href: "/employer/company", label: "Company", icon: Building2 },
    { href: "/employer/billing", label: "Billing", icon: CreditCard },
  ],
  admin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/verification", label: "Review queue", icon: ClipboardCheck },
  ],
};

const publicLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-graduates", label: "For graduates" },
  { href: "/#for-employers", label: "For employers" },
];

const noLinks: { href: string; label: string; icon: Icon }[] = [];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavbarProps {
  /** Omit for the signed-out marketing shell. */
  role?: Role;
  email?: string;
  /** Employer unlock balance rendered as a live pill. */
  credits?: number | null;
}

/**
 * Floating frosted navigation shell.
 *
 * Sits above both the navy heroes and the alabaster workspace: the translucent
 * white glass keeps links legible in either light, while the emerald pill
 * slides between the active destination instead of snapping.
 */
export function Navbar({ role, email, credits }: NavbarProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links = role ? linksByRole[role] : noLinks;

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) {
      setIndicator(null);
      return;
    }

    const index = links.findIndex((link) => isActive(pathname, link.href));
    const node = index >= 0 ? linkRefs.current[index] : null;

    if (!node) {
      setIndicator(null);
      return;
    }

    setIndicator({ left: node.offsetLeft, width: node.offsetWidth });
  }, [links, pathname]);

  useEffect(() => {
    measure();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measure]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  // Close the drawer whenever navigation lands on a new route.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto max-w-6xl">
          <div className="relative flex h-16 items-center justify-between gap-3 rounded-2xl border border-line/80 bg-surface-card/75 px-3 shadow-luxe backdrop-blur-2xl sm:px-4">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 h-px animate-line-sweep bg-gradient-to-r from-transparent via-accent-gold/60 to-transparent bg-[length:200%_100%]"
            />
            <div className="flex min-w-0 items-center gap-2 sm:gap-5">
              <BrandMark href={role ? "/dashboard" : "/"} />

              {role ? (
                <div
                  ref={navRef}
                  className="no-scrollbar relative hidden items-center gap-1 overflow-x-auto lg:flex"
                >
                  {indicator ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-1.5 rounded-xl bg-gradient-to-r from-accent-emerald/15 via-accent-sapphire/10 to-accent-amethyst/10 ring-1 ring-inset ring-accent-gold/30 transition-[left,width] duration-500 ease-out-expo"
                      style={{ left: indicator.left, width: indicator.width }}
                    />
                  ) : null}

                  {links.map((link, index) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        ref={(node) => {
                          linkRefs.current[index] = node;
                        }}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative z-10 inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-300",
                          active ? "text-ink-primary" : "text-ink-muted hover:text-ink-primary",
                        )}
                      >
                        <link.icon
                          className={cn(
                            "size-4 transition-colors duration-300",
                            active ? "text-accent-emerald-hover" : "text-ink-muted",
                          )}
                          aria-hidden
                        />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
                  {publicLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-muted transition-colors duration-300 hover:bg-surface-muted/80 hover:text-ink-primary"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {role === "employer" && credits != null ? (
                <Link
                  href="/employer/billing"
                  className="hidden items-center gap-1.5 rounded-full border border-accent-gold/45 bg-jewel-gold px-3 py-1.5 text-[11px] font-semibold text-brand-navy shadow-gold-hairline transition-transform hover:-translate-y-px sm:inline-flex"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {credits} unlock credit{credits === 1 ? "" : "s"}
                </Link>
              ) : null}

              {role ? (
                <>
                  <div className="hidden items-center gap-2 md:flex">
                    <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-accent-emerald to-accent-sapphire font-display text-xs font-bold text-white ring-1 ring-inset ring-white/25">
                      {(email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="hidden text-right xl:block">
                      <p className="max-w-[170px] truncate text-xs font-semibold text-ink-primary">
                        {email}
                      </p>
                      <RoleBadge role={role} />
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <SignOutButton />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-10 rounded-xl p-0 lg:hidden"
                    aria-label="Open navigation menu"
                    aria-expanded={drawerOpen}
                    onClick={() => setDrawerOpen(true)}
                  >
                    <Menu className="size-5" aria-hidden />
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/sign-in"
                    className="hidden rounded-xl px-3.5 py-2 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-muted/80 sm:inline-flex"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    className="sheen inline-flex items-center gap-1.5 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10 transition duration-300 ease-out-expo hover:-translate-y-px hover:shadow-floating"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {role && drawerOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-brand-navy/45 backdrop-blur-sm"
            onClick={closeDrawer}
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm animate-slide-in flex-col border-l border-line/80 bg-surface-card/95 shadow-floating backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
              <BrandMark href="/dashboard" />
              <Button
                variant="ghost"
                size="sm"
                className="size-10 rounded-xl p-0"
                aria-label="Close navigation menu"
                onClick={closeDrawer}
              >
                <X className="size-5" aria-hidden />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line/80 bg-surface-canvas/80 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink-primary">{email}</p>
                  <div className="mt-1">
                    <RoleBadge role={role} />
                  </div>
                </div>
                {role === "employer" && credits != null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-gold/45 bg-jewel-gold px-2.5 py-1 text-[11px] font-semibold text-brand-navy">
                    <Sparkles className="size-3" aria-hidden />
                    {credits}
                  </span>
                ) : null}
              </div>

              <nav aria-label="Primary" className="mt-4 space-y-1">
                {links.map((link) => {
                  const active = isActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeDrawer}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-gradient-to-r from-accent-emerald/15 via-accent-sapphire/10 to-accent-amethyst/10 text-ink-primary ring-1 ring-inset ring-accent-gold/30"
                          : "text-ink-muted hover:bg-surface-muted/80 hover:text-ink-primary",
                      )}
                    >
                      <link.icon
                        className={cn(
                          "size-4",
                          active ? "text-accent-emerald-hover" : "text-ink-muted",
                        )}
                        aria-hidden
                      />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-line/70 px-4 py-4">
              <SignOutButton />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
