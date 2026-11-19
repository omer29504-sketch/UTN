import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";
import { QuestionChapterPlayer } from "@/components/verification/question-chapter-player";
import { PeerClipPlayer } from "@/components/candidate/peer-clip-player";
import { authFetch, readApiError } from "@/lib/api/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peer Clip" };

export default async function PeerClipPage({ params }: { params: Promise<{ peerId: string }> }) {
  const session = await requireSession("/candidate/community");
  if (session.profile.role !== "candidate") redirect("/dashboard");
  const { peerId } = await params;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <Alert tone="error" title="Not configured">Add env vars.</Alert>;

  const { data: peer } = await supabase
    .from("candidate_profiles")
    .select("user_id, full_name, major_specialization, degree_level")
    .eq("user_id", peerId)
    .maybeSingle();

  if (!peer) return <Alert tone="warning" title="Peer not found">This peer is not available.</Alert>;

  const nameParts = (peer.full_name || "").trim().split(/\s+/);
  const label = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.` : nameParts[0];

  return (
    <div className="space-y-6">
      <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
        <TopographicHeroBg fadeTo="navy" />
        <div className="relative">
          <p className="eyebrow text-champagne">Peer Clip</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">{label}</h1>
          <p className="mt-2 text-sm text-white/60">{peer.major_specialization || peer.degree_level}</p>
          <Badge tone="emerald" className="mt-3">UTN Core Verified</Badge>
        </div>
      </section>
      <PeerClipPlayer peerId={peerId} peerLabel={label} major={peer.major_specialization} />

      <div className="mt-4">
        <a href="/candidate/community">
          <Button variant="secondary" size="sm">Back to community</Button>
        </a>
      </div>
    </div>
  );
}
