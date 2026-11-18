import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  inverted = false,
  className,
}: {
  href?: string;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl shadow-sm transition-transform duration-500 ease-out-expo group-hover:-rotate-6 motion-reduce:group-hover:rotate-0",
          inverted
            ? "bg-white text-brand-navy ring-1 ring-inset ring-accent-gold/40"
            : "bg-brand-navy text-white ring-1 ring-inset ring-accent-gold/25",
        )}
      >
        <ShieldCheck className="size-5" strokeWidth={2.2} aria-hidden />
      </span>
      <span
        className={cn(
          "font-display text-[15px] font-bold leading-tight",
          inverted ? "text-white" : "text-brand-navy",
        )}
      >
        University Talent
        <span
          className={cn(
            "block text-[11px] font-semibold uppercase tracking-[0.16em]",
            inverted ? "text-accent-gold/80" : "text-accent-gold-hover",
          )}
        >
          Network
        </span>
      </span>
    </Link>
  );
}
