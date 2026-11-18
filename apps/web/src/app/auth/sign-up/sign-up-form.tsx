"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Eye, EyeOff, GraduationCap, MailCheck } from "lucide-react";
import { signUpMetadataSchema, type SignUpMetadataInput } from "@utn/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authFetch } from "@/lib/api/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "candidate" | "employer";

const roleOptions: {
  value: Role;
  label: string;
  description: string;
  icon: typeof GraduationCap;
}[] = [
  {
    value: "candidate",
    label: "I'm a graduate",
    description: "Verify your degree and publish a pitch.",
    icon: GraduationCap,
  },
  {
    value: "employer",
    label: "I'm hiring",
    description: "Discover verified graduates with a corporate email.",
    icon: Building2,
  },
];

type FieldErrors = Partial<Record<keyof SignUpMetadataInput, string>>;

export function SignUpForm() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("candidate");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = signUpMetadataSchema.safeParse({
      role,
      fullName,
      email,
      password,
      companyName: role === "employer" ? companyName : undefined,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof SignUpMetadataInput;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = `${window.location.origin}/auth/callback?next=/dashboard`;

      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: callbackUrl,
          data: {
            role: parsed.data.role,
            full_name: parsed.data.fullName,
            company_name: parsed.data.companyName ?? null,
            display_logo_consent: true,
          },
        },
      });

      if (error) {
        setFormError(
          error.message.toLowerCase().includes("corporate")
            ? "Use your official work email. Free consumer domains are blocked for employers."
            : error.message,
        );
        return;
      }

      if (data.session) {
        await authFetch("/api/auth/provision", { method: "POST" });
        router.replace(role === "employer" ? "/employer/company" : "/candidate/profile");
        router.refresh();
        return;
      }

      setSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create your account.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-verified-emerald-soft text-verified-emerald">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-primary">
          Confirm your email
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          We sent a confirmation link to <span className="font-semibold">{email}</span>. Open it to
          finish creating your account, then return here to sign in.
        </p>
        <Link
          href="/auth/sign-in"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white"
        >
          Go to sign in
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow text-champagne-ink">Create an account</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink-primary">
        Start with the right profile
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Candidates verify their degree. Employers need an official company email.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
        {roleOptions.map((option) => {
          const active = role === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setRole(option.value);
                setErrors({});
              }}
              className={cn(
                "rounded-xl border p-3.5 text-left transition",
                active
                  ? "border-accent-emerald bg-accent-emerald-soft ring-2 ring-accent-emerald/20"
                  : "border-line bg-surface-card hover:border-accent-gold/50",
              )}
            >
              <option.icon
                className={cn("size-5", active ? "text-accent-emerald-hover" : "text-ink-muted")}
                aria-hidden
              />
              <p className="mt-2 text-sm font-semibold text-ink-primary">{option.label}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-ink-muted">{option.description}</p>
            </button>
          );
        })}
      </div>

      {formError ? (
        <Alert tone="error" className="mt-4">
          {formError}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="Amara Okafor"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fullName)}
          />
        </Field>

        {role === "employer" ? (
          <Field
            label="Company name"
            htmlFor="companyName"
            error={errors.companyName}
            hint="This appears on your employer workspace and the public logo marquee."
            required
          >
            <Input
              id="companyName"
              autoComplete="organization"
              placeholder="Northwind Labs"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              aria-invalid={Boolean(errors.companyName)}
            />
          </Field>
        ) : null}

        <Field
          label={role === "employer" ? "Corporate email" : "Email"}
          htmlFor="email"
          error={errors.email}
          hint={
            role === "employer"
              ? "Gmail, Yahoo, Outlook, Hotmail, and iCloud addresses are blocked."
              : undefined
          }
          required
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={role === "employer" ? "you@company.com" : "you@example.com"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          required
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-11"
              aria-invalid={Boolean(errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted transition hover:text-ink-primary"
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
          Create account
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href="/auth/sign-in"
          className="font-semibold text-accent-emerald-hover hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
