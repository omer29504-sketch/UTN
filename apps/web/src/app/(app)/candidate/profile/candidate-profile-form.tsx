"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import {
  DEGREE_LEVELS,
  INDUSTRIES,
  MAX_EXPERIENCE_YEARS,
  candidateProfileSchema,
  type CandidateProfile,
  type DegreeLevel,
  type Industry,
} from "@utn/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type FormValues = {
  fullName: string;
  headline: string;
  industry: Industry | "";
  universityName: string;
  degreeLevel: DegreeLevel;
  graduationYear: string;
  experienceYears: string;
  phone: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

function initialValues(profile: CandidateProfile | null, defaultName: string | null): FormValues {
  return {
    fullName: profile?.full_name ?? defaultName ?? "",
    headline: profile?.headline ?? "",
    industry: (profile?.industry as Industry | null) ?? "",
    universityName: profile?.university_name ?? "",
    degreeLevel: (profile?.degree_level as DegreeLevel | undefined) ?? "Bachelor's Degree",
    graduationYear: String(profile?.graduation_year ?? new Date().getFullYear()),
    experienceYears: String(profile?.experience_years ?? 0),
    phone: profile?.phone ?? "",
  };
}

export function CandidateProfileForm({
  userId,
  profile,
  defaultName,
}: {
  userId: string;
  profile: CandidateProfile | null;
  defaultName: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => initialValues(profile, defaultName));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);

    const parsed = candidateProfileSchema.safeParse({
      fullName: values.fullName,
      headline: values.headline || undefined,
      industry: values.industry || undefined,
      universityName: values.universityName,
      degreeLevel: values.degreeLevel,
      graduationYear: values.graduationYear,
      experienceYears: values.experienceYears,
      phone: values.phone || undefined,
    });

    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const payload = {
        user_id: userId,
        full_name: parsed.data.fullName,
        headline: parsed.data.headline ?? null,
        industry: parsed.data.industry ?? null,
        university_name: parsed.data.universityName,
        degree_level: parsed.data.degreeLevel,
        graduation_year: parsed.data.graduationYear,
        experience_years: parsed.data.experienceYears,
        phone: parsed.data.phone ?? null,
      };

      const { error } = await supabase
        .from("candidate_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        setFormError(error.message);
        return;
      }

      setSaved(true);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {saved ? (
        <Alert tone="success" title="Profile saved">
          Your details are up to date. Continue with verification when you are ready.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName} required>
          <Input
            id="fullName"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
          />
        </Field>

        <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Optional. Only shared after an employer unlock.">
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            autoComplete="tel"
            placeholder="+27 82 123 4567"
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>
      </div>

      <Field
        label="Headline"
        htmlFor="headline"
        error={errors.headline}
        hint="One line employers see before opening your profile. 140 characters max."
      >
        <Input
          id="headline"
          value={values.headline}
          onChange={(event) => update("headline", event.target.value)}
          placeholder="Graduate software engineer focused on accessible fintech"
          maxLength={140}
          aria-invalid={Boolean(errors.headline)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry" htmlFor="industry" error={errors.industry}>
          <Select
            id="industry"
            value={values.industry}
            onChange={(event) => update("industry", event.target.value as Industry | "")}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Experience" htmlFor="experienceYears" error={errors.experienceYears} required>
          <Select
            id="experienceYears"
            value={values.experienceYears}
            onChange={(event) => update("experienceYears", event.target.value)}
          >
            {Array.from({ length: Math.min(MAX_EXPERIENCE_YEARS, 15) + 1 }, (_, years) => (
              <option key={years} value={years}>
                {years === 0 ? "No professional experience yet" : `${years} year${years === 1 ? "" : "s"}`}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Field label="University" htmlFor="universityName" error={errors.universityName} required>
            <Input
              id="universityName"
              value={values.universityName}
              onChange={(event) => update("universityName", event.target.value)}
              placeholder="University of Cape Town"
              aria-invalid={Boolean(errors.universityName)}
            />
          </Field>
        </div>

        <Field label="Degree" htmlFor="degreeLevel" error={errors.degreeLevel} required>
          <Select
            id="degreeLevel"
            value={values.degreeLevel}
            onChange={(event) => update("degreeLevel", event.target.value as DegreeLevel)}
          >
            {DEGREE_LEVELS.map((degree) => (
              <option key={degree} value={degree}>
                {degree}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Graduation year" htmlFor="graduationYear" error={errors.graduationYear} required>
          <Input
            id="graduationYear"
            type="number"
            inputMode="numeric"
            min={1950}
            max={new Date().getFullYear() + 10}
            value={values.graduationYear}
            onChange={(event) => update("graduationYear", event.target.value)}
            aria-invalid={Boolean(errors.graduationYear)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" loading={pending}>
          <Save className="size-4" aria-hidden />
          Save profile
        </Button>
        <p className="text-xs text-ink-muted">
          Your university and degree are matched against the certificate you upload next.
        </p>
      </div>
    </form>
  );
}
