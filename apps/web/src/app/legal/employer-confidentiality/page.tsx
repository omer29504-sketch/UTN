import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  EMPLOYER_CONFIDENTIALITY_CLAUSE,
  EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL,
} from "@utn/shared";

export const metadata: Metadata = {
  title: "Employer Confidentiality Clause",
  description:
    "The confidentiality and credential security terms every employer must accept before viewing candidate certificates.",
  robots: { index: false, follow: false },
};

/**
 * Canonical public copy of the employer confidentiality clause.
 *
 * The same constant renders inside the click-through gate in the secure
 * certificate viewer and in the mobile app, so this page can never drift from
 * what an employer actually accepts.
 */
export default function EmployerConfidentialityPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <Link
        href="/employer/candidates"
        className="inline-flex items-center gap-2 text-sm font-semibold text-accent-indigo hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to candidates
      </Link>

      <header className="mt-6 rounded-3xl border border-line bg-brand-navy p-6 text-white shadow-card sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-verified-emerald/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-verified-emerald">
          <ShieldCheck className="size-3.5" aria-hidden />
          Version {EMPLOYER_CONFIDENTIALITY_CLAUSE.version}
        </span>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {EMPLOYER_CONFIDENTIALITY_CLAUSE.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
          This clause governs every candidate credential viewed through University Talent Network.
          Accepting it is mandatory before any certificate can be displayed.
        </p>
      </header>

      <article className="mt-8 space-y-8 rounded-2xl border border-line bg-surface-card p-6 shadow-card sm:p-8">
        {EMPLOYER_CONFIDENTIALITY_CLAUSE.sections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="font-display text-lg font-bold text-brand-navy">{section.heading}</h2>
            <p className="text-sm leading-7 text-ink-muted">{section.body}</p>
          </section>
        ))}

        <div className="rounded-xl border border-verified-emerald/30 bg-verified-emerald/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Acknowledgment required
          </p>
          <p className="mt-2 text-sm leading-6 text-brand-navy">
            {EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL}
          </p>
        </div>
      </article>
    </main>
  );
}
