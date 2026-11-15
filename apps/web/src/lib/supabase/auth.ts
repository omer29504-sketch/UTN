import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabasePublicConfigured } from "@/lib/env";

let anonClient: SupabaseClient | null = null;

/** Anonymous client used only to verify a caller's bearer token. */
export function createSupabaseAuthClient(): SupabaseClient | null {
  if (!isSupabasePublicConfigured()) return null;
  if (!anonClient) {
    anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return anonClient;
}
