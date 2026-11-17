import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "focus:ring-accent-emerald/12 h-11 w-full appearance-none rounded-xl border border-line bg-surface-card/90 px-3.5 text-sm text-ink-primary shadow-sm transition hover:border-accent-gold/45 focus:border-accent-emerald focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-surface-muted",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);
