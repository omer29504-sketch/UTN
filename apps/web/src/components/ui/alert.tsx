import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "error" | "warning";

const styles: Record<Tone, { wrapper: string; icon: typeof Info }> = {
  info: {
    wrapper: "border-accent-gold/35 bg-accent-gold-soft/80 text-accent-gold-hover",
    icon: Info,
  },
  success: {
    wrapper: "border-verified-emerald/30 bg-verified-emerald-soft/80 text-accent-emerald-hover",
    icon: CheckCircle2,
  },
  error: { wrapper: "border-danger/25 bg-accent-rose-soft/80 text-danger", icon: AlertCircle },
  warning: { wrapper: "border-warning/25 bg-warning-soft/80 text-warning", icon: AlertCircle },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = styles[tone];
  const Icon = style.icon;

  return (
    <div
      className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", style.wrapper, className)}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("leading-6", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
