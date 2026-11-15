/**
 * Environment access with safe fallbacks. Values are read lazily so a missing
 * secret never breaks `next build`; routes fail closed at request time instead.
 */

/**
 * NEXT_PUBLIC_* values must be referenced statically so Next.js can inline them
 * into client bundles. Dynamic `process.env[key]` lookups are not replaced and
 * return undefined in the browser. Server-only secrets stay behind `read()` so
 * they are never bundled into the client.
 */
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
const publicStripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";

function read(key: string): string {
  return process.env[key]?.trim() ?? "";
}

export const env = {
  get supabaseUrl() {
    return publicSupabaseUrl;
  },
  get supabaseAnonKey() {
    return publicSupabaseAnonKey;
  },
  get supabaseServiceRoleKey() {
    return read("SUPABASE_SERVICE_ROLE_KEY");
  },
  get appUrl() {
    return publicAppUrl || "http://localhost:3000";
  },
  get publicLogosBaseUrl() {
    return read("R2_PUBLIC_LOGOS_BASE_URL");
  },
  get stripeSecretKey() {
    return read("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return read("STRIPE_WEBHOOK_SECRET");
  },
  get stripePublishableKey() {
    return publicStripePublishableKey;
  },
};

export function isSupabasePublicConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}
