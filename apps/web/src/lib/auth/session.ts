import { redirect } from "next/navigation";
import type { Profile, Role } from "@utn/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionContext {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  profile: Profile;
}

/** Resolves the signed-in user and their profile, or null when unauthenticated. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const metadataName = user.user_metadata?.full_name;

  return {
    user: {
      id: user.id,
      email: user.email ?? profile.email,
      fullName: typeof metadataName === "string" ? metadataName : null,
    },
    profile: profile as Profile,
  };
}

export async function requireSession(nextPath: string): Promise<SessionContext> {
  const context = await getSessionContext();

  if (!context) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return context;
}

export async function requireRole(role: Role, nextPath: string): Promise<SessionContext> {
  const context = await requireSession(nextPath);

  if (context.profile.role !== role) {
    redirect("/dashboard");
  }

  return context;
}
