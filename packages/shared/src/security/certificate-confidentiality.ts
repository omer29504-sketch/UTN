import { z } from "zod";
import { uuidSchema } from "../schemas";

/**
 * Employer confidentiality, credential-security and anti-capture contracts.
 *
 * Shared by the Next.js web viewer and the Expo mobile viewer so the legal copy,
 * the mandatory checkbox label, the acknowledgment lifetime, the watermark
 * format and the audit-event vocabulary can never drift between platforms.
 *
 * This module is React/DOM/Node free and safe to import from any runtime.
 */

// ── Legal copy ──────────────────────────────────────────────────────────────

/** Bump whenever the clause text below changes. Stored on acceptance. */
export const EMPLOYER_TOS_VERSION = "v1.0";

/** Canonical public route that renders the full clause. */
export const EMPLOYER_CONFIDENTIALITY_ROUTE = "/legal/employer-confidentiality";

export interface ConfidentialitySection {
  /** Short heading, e.g. "Section 1 — Confidentiality of Candidate Academic Records". */
  readonly heading: string;
  readonly body: string;
}

export interface ConfidentialityClause {
  readonly title: string;
  readonly version: string;
  readonly sections: readonly ConfidentialitySection[];
}

/**
 * Exact legal clause rendered in the click-through modal, the certificate
 * viewer gate, and the public /legal/employer-confidentiality page.
 */
export const EMPLOYER_CONFIDENTIALITY_CLAUSE: ConfidentialityClause = {
  title: "CONFIDENTIALITY AND CREDENTIAL SECURITY CLAUSE FOR EMPLOYERS",
  version: EMPLOYER_TOS_VERSION,
  sections: [
    {
      heading: "Section 1 — Confidentiality of Candidate Academic Records",
      body: 'All academic credentials, diplomas, transcripts, verification references, and associated personal data of candidates viewed, accessed, or unlocked through University Talent Network (the "Platform") constitute strict Confidential Proprietary Data (the "Confidential Information"). Confidential Information is made available to registered employers solely and exclusively for the purpose of evaluating prospective employment candidates.',
    },
    {
      heading: "Section 2 — Strict Prohibition of Duplication and Capture",
      body: "Employers, hiring managers, and corporate representatives are strictly prohibited from: (a) Downloading, saving, exporting, or mirroring digital certificate files or streams to local or cloud storage; (b) Capturing screenshots, screen recordings, video feeds, or printing any portion of candidate credentials displayed on the Platform; (c) Utilizing external cameras, secondary mobile devices, hardware capture cards, or optical software to photograph or record screens displaying candidate documents; (d) Redistributing, sharing, or disclosing candidate credentials to any third party, external affiliate, or non-participating entity without the express prior written consent of both the candidate and the Platform.",
    },
    {
      heading: "Section 3 — Forensic Watermarking and Technical Monitoring",
      body: "To ensure accountability, all viewed documents are dynamically watermarked with the accessing employer's corporate identity, user credentials, IP address, and real-time access timestamps. The Platform employs continuous security monitoring, focus-loss detection, and session timeouts (enforced at least every sixty [60] minutes) to protect candidate privacy. Any attempt to disable, bypass, or circumvent these technical security controls constitutes an immediate breach of this Agreement.",
    },
    {
      heading: "Section 4 — Remedies for Breach and Liquidated Damages",
      body: "In the event of an unauthorized download, screenshot, screen capture, or breach of confidentiality by an employer or its representatives: (a) Immediate Termination: The Platform reserves the right to immediately suspend or terminate the employer's account, forfeit all remaining credit balances, and revoke platform access without notice; (b) Legal Liability & Statutory Action: Unauthorized extraction, misappropriation, or redistribution of candidate records is a violation of applicable regional cybercrime legislation, data protection laws, and intellectual property frameworks. The offending corporate entity shall be held fully liable for civil damages, injunctive relief, and legal costs arising from the breach.",
    },
  ],
};

/** Mandatory click-through checkbox label (must be ticked before first view). */
export const EMPLOYER_CONFIDENTIALITY_CHECKBOX_LABEL =
  "I have read and agree to the Employer Confidentiality & Credential Security Terms, and I acknowledge that downloading, printing, or capturing candidate certificates is strictly prohibited.";

/** Shown inside the every-open / hourly re-acknowledgment warning modal. */
export const CERTIFICATE_WARNING_POINTS = [
  "This document must be treated strictly as private documentation.",
  "Downloading, printing, screenshotting, or capturing the screen with another camera or device is strictly prohibited.",
  "Your corporate identity, account email, IP address, and access time are watermarked on this document and logged.",
] as const;

export const CERTIFICATE_REACK_BUTTON_LABEL = "I Acknowledge & Continue Viewing";

export const CERTIFICATE_VIEWER_PRIVACY_SHIELD_TEXT = "Document hidden while window is inactive";

// ── Timing ──────────────────────────────────────────────────────────────────

/** Acknowledgment is valid for one hour, then the viewer re-locks. */
export const CERTIFICATE_ACK_TTL_MS = 60 * 60 * 1000; // 3,600,000 ms

/** Live expiry poll (the 1-hour check runs every 10 seconds). */
export const CERTIFICATE_ACK_TICK_MS = 10 * 1000;

/** The forensic watermark timestamp refreshes once a minute. */
export const WATERMARK_REFRESH_MS = 60 * 1000;

// ── Audit event vocabulary (mirrors the DB check constraint) ────────────────

export const DOCUMENT_AUDIT_EVENT_TYPES = [
  "tos_accepted",
  "certificate_viewed",
  "hourly_reack_completed",
  "focus_loss_blur",
  "screenshot_attempt",
  "print_or_devtools_attempt",
] as const;

export type DocumentAuditEventType = (typeof DOCUMENT_AUDIT_EVENT_TYPES)[number];

export const DOCUMENT_AUDIT_EVENT_LABELS: Record<DocumentAuditEventType, string> = {
  tos_accepted: "Confidentiality terms accepted",
  certificate_viewed: "Certificate opened in secure viewer",
  hourly_reack_completed: "Hourly re-acknowledgment completed",
  focus_loss_blur: "Viewer hidden (window lost focus)",
  screenshot_attempt: "Screenshot attempt detected",
  print_or_devtools_attempt: "Print / save / devtools attempt blocked",
};

// ── Zod contracts ───────────────────────────────────────────────────────────

/**
 * Telemetry body posted to /api/employer/certificates/security-event.
 * `candidateId` is mandatory because every audit row is bound to the document
 * that was (or was about to be) displayed.
 */
export const documentAuditEventSchema = z.object({
  eventType: z.enum(DOCUMENT_AUDIT_EVENT_TYPES, {
    message: "Unknown security event type.",
  }),
  candidateId: uuidSchema,
});

export type DocumentAuditEventInput = z.infer<typeof documentAuditEventSchema>;

/**
 * Click-through acknowledgment. `accepted` must be literally true — an
 * unchecked or missing checkbox can never pass validation.
 */
export const employerConfidentialityAckSchema = z.object({
  accepted: z.literal(true, {
    message: "You must accept the Employer Confidentiality & Credential Security Terms.",
  }),
  candidateId: uuidSchema.optional(),
  tosVersion: z.string().trim().max(32).optional(),
});

export type EmployerConfidentialityAckInput = z.infer<typeof employerConfidentialityAckSchema>;

// ── Watermark helpers ───────────────────────────────────────────────────────

const WATERMARK_SEPARATOR = " • ";

/** First 8 characters of the employer uuid, used as the forensic short id. */
export function shortEmployerId(employerId: string): string {
  return employerId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

/** `2026-11-15 14:03 UTC` */
export function formatWatermarkTimestamp(date: Date = new Date()): string {
  const iso = date.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export interface WatermarkSignatureInput {
  employerName: string;
  employerEmail: string;
  employerId: string;
  at?: Date;
}

/**
 * `Northwind Labs • hiring@northwindlabs.com • ID: 1a2b3c4d • 2026-11-15 14:03 UTC`
 *
 * Rendered onto canvas pixels, as an SVG overlay on web, and over the image on
 * mobile. The server stores the same string in document_access_logs.
 */
export function buildWatermarkSignature(input: WatermarkSignatureInput): string {
  const name = input.employerName.trim() || "Employer";
  const email = input.employerEmail.trim().toLowerCase() || "unknown@employer";
  const id = shortEmployerId(input.employerId);
  const stamp = formatWatermarkTimestamp(input.at ?? new Date());
  return [name, email, `ID: ${id}`, stamp].join(WATERMARK_SEPARATOR);
}

/** True once the acknowledgment is older than CERTIFICATE_ACK_TTL_MS. */
export function isCertificateAckExpired(lastAckAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs - lastAckAtMs >= CERTIFICATE_ACK_TTL_MS;
}

/** Milliseconds left before a re-acknowledgment is required (never negative). */
export function certificateAckRemainingMs(lastAckAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, CERTIFICATE_ACK_TTL_MS - (nowMs - lastAckAtMs));
}

/** `59:41` — countdown shown in the warning modal. */
export function formatAckCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Convenience predicate used by both viewers. */
export function hasAcceptedEmployerTos(acceptedAt: string | null | undefined): boolean {
  return typeof acceptedAt === "string" && acceptedAt.trim().length > 0;
}
