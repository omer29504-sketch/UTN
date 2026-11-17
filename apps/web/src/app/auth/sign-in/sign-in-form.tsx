"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { signInSchema, type SignInInput } from "@utn/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authFetch } from "@/lib/api/client";
import { safeNextPath } from "@/lib/auth/redirect";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const initialError = searchParams.get("error");

  const [values, setValues] = useState<SignInInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SignInInput, string>>>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof SignInInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignInInput;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

      if (error) {
        setFormError(
          error.message.toLowerCase().includes("invalid login")
            ? "That email and password combination is not correct."
            : error.message,
        );
        return;
      }

      if (!data.session) {
        setFormError(
          "Your email is not confirmed yet. Check your inbox for the confirmation link.",
        );
        return;
      }

      await authFetch("/api/auth/provision", { method: "POST" });
      router.replace(next);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign you in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="eyebrow text-accent-gold-hover">Welcome back</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-navy">
        Sign in to your account
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Continue your verification, review queue, or employer workspace.
      </p>

      {formError ? (
        <Alert tone="error" className="mt-5">
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={(event) =>
              setValues((current) => ({ ...current, email: event.target.value }))
            }
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password} required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              value={values.password}
              onChange={(event) =>
                setValues((current) => ({ ...current, password: event.target.value }))
              }
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted transition hover:text-brand-navy"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </Field>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Sign in
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        New here?{" "}
        <Link href="/auth/sign-up" className="font-semibold text-accent-emerald hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-line bg-white p-3.5 text-xs text-ink-muted">
        <p className="font-semibold text-brand-navy">Local demo accounts</p>
        <p className="mt-1">
          Candidate <span className="font-mono">amara.okafor@gmail.com</span> · Employer{" "}
          <span className="font-mono">hiring@northwindlabs.com</span> · Admin{" "}
          <span className="font-mono">admin@utn.dev</span>
        </p>
        <p className="mt-1">Passwords are listed in the README (local development only).</p>
      </div>
    </div>
  );
}
