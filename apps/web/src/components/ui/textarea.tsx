import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[96px] w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink-primary placeholder:text-ink-muted/60 shadow-sm transition focus:border-accent-indigo focus:outline-none focus:ring-4 focus:ring-accent-indigo/10 disabled:cursor-not-allowed disabled:bg-surface-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
