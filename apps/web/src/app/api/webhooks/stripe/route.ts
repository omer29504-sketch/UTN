import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { securityLog } from "@/lib/security/log";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/security/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stripeSessionToUuid(sessionId: string): string {
  // Deterministic UUID derived from the Stripe session id so the credit
  // ledger's (company_id, reason, reference_id) unique index provides
  // idempotency for retried webhook deliveries.
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const hash = crypto.createHash("sha256").update(sessionId).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x40;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function POST(request: Request) {
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  // Signature verification is cheap but not free. Cap floods by source IP so
  // forged deliveries cannot burn CPU; Stripe retries legitimate events.
  const limited = await enforceRateLimit(requestIp(request) ?? "unknown-ip", RATE_LIMITS.webhook);
  if (limited) {
    securityLog("stripe_webhook_rate_limited", { ip: requestIp(request) });
    return limited;
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Stripe events are small; refuse oversized deliveries before buffering.
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 512 * 1024) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(env.stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  } catch (err) {
    console.error("[webhooks/stripe] signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const kind = metadata.kind;

      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }

      if (kind === "credit_pack") {
        const companyId = metadata.companyId;
        const credits = Number(metadata.credits ?? "0");
        const packId = metadata.packId ?? "unknown";
        if (!companyId || !credits) {
          console.error("[webhooks/stripe] missing credit metadata", metadata);
          return NextResponse.json({ received: true });
        }

        const referenceId = stripeSessionToUuid(session.id);
        const { error } = await admin.from("credit_ledger").insert({
          company_id: companyId,
          delta: credits,
          reason: "stripe_credit_pack",
          reference_id: referenceId,
        });
        // Unique violation means we already processed this session — idempotent.
        if (error && !/duplicate|unique/i.test(error.message ?? "")) {
          throw error;
        }
        console.log(
          `[webhooks/stripe] granted ${credits} credits to company ${companyId} (pack ${packId})`,
        );
      } else if (kind === "candidate_pro") {
        const candidateId = metadata.candidateId;
        if (!candidateId) {
          console.error("[webhooks/stripe] missing candidate metadata", metadata);
          return NextResponse.json({ received: true });
        }
        const { error } = await admin
          .from("candidate_profiles")
          .update({ is_featured: true })
          .eq("user_id", candidateId);
        if (error) throw error;
        console.log(`[webhooks/stripe] upgraded candidate ${candidateId} to Priority Pro`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[webhooks/stripe] processing failed", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
