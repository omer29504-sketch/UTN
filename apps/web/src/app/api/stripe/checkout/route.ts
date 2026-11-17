import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  CANDIDATE_PRO_PLAN,
  CREDIT_PACKS,
  creditPackCheckoutSchema,
  candidateProCheckoutSchema,
  checkoutSchema,
  type CreditPackId,
} from "@utn/shared";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function priceIdForEnvKey(key: string): string {
  return process.env[key]?.trim() ?? "";
}

export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.checkout });
  if (!auth.ok) return auth.response;

  if (!env.stripeSecretKey) {
    return apiError(503, "stripe_not_configured", "Payments are not configured.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Invalid checkout request.", {
      issues: parsed.error.issues,
    });
  }
  const checkoutData = parsed.data;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  const stripe = new Stripe(env.stripeSecretKey);

  try {
    if (checkoutData.kind === "credit_pack") {
      if (auth.caller.role !== "employer") {
        return apiError(403, "employer_only", "Only employers can buy credit packs.");
      }
      const pack = CREDIT_PACKS.find((p) => p.id === checkoutData.packId);
      if (!pack) {
        return apiError(404, "pack_not_found", "That credit pack does not exist.");
      }

      const { data: company, error: companyError } = await admin
        .from("companies")
        .select("id, company_name")
        .eq("owner_id", auth.caller.userId)
        .maybeSingle();
      if (companyError) throw companyError;
      if (!company) {
        return apiError(403, "company_missing", "Create your company profile first.");
      }

      const priceId = priceIdForEnvKey(pack.priceEnvKey);
      if (!priceId) {
        return apiError(
          503,
          "price_not_configured",
          `Stripe price for ${pack.id} is not configured.`,
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${env.appUrl}/employer/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.appUrl}/employer/billing?checkout=cancelled`,
        client_reference_id: auth.caller.userId,
        metadata: {
          kind: "credit_pack",
          companyId: String(company.id),
          packId: pack.id,
          credits: String(pack.credits),
        },
      });

      return NextResponse.json({ url: session.url });
    }

    // candidate_pro
    if (auth.caller.role !== "candidate") {
      return apiError(403, "candidate_only", "Only candidates can buy Priority Pro.");
    }

    const priceId = priceIdForEnvKey(CANDIDATE_PRO_PLAN.priceEnvKey);
    if (!priceId) {
      return apiError(
        503,
        "price_not_configured",
        "Stripe price for Priority Pro is not configured.",
      );
    }

    const { data: profile } = await admin
      .from("candidate_profiles")
      .select("user_id")
      .eq("user_id", auth.caller.userId)
      .maybeSingle();
    if (!profile) {
      return apiError(403, "candidate_profile_missing", "Complete your candidate profile first.");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.appUrl}/candidate/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.appUrl}/candidate/profile?checkout=cancelled`,
      client_reference_id: auth.caller.userId,
      metadata: {
        kind: "candidate_pro",
        candidateId: auth.caller.userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] failed", error);
    return apiError(500, "checkout_failed", "Could not start checkout.");
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
