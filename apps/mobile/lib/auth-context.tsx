import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type {
  Profile,
  Role,
  SignInInput,
  SignUpMetadataInput,
} from "@utn/shared";

import { apiFetch } from "./api";
import { supabase, supabaseConfigured } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  configured: boolean;
  signIn: (input: SignInInput) => Promise<{ error: string | null }>;
  signUp: (
    input: SignUpMetadataInput,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] profile lookup failed", error.message);
    return null;
  }

  return (data as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      return;
    }
    setProfile(await fetchProfile(nextSession.user.id));
  }, []);

  const refreshProfile = useCallback(async () => {
    const {
      data: { session: current },
    } = await supabase.auth.getSession();
    setSession(current);
    await loadProfile(current);
  }, [loadProfile]);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session);
      })
      .catch((error) => {
        console.error("[auth] session restore failed", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void loadProfile(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (input: SignInInput): Promise<{ error: string | null }> => {
      if (!supabaseConfigured) {
        return {
          error: "Authentication is not configured. Add the Supabase public URL and anon key.",
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword(input);

      if (error) {
        return {
          error: error.message.toLowerCase().includes("invalid login")
            ? "That email and password combination is not correct."
            : error.message,
        };
      }

      if (!data.session) {
        return {
          error:
            "Your email is not confirmed yet. Open the confirmation link in your inbox, then sign in again.",
        };
      }

      setSession(data.session);
      await loadProfile(data.session);

      // Idempotent employer provisioning; a failure must not block sign-in.
      try {
        await apiFetch("/api/auth/provision", { method: "POST" });
      } catch (provisionError) {
        console.error("[auth] provisioning request failed", provisionError);
      }

      return { error: null };
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (
      input: SignUpMetadataInput,
    ): Promise<{ error: string | null; needsConfirmation: boolean }> => {
      if (!supabaseConfigured) {
        return {
          error: "Authentication is not configured. Add the Supabase public URL and anon key.",
          needsConfirmation: false,
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            role: input.role,
            full_name: input.fullName,
            company_name: input.companyName ?? null,
            display_logo_consent: true,
          },
        },
      });

      if (error) {
        const lower = error.message.toLowerCase();
        return {
          error: lower.includes("corporate")
            ? "Use your official work email. Free consumer domains are blocked for employers."
            : error.message,
          needsConfirmation: false,
        };
      }

      if (!data.session) {
        return { error: null, needsConfirmation: true };
      }

      setSession(data.session);
      await loadProfile(data.session);

      try {
        await apiFetch("/api/auth/provision", { method: "POST" });
      } catch (provisionError) {
        console.error("[auth] provisioning request failed", provisionError);
      }

      return { error: null, needsConfirmation: false };
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: (profile?.role as Role | undefined) ?? null,
      loading,
      configured: supabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
