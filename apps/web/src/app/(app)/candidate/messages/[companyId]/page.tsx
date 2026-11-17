import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ChatThread } from "@/components/chat/chat-thread";

export const dynamic = "force-dynamic";

export default async function CandidateThreadPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const session = await requireRole("candidate", "/candidate/messages");
  const { companyId } = await params;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the service role key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data: unlock } = await admin
    .from("company_unlocked_candidates")
    .select("company_id")
    .eq("company_id", companyId)
    .eq("candidate_id", session.user.id)
    .maybeSingle();

  if (!unlock) {
    return (
      <div className="space-y-4">
        <Link
          href="/candidate/messages"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-emerald-hover hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to messages
        </Link>
        <Alert tone="warning" title="Conversation locked">
          This employer has not unlocked your profile yet.
        </Alert>
      </div>
    );
  }

  const { data: company } = await admin
    .from("companies")
    .select("company_name")
    .eq("id", companyId)
    .maybeSingle();

  return (
    <div className="space-y-4">
      <Link
        href="/candidate/messages"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent-emerald-hover hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to messages
      </Link>
      <ChatThread
        companyId={companyId}
        candidateId={session.user.id}
        currentUserId={session.user.id}
        title={company?.company_name ?? "Employer"}
      />
    </div>
  );
}
