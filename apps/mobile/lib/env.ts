/**
 * Expo public environment access.
 *
 * EXPO_PUBLIC_* values are inlined at build time, so they must be referenced
 * literally. Falls back to the local Next.js server for development.
 */

function read(value: string | undefined): string {
  return value?.trim() ?? "";
}

export const env = {
  get apiUrl() {
    return read(process.env.EXPO_PUBLIC_API_URL) || "http://localhost:3000";
  },
  get supabaseUrl() {
    return read(process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return read(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  },
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
