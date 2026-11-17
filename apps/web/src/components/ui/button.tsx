import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "emerald" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "sheen bg-jewel-ink text-white ring-1 ring-inset ring-white/10 shadow-luxe hover:-translate-y-px hover:shadow-floating disabled:bg-brand-navy/50 disabled:shadow-none",
  secondary:
    "border border-line bg-surface-card/90 text-ink-primary shadow-sm hover:-translate-y-px hover:border-accent-gold/50 hover:bg-surface-card hover:shadow-card disabled:opacity-50",
  ghost: "text-ink-muted hover:bg-surface-muted/80 hover:text-ink-primary disabled:opacity-50",
  danger: "bg-danger text-white shadow-sm hover:bg-red-700 disabled:bg-danger/40",
  emerald:
    "sheen bg-jewel-emerald bg-[length:200%_200%] text-white shadow-emerald-glow hover:-translate-y-px hover:animate-gradient-pan disabled:opacity-40 disabled:shadow-none",
  gold: "sheen bg-jewel-gold bg-[length:200%_200%] text-brand-navy shadow-gold-hairline hover:-translate-y-px hover:animate-gradient-pan",
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
        "inline-flex items-center justify-center font-semibold transition duration-300 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/40 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed motion-reduce:active:scale-100",
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
