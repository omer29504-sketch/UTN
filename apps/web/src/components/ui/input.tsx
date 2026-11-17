import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "focus:ring-accent-emerald/12 h-11 w-full rounded-xl border border-line bg-surface-card/90 px-3.5 text-sm text-ink-primary shadow-sm transition placeholder:text-ink-muted/55 hover:border-accent-gold/45 focus:border-accent-emerald focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-surface-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
