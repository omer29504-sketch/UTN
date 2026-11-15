import {
  BadgeCheck,
  Clock3,
  FileWarning,
  ShieldQuestion,
} from "lucide-react-native";
import type { VerificationStatus } from "@utn/shared";
import { VERIFICATION_STATUS_LABELS } from "@utn/shared";

import { Badge } from "@/components/ui/badge";

const config: Record<
  VerificationStatus,
  {
    tone: "neutral" | "warning" | "emerald" | "danger";
    color: string;
    icon: typeof BadgeCheck;
  }
> = {
  unverified: { tone: "neutral", color: "#64748B", icon: ShieldQuestion },
  pending: { tone: "warning", color: "#D97706", icon: Clock3 },
  verified: { tone: "emerald", color: "#10B981", icon: BadgeCheck },
  rejected: { tone: "danger", color: "#DC2626", icon: FileWarning },
};

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const item = config[status];
  const Icon = item.icon;

  return (
    <Badge
      tone={item.tone}
      icon={<Icon size={11} color={item.color} />}
    >
      {VERIFICATION_STATUS_LABELS[status]}
    </Badge>
  );
}
