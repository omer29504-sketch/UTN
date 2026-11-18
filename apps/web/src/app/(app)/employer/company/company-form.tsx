"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save } from "lucide-react";
import { getEmailDomain, isCorporateEmail, type Company } from "@utn/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CompanyForm({
  userId,
  email,
  company,
}: {
  userId: string;
  email: string;
  company: Company | null;
}) {
  const router = useRouter();
  const domain = getEmailDomain(email) ?? "";

  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [displayLogoConsent, setDisplayLogoConsent] = useState(
    company?.display_logo_consent ?? true,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const trimmed = companyName.trim();
    if (trimmed.length < 2) {
      setError("Enter your company name (at least 2 characters).");
      return;
    }

    if (!isCorporateEmail(email)) {
      setError(
        "Your account email is a free consumer domain. Employer accounts require an official corporate email.",
      );
      return;
    }

    setPending(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error: saveError } = company
        ? await supabase
            .from("companies")
            .update({ company_name: trimmed, display_logo_consent: displayLogoConsent })
            .eq("id", company.id)
        : await supabase.from("companies").insert({
            owner_id: userId,
            company_name: trimmed,
            corporate_domain: domain,
            display_logo_consent: displayLogoConsent,
          });

      if (saveError) {
        setError(saveError.message);
        return;
      }

      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your company.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? (
        <Alert tone="success" title="Company saved">
          Your employer workspace is ready. Candidate discovery arrives in Phase 3.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Company name"
          htmlFor="companyName"
          hint="Shown to candidates and, with consent, on the landing-page marquee."
          required
        >
          <Input
            id="companyName"
            value={companyName}
            onChange={(event) => {
              setCompanyName(event.target.value);
              setSaved(false);
            }}
            autoComplete="organization"
            placeholder="Northwind Labs"
          />
        </Field>

        <Field
          label="Corporate email"
          htmlFor="corporateEmail"
          hint="Your domain is locked to this email to prevent trial-credit farming."
        >
          <Input id="corporateEmail" value={email} readOnly disabled />
        </Field>
      </div>

      <Field
        label="Corporate domain"
        htmlFor="domain"
        hint="Automatically derived from your work email."
      >
        <Input id="domain" value={domain} readOnly disabled />
      </Field>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-canvas p-4">
        <input
          type="checkbox"
          checked={displayLogoConsent}
          onChange={(event) => {
            setDisplayLogoConsent(event.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 size-4 rounded border-line text-accent-emerald-hover focus:ring-accent-emerald"
        />
        <span>
          <span className="block text-sm font-semibold text-ink-primary">
            Show our logo on the landing page
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
            Only verified companies with consent appear in the unlimited logo marquee. You can opt
            out at any time.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button type="submit" loading={pending}>
          <Save className="size-4" aria-hidden />
          {company ? "Save company" : "Create company profile"}
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Building2 className="size-3.5" aria-hidden />
          Two trial credits are granted once per company.
        </p>
      </div>
    </form>
  );
}
