"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  buildRegistrarEmailDraft,
  formatRegistrarConsentDate,
  isVerificationUrl,
} from "@utn/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function RegistrarVerificationPanel({
  candidateName,
  universityName,
  degreeLevel,
  graduationYear,
  certificateVerificationRef,
  registrarConsentGiven,
  registrarConsentAt,
}: {
  candidateName: string;
  universityName: string;
  degreeLevel: string;
  graduationYear: number;
  certificateVerificationRef: string | null;
  registrarConsentGiven: boolean;
  registrarConsentAt: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const reference = certificateVerificationRef?.trim() ?? "";
  const isLink = isVerificationUrl(reference);
  const consentDate = formatRegistrarConsentDate(registrarConsentAt);
  const draft = buildRegistrarEmailDraft({
    candidateName,
    universityName,
    degreeLevel,
    graduationYear,
    verificationRef: reference,
    consentAt: registrarConsentAt,
  });
  const mailto = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(
    draft.body,
  )}`;

  async function copyReference() {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Registrar verification"
        description="Candidate-supplied reference and the recorded consent audit."
        action={
          registrarConsentGiven ? (
            <Badge tone="emerald">
              <ShieldCheck className="size-3.5" aria-hidden />
              Consent on file
            </Badge>
          ) : (
            <Badge tone="warning">
              <ShieldAlert className="size-3.5" aria-hidden />
              Consent missing
            </Badge>
          )
        }
      />

      <div className="mt-4 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Verification link or serial
          </p>
          <div className="mt-2">
            {isLink ? (
              <div className="rounded-xl border border-line bg-surface-canvas p-3">
                <a
                  href={reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-indigo transition hover:text-accent-indigo-hover"
                >
                  Open University Verification Link
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <p className="mt-1.5 break-all font-mono text-[10px] leading-4 text-ink-muted">
                  {reference}
                </p>
              </div>
            ) : reference ? (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-canvas p-3">
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-ink-primary">
                  {reference}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void copyReference()}
                >
                  {copied ? (
                    <Check className="size-3.5 text-verified-emerald" aria-hidden />
                  ) : (
                    <Copy className="size-3.5" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            ) : (
              <p className="rounded-xl border border-line bg-surface-canvas p-3 text-xs text-ink-muted">
                Not provided
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            Registrar consent
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {registrarConsentGiven ? (
              <>
                <Badge tone="emerald">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Registrar Consent Recorded
                </Badge>
                <span className="text-[11px] text-ink-muted">{consentDate}</span>
              </>
            ) : (
              <Badge tone="warning">
                <ShieldAlert className="size-3.5" aria-hidden />
                Not recorded
              </Badge>
            )}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <a
            href={registrarConsentGiven ? mailto : undefined}
            aria-disabled={!registrarConsentGiven}
            title={
              registrarConsentGiven
                ? "Open a pre-filled registrar verification email"
                : "Registrar consent is required before drafting this email"
            }
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 text-xs font-semibold text-brand-navy shadow-sm transition",
              registrarConsentGiven
                ? "hover:border-ink-muted/40 hover:bg-surface-muted"
                : "pointer-events-none opacity-50",
            )}
          >
            <Mail className="size-3.5" aria-hidden />
            Draft Registrar Email
          </a>
          {!registrarConsentGiven ? (
            <p className="mt-2 text-[11px] leading-4 text-ink-muted">
              Consent must be recorded before a registrar email can be drafted.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
