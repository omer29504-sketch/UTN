import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, Building2, Filter, Search } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INDUSTRIES, DEGREE_LEVELS } from "@utn/shared";
import type { EmployerCandidateCard } from "@utn/shared";
import { Card } from "@/components/ui/card";
import { CandidateCard } from "@/components/employer/candidate-card";
import type { EmployerViewerIdentity } from "@/components/employer/secure-certificate-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightGlassCard } from "@/components/ui/SpotlightGlassCard";
import { TopographicHeroBg } from "@/components/ui/TopographicHeroBg";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Talent search" };

interface SearchParams {
  q?: string;
  industry?: string;
  degreeLevel?: string;
  university?: string;
  graduationYear?: string;
  maxExperienceYears?: string;
  onlyFeatured?: string;
  page?: string;
}

const PAGE_SIZE = 24;

export default async function EmployerCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession("/employer/candidates");
  if (session.profile.role !== "employer" && session.profile.role !== "admin") {
    return (
      <Alert tone="error" title="Employer access required">
        This page is for employer accounts.
      </Alert>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <Alert tone="error" title="Supabase is not configured">
        Add the public Supabase URL and anon key to <code>apps/web/.env.local</code>.
      </Alert>
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, company_name, is_verified")
    .eq("owner_id", session.user.id)
    .maybeSingle();

  if (!company) {
    return (
      <SpotlightGlassCard className="p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-emerald-soft text-accent-emerald-hover ring-1 ring-inset ring-accent-emerald/15">
          <Building2 className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-brand-navy">
          Set up your company first
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ink-muted">
          Create your company profile to unlock candidate discovery and your trial credits.
        </p>
        <Link
          href="/employer/company"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-jewel-ink px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create company profile
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </SpotlightGlassCard>
    );
  }

  const { data, error } = await supabase.rpc("get_verified_candidates_for_employer", {
    p_search: params.q ?? null,
    p_industry: params.industry ?? null,
    p_degree_level: params.degreeLevel ?? null,
    p_university: params.university ?? null,
    p_graduation_year: params.graduationYear ? Number(params.graduationYear) : null,
    p_max_experience_years: params.maxExperienceYears ? Number(params.maxExperienceYears) : null,
    p_only_featured: params.onlyFeatured === "1" || params.onlyFeatured === "true",
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  // The forensic watermark and the confidentiality gate both need the employer's
  // identity and current click-through state.
  const { data: employerProfile } = await supabase
    .from("profiles")
    .select("employer_tos_accepted_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const employer: EmployerViewerIdentity = {
    employerId: session.user.id,
    employerName: company.company_name,
    employerEmail: session.user.email,
    tosAcceptedAt: (employerProfile?.employer_tos_accepted_at as string | null | undefined) ?? null,
  };

  const rows = (data ?? []) as EmployerCandidateCard[];
  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(Number(totalCount) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <Reveal>
        <section className="border-white/12 relative isolate overflow-hidden rounded-3xl border bg-jewel-ink p-6 text-white shadow-luxe sm:p-8">
          <TopographicHeroBg fadeTo="navy" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-champagne">Candidate discovery</p>
              <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white">
                {company.company_name}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                Browse verified graduates. Pitch videos are free to watch; unlock contact details
                for 1 credit.
              </p>
            </div>
            <Badge tone={company.is_verified ? "emerald" : "warning"}>
              {company.is_verified ? "Verified employer" : "Unverified employer"}
            </Badge>
          </div>
          <div className="relative mt-6 flex flex-wrap gap-2 text-[11px] font-medium text-white/55">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              Verified talent pool
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              Free pitch playback
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
              1 credit per unlock
            </span>
          </div>
        </section>
      </Reveal>

      <Reveal delay={60}>
        <SpotlightGlassCard className="p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            <Filter className="size-3.5 text-accent-emerald-hover" aria-hidden />
            Refine the directory
          </div>
          <form method="get">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Search</label>
                <Input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Headline, university, industry…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Industry</label>
                <Select name="industry" defaultValue={params.industry ?? ""}>
                  <option value="">All industries</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  Degree level
                </label>
                <Select name="degreeLevel" defaultValue={params.degreeLevel ?? ""}>
                  <option value="">All degrees</option>
                  {DEGREE_LEVELS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  University
                </label>
                <Input
                  name="university"
                  defaultValue={params.university ?? ""}
                  placeholder="University name"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  Graduation year
                </label>
                <Input
                  name="graduationYear"
                  type="number"
                  defaultValue={params.graduationYear ?? ""}
                  placeholder="e.g. 2024"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">
                  Max experience (yrs)
                </label>
                <Input
                  name="maxExperienceYears"
                  type="number"
                  defaultValue={params.maxExperienceYears ?? ""}
                  placeholder="e.g. 2"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                  <input
                    type="checkbox"
                    name="onlyFeatured"
                    value="1"
                    className="size-4 accent-[#0E9F6E]"
                    defaultChecked={params.onlyFeatured === "1" || params.onlyFeatured === "true"}
                  />
                  Priority Pro only
                </label>
              </div>
              <div className="flex items-end gap-2 md:col-span-4">
                <Button type="submit" className="gap-2">
                  <Filter className="size-4" aria-hidden />
                  Apply filters
                </Button>
                <Link
                  href="/employer/candidates"
                  className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-surface-muted"
                >
                  Reset
                </Link>
              </div>
            </div>
          </form>
        </SpotlightGlassCard>
      </Reveal>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/employer/candidates" active={!params.onlyFeatured && !params.industry}>
          All candidates
        </FilterPill>
        <FilterPill
          href="/employer/candidates?onlyFeatured=1"
          active={params.onlyFeatured === "1" || params.onlyFeatured === "true"}
        >
          Priority Pro
        </FilterPill>
        {INDUSTRIES.slice(0, 4).map((industry) => (
          <FilterPill
            key={industry}
            href={`/employer/candidates?industry=${encodeURIComponent(industry)}`}
            active={params.industry === industry}
          >
            {industry}
          </FilterPill>
        ))}
      </div>

      {error ? (
        <Alert tone="error" title="Could not load candidates">
          {error.message}
        </Alert>
      ) : null}

      <p className="text-sm text-ink-muted">
        {Number(totalCount)} verified candidate{Number(totalCount) === 1 ? "" : "s"} found.
      </p>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <span className="grid size-14 animate-float-slow place-items-center rounded-2xl bg-accent-emerald-soft text-accent-emerald-hover motion-reduce:animate-none">
            <Search className="size-6" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-brand-navy">
            No candidates match these filters yet.
          </p>
          <p className="text-xs text-ink-muted">
            Try widening your search or resetting the filters.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c, index) => (
            <div
              key={c.candidate_id}
              className="h-full animate-slide-in"
              style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
            >
              <CandidateCard candidate={c} companyId={String(company.id)} employer={employer} />
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={`/employer/candidates?${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
                ),
                page: String(page - 1),
              }).toString()}`}
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-surface-muted"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-sm text-ink-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/employer/candidates?${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
                ),
                page: String(page + 1),
              }).toString()}`}
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-surface-muted"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-300",
        active
          ? "border-accent-emerald/30 bg-accent-emerald-soft text-brand-navy ring-1 ring-inset ring-accent-emerald/15"
          : "border-line/90 bg-white/70 text-ink-muted backdrop-blur-sm hover:border-accent-gold/40 hover:text-brand-navy",
      )}
    >
      {children}
    </Link>
  );
}
