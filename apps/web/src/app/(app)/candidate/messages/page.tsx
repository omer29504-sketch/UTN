import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";

export const dynamic = "force-dynamic";

interface UnlockRow {
  company_id: string;
  unlocked_at: string;
  companies: { id: string; company_name: string } | null;
}

export default async function CandidateMessagesPage() {
  const session = await requireRole("candidate", "/candidate/messages");
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the service role key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data, error } = await admin
    .from("company_unlocked_candidates")
    .select("company_id, unlocked_at, companies(id, company_name)")
    .eq("candidate_id", session.user.id);

  const rows = (data ?? []) as unknown as UnlockRow[];

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-brand-navy p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative">
          <p className="eyebrow text-accent-gold">Messages</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
            Your conversations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            Employers who unlocked your profile can message you directly. Reply here in real time.
          </p>
        </div>
      </section>

      {error ? (
        <Alert tone="error" title="Could not load conversations">
          {error.message}
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">
            No conversations yet. Once an employer unlocks your profile, you can chat here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <Link
              key={row.company_id}
              href={`/candidate/messages/${row.company_id}`}
              className="block"
            >
              <Card className="transition hover:shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent-emerald-soft text-accent-emerald">
                    <MessageSquare className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-brand-navy">
                      {row.companies?.company_name ?? "Employer"}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Unlocked {new Date(row.unlocked_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-ink-muted" aria-hidden />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
