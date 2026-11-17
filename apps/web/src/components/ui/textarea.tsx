import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[96px] w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink-primary shadow-sm transition placeholder:text-ink-muted/60 hover:border-ink-muted/30 focus:border-accent-emerald focus:outline-none focus:ring-4 focus:ring-accent-emerald/10 disabled:cursor-not-allowed disabled:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
});
