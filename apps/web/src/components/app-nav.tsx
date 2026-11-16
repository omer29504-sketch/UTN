"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  ScanFace,
  Search,
  UserRound,
} from "lucide-react";
import type { Role } from "@utn/shared";
import { cn } from "@/lib/utils";

const linksByRole: Record<Role, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
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

export function AppNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = linksByRole[role];

  return (
    <nav aria-label="Primary" className="no-scrollbar flex items-center gap-1 overflow-x-auto">
      {links.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300",
              active
                ? "bg-brand-navy text-white shadow-sm"
                : "text-ink-muted hover:bg-surface-muted hover:text-brand-navy",
            )}
          >
            <link.icon className="size-4" aria-hidden />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
