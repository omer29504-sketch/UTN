import { BadgeCheck, Clock3, FileWarning, ShieldQuestion } from "lucide-react";
import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@utn/shared";
import { Badge } from "@/components/ui/badge";

const config: Record<
  VerificationStatus,
  { tone: "neutral" | "warning" | "emerald" | "danger"; icon: typeof BadgeCheck }
> = {
  unverified: { tone: "neutral", icon: ShieldQuestion },
  pending: { tone: "warning", icon: Clock3 },
  verified: { tone: "emerald", icon: BadgeCheck },
  rejected: { tone: "danger", icon: FileWarning },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const item = config[status];
  const Icon = item.icon;

  return (
    <Badge tone={item.tone}>
      <Icon className="size-3.5" aria-hidden />
      {VERIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: "candidate" | "employer" | "admin" }) {
  return (
    <Badge tone={role === "admin" ? "gold" : "neutral"} className="capitalize">
      {role}
    </Badge>
  );
}
