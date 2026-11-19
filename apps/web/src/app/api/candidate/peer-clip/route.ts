import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, readR2Config, createPresignedGetUrl } from "@utn/storage";
import { PRESIGN_TTL_SECONDS } from "@utn/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  targetId: z.string().uuid(),
  questionIndex: z.coerce.number().int().min(1).max(4),
});

export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.presign });
  if (!auth.ok) return auth.response;
  if (auth.caller.role !== "candidate") {
    return apiError(403, "candidate_only", "Only candidates can access peer clips.");
  }

  let body: unknown = {};
  try { body = await request.json(); } catch { body = {}; }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(422, "validation_failed", "Invalid request.");

  const admin = createSupabaseAdminClient();
  if (!admin) return apiError(503, "supabase_not_configured", "Not configured.");

  const { data, error } = await admin.rpc("get_or_record_peer_clip_access", {
    p_viewer_id: auth.caller.userId,
    p_target_id: parsed.data.targetId,
    p_question_index: parsed.data.questionIndex,
  });

  if (error) {
    const code = error.code || "";
    if (code === "42501" || /daily_limit_reached/i.test(error.message)) {
      return apiError(429, "daily_limit_reached", "You've viewed 2 peer clips today. Come back tomorrow.");
    }
    if (/viewer_not_active/i.test(error.message)) {
      return apiError(403, "viewer_not_active", "Your profile must be verified and active.");
    }
    if (/target_not_active/i.test(error.message)) {
      return apiError(404, "target_not_active", "This peer is not available.");
    }
    return apiError(500, "peer_clip_failed", error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;

  // Presigned (short-lived) URL for the peer's pitch video so the viewer can play the clip.
  let videoUrl: string | null = null;
  if (isR2Configured()) {
    const { data: media } = await admin.from("candidate_media").select("video_r2_key").eq("candidate_id", parsed.data.targetId).maybeSingle();
    const key = (media as { video_r2_key: string | null } | null)?.video_r2_key;
    if (key) {
      const config = readR2Config();
      const presigned = await createPresignedGetUrl({ bucket: "pitch-videos", key, expiresInSeconds: 300, config });
      videoUrl = presigned.url;
    }
  }

  return NextResponse.json({ ...row, videoUrl });
}

export function GET() { return methodNotAllowed("POST"); }
