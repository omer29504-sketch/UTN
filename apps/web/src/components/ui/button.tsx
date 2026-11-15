import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "emerald";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-navy text-white shadow-sm hover:bg-brand-navy-soft disabled:bg-brand-navy/40",
  secondary:
    "border border-line bg-white text-brand-navy shadow-sm hover:border-ink-muted/40 hover:bg-surface-muted disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-surface-muted hover:text-brand-navy disabled:opacity-50",
  danger: "bg-danger text-white shadow-sm hover:bg-red-700 disabled:bg-danger/40",
  emerald:
    "bg-verified-emerald text-white shadow-sm hover:bg-emerald-600 disabled:bg-verified-emerald/40",
};

const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-11 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-5 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : null}
      {children}
    </button>
  );
});
