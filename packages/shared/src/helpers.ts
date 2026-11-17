import {
  BLOCKED_CORPORATE_EMAIL_DOMAINS,
  MAX_PITCH_SECONDS,
  MIN_PITCH_SECONDS,
  PITCH_VIDEO_SPEC,
  STORAGE_BUCKET_NAMES,
  TELEPROMPTER_CUES,
  type StorageBucket,
} from "./constants";

// ── Email helpers ────────────────────────────────────────────────────────────

export function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1) || null;
}

export function isBlockedConsumerDomain(domain: string): boolean {
  return (BLOCKED_CORPORATE_EMAIL_DOMAINS as readonly string[]).includes(
    domain.trim().toLowerCase(),
  );
}

export function isConsumerEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain ? isBlockedConsumerDomain(domain) : false;
}

/**
 * Lightweight non-throwing companion to `corporateEmailSchema`.
 * Use the Zod schema when you need a human-readable validation message.
 */
export function isCorporateEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  if (isBlockedConsumerDomain(domain)) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

// ── Pitch recording helpers ──────────────────────────────────────────────────

/** Format as MM:SS (e.g. 60 → "01:00"). */
export function formatPitchDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function canSubmitPitch(elapsedSeconds: number): boolean {
  return elapsedSeconds >= MIN_PITCH_SECONDS && elapsedSeconds <= MAX_PITCH_SECONDS;
}

/** 0 → 1 progress around the 60s completion ring. */
export function getPitchProgress(elapsedSeconds: number): number {
  return Math.min(1, Math.max(0, elapsedSeconds / MIN_PITCH_SECONDS));
}

export function getTeleprompterCue(elapsedSeconds: number) {
  return (
    TELEPROMPTER_CUES.find(
      (cue) => elapsedSeconds >= cue.startSeconds && elapsedSeconds < cue.endSeconds,
    ) ?? TELEPROMPTER_CUES[0]
  );
}

export function estimatePitchBytes(seconds: number): number {
  const clamped = Math.min(MAX_PITCH_SECONDS, Math.max(0, seconds));
  return Math.round((PITCH_VIDEO_SPEC.videoBitsPerSecond / 8) * clamped);
}

export function isAcceptablePitchSize(bytes: number): boolean {
  return bytes >= PITCH_VIDEO_SPEC.minUploadBytes && bytes <= PITCH_VIDEO_SPEC.maxUploadBytes;
}

/** Pick the first MIME type the current MediaRecorder implementation supports. */
export function pickSupportedRecordingMime(
  isSupported: (mime: string) => boolean,
  candidates: readonly string[],
): string | null {
  return candidates.find((mime) => isSupported(mime)) ?? null;
}

// ── Degree verification helpers ──────────────────────────────────────────────

/** True only for absolute http(s) URLs, so admin links never render unsafe schemes. */
export function isVerificationUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Human-readable consent date shared by the admin queue and detail views. */
export function formatRegistrarConsentDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export interface RegistrarEmailDraftInput {
  candidateName: string;
  degreeLevel: string;
  universityName: string;
  graduationYear: number;
  verificationRef?: string | null;
  consentAt?: string | null;
}

/**
 * Builds the formal registrar verification email used by the admin mailto link.
 * Subject matches the review workflow exactly; the body includes every field a
 * registrar needs to locate the candidate's record.
 */
export function buildRegistrarEmailDraft(input: RegistrarEmailDraftInput): {
  subject: string;
  body: string;
} {
  const reference = input.verificationRef?.trim();
  const consentDate = formatRegistrarConsentDate(input.consentAt);
  const subject = `Degree Verification Request — ${input.candidateName} (${input.graduationYear})`;
  const body = [
    `Dear ${input.universityName} Registrar's Office,`,
    "",
    `I am writing on behalf of University Talent Network to request verification of the degree credential presented by ${input.candidateName}.`,
    "",
    "Candidate details:",
    `- Full name: ${input.candidateName}`,
    `- Degree: ${input.degreeLevel}`,
    `- Graduation year: ${input.graduationYear}`,
    `- Certificate reference / serial: ${reference ? reference : "Not provided"}`,
    "",
    `The candidate granted written digital consent for us to contact your office on ${consentDate}. Please confirm whether the candidate was awarded the degree stated above.`,
    "",
    "If you require any additional information or a copy of the consent record, please reply to this email.",
    "",
    "Kind regards,",
    "University Talent Network",
    "Degree Verification Team",
  ].join("\n");

  return { subject, body };
}

// ── Presentation helpers ─────────────────────────────────────────────────────

/**
 * Deterministic client-side masker for optimistic/preview UI. The database RPC
 * is the source of truth; its suffix is derived from the candidate UUID.
 */
export function maskCandidateName(candidateId: string, prefix = "Verified Candidate"): string {
  let hash = 0;
  for (let i = 0; i < candidateId.length; i += 1) {
    hash = (hash * 31 + candidateId.charCodeAt(i)) >>> 0;
  }
  return `${prefix} #${String(hash % 10_000).padStart(4, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"] as const;
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatCreditBalance(balance: number): string {
  return `${Math.max(0, Math.trunc(balance))} ${Math.abs(balance) === 1 ? "credit" : "credits"}`;
}

export const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function extensionForMimeType(mimeType: string): string {
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? "bin";
}

export type SniffedContentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "video/mp4"
  | "video/quicktime"
  | "video/webm";

function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? -1;
}

/**
 * Detects the real content type from magic bytes.
 *
 * Presigned uploads sign the *declared* Content-Type, which stops accidental
 * mismatches but not a caller that uploads arbitrary bytes. Server-side readers
 * (OCR, certificate streaming) use this to reject polyglots and mislabeled
 * files before handing them to a renderer or a WASM worker.
 */
export function sniffContentType(bytes: Uint8Array): SniffedContentType | null {
  if (
    byteAt(bytes, 0) === 0x25 &&
    byteAt(bytes, 1) === 0x50 &&
    byteAt(bytes, 2) === 0x44 &&
    byteAt(bytes, 3) === 0x46 &&
    byteAt(bytes, 4) === 0x2d
  ) {
    return "application/pdf";
  }

  if (byteAt(bytes, 0) === 0xff && byteAt(bytes, 1) === 0xd8 && byteAt(bytes, 2) === 0xff) {
    return "image/jpeg";
  }

  if (
    byteAt(bytes, 0) === 0x89 &&
    byteAt(bytes, 1) === 0x50 &&
    byteAt(bytes, 2) === 0x4e &&
    byteAt(bytes, 3) === 0x47 &&
    byteAt(bytes, 4) === 0x0d &&
    byteAt(bytes, 5) === 0x0a &&
    byteAt(bytes, 6) === 0x1a &&
    byteAt(bytes, 7) === 0x0a
  ) {
    return "image/png";
  }

  const riff =
    byteAt(bytes, 0) === 0x52 &&
    byteAt(bytes, 1) === 0x49 &&
    byteAt(bytes, 2) === 0x46 &&
    byteAt(bytes, 3) === 0x46;

  if (riff) {
    if (
      byteAt(bytes, 8) === 0x57 &&
      byteAt(bytes, 9) === 0x45 &&
      byteAt(bytes, 10) === 0x42 &&
      byteAt(bytes, 11) === 0x50
    ) {
      return "image/webp";
    }
    if (
      byteAt(bytes, 8) === 0x57 &&
      byteAt(bytes, 9) === 0x45 &&
      byteAt(bytes, 10) === 0x42 &&
      byteAt(bytes, 11) === 0x4d
    ) {
      return "video/webm";
    }
  }

  if (
    byteAt(bytes, 4) === 0x66 &&
    byteAt(bytes, 5) === 0x74 &&
    byteAt(bytes, 6) === 0x79 &&
    byteAt(bytes, 7) === 0x70
  ) {
    // `ftypqt` marks QuickTime; other ISO base-media brands are MP4.
    if (byteAt(bytes, 8) === 0x71 && byteAt(bytes, 9) === 0x74) {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  return null;
}

// ── Storage helpers ──────────────────────────────────────────────────────────

export function isStorageBucket(value: string): value is StorageBucket {
  return (STORAGE_BUCKET_NAMES as readonly string[]).includes(value);
}

export function isPrivateCredentialKey(key: string, ownerId: string): boolean {
  return key.startsWith(`private-credentials/${ownerId}/`) && !key.includes("..");
}

export function isPitchVideoKey(key: string, ownerId: string): boolean {
  return key.startsWith(`pitch-videos/${ownerId}/`) && !key.includes("..");
}

/** Candidate id is encoded by the server as the second path segment. */
export function extractOwnerFromStorageKey(key: string): string | null {
  const [bucket, ownerId] = key.split("/");
  if (!bucket || !ownerId) return null;
  if (!isStorageBucket(bucket)) return null;
  return /^[0-9a-f-]{36}$/i.test(ownerId) ? ownerId : null;
}
