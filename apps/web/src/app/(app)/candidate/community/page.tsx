import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peer Community" };

export default async function CommunityPage() {
  const session = await requireSession("/candidate/community");
  if (session.profile.role !== "candidate") redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return <Alert tone="error" title="Supabase is not configured">Add env vars.</Alert>;
  }

  // Today's views
  const { data: views } = await supabase
    .from("candidate_peer_views")
    .select("target_candidate_id")
    .eq("viewer_candidate_id", session.user.id)
    .eq("viewed_date", new Date().toISOString().slice(0, 10));

  const viewedIds = new Set((views ?? []).map((v: { target_candidate_id: string }) => v.target_candidate_id));
  const viewsUsed = viewedIds.size;
  const viewsRemaining = Math.max(0, 2 - viewsUsed);

  // Active verified peers (excluding self)
  const { data: peers } = await supabase
    .from("candidate_profiles")
    .select("user_id, full_name, major_specialization, degree_level, profile_expires_at")
    .eq("verification_status", "verified")
    .neq("user_id", session.user.id)
    .limit(20);

  const activePeers = (peers ?? []).filter((p: { profile_expires_at: string | null }) => {
    if (!p.profile_expires_at) return true;
    return new Date(p.profile_expires_at) > new Date();
  });

  return (
    <div className="space-y-6">
      <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative">
          <p className="eyebrow text-champagne">Verified Peer Community</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
            Learn from your peers
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
            Watch one question clip from a verified peer each day. 2 peers per day, 1 question each.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white">
            {viewsRemaining} of 2 Peer Insights Remaining Today
          </div>
        </div>
      </section>

      {viewsRemaining === 0 ? (
        <Alert tone="info" title="Daily limit reached">
          You've viewed 2 peer clips today. Come back tomorrow for fresh insights.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activePeers.map((peer: { user_id: string; full_name: string; major_specialization: string | null; degree_level: string }) => {
          const alreadyViewed = viewedIds.has(peer.user_id);
          const nameParts = (peer.full_name || "").trim().split(/\s+/);
          const label = nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1]?.charAt(0) ?? ""}.`
            : nameParts[0] || "Peer";
          return (
            <Reveal key={peer.user_id}>
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge tone="emerald">UTN Core Verified</Badge>
                  {alreadyViewed ? <Badge tone="neutral">Viewed</Badge> : null}
                </div>
                <p className="font-display text-lg font-bold text-brand-navy">{label}</p>
                <p className="text-xs text-ink-muted">{peer.major_specialization || peer.degree_level}</p>
                <p className="text-[11px] text-ink-muted">1 question clip available</p>
                <Link href={`/candidate/community/${peer.user_id}`}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={viewsRemaining === 0 && !alreadyViewed}
                  >
                    Watch Peer Answer (1 Question)
                  </Button>
                </Link>
              </Card>
            </Reveal>
          );
        })}
        {activePeers.length === 0 ? (
          <p className="col-span-full text-sm text-ink-muted">No active peers available right now.</p>
        ) : null}
      </div>
    </div>
  );
}
