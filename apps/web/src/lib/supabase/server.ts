import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabasePublicConfigured } from "@/lib/env";

/**
 * RLS-scoped server client. Uses the caller's cookies, so every query runs with
 * the signed-in user's permissions. Returns null when the project is unset.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabasePublicConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies. Middleware refreshes the
          // session, so ignoring this write is safe in render paths.
        }
      },
    },
  });
}
