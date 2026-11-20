/**
 * Cross-platform business rules and constants.
 *
 * This module is intentionally free of React, DOM, Node, and database imports so
 * it can run unchanged in Next.js, React Native, Edge Functions, and tests.
 */

// ── Identity & verification ──────────────────────────────────────────────────

export const ROLES = ["candidate", "employer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Not submitted",
  pending: "Under review",
  verified: "University verified",
  rejected: "Changes requested",
};

export const MASKED_CANDIDATE_PREFIX = "Verified Candidate";

// ── Candidate profile taxonomy ───────────────────────────────────────────────

export const DEGREE_LEVELS = [
  "Associate Degree",
  "Bachelor's Degree",
  "Postgraduate Diploma",
  "Master's Degree",
  "Doctorate (PhD)",
  "Professional Certificate",
] as const;
export type DegreeLevel = (typeof DEGREE_LEVELS)[number];

export const INDUSTRIES = [
  "Technology",
  "Finance",
  "Consulting",
  "Healthcare",
  "Engineering",
  "Marketing",
  "Design",
  "Legal",
  "Education",
  "Media",
  "Public Sector",
  "Science & Research",
  "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const MAX_EXPERIENCE_YEARS = 50;

// ── Live pitch video rules ───────────────────────────────────────────────────

/** Hard floor: the Submit button cannot unlock below this duration. */
export const MIN_PITCH_SECONDS = 60;
/** Hard cap: recording stops automatically. */
export const MAX_PITCH_SECONDS = 133;

// ── 4-question certificate-driven video assessment ───────────────────────────
/** Total duration of the guided 4-question assessment, in seconds. */
export const VIDEO_SESSION_TOTAL_SECONDS = 133;
/** Number of assessment questions generated from the certificate. */
export const VIDEO_SESSION_QUESTION_COUNT = 4;
/** Default allocation per question (sums to the session total). */
export const VIDEO_SESSION_QUESTION_SECONDS = 30;
/** Seconds the question is displayed before answering. */
export const VIDEO_SESSION_DISPLAY_SECONDS = 7;
/** Seconds the candidate has to answer each question. */
export const VIDEO_SESSION_ANSWER_SECONDS = 25;
/** Pre-recording countdown before the first question. */
export const VIDEO_SESSION_INTRO_SECONDS = 5;
/** Ordered category labels for the 4 generated questions. */
export const VIDEO_SESSION_QUESTION_CATEGORIES = [
  "Core Academic Foundation",
  "Technical / Domain Problem-Solving",
  "Applied Project or Analytical Thinking",
  "Career Readiness & Employer Value",
] as const;
export type VideoSessionQuestionCategory =
  (typeof VIDEO_SESSION_QUESTION_CATEGORIES)[number];

export const PITCH_VIDEO_SPEC = {
  width: 1280,
  height: 720,
  frameRate: 30,
  videoBitsPerSecond: 1_200_000,
  /** ~9 MB for a 60s clip at 1.2 Mbps; 50 MB is a generous safety ceiling. */
  maxUploadBytes: 50 * 1024 * 1024,
  minUploadBytes: 1_000_000,
} as const;

/**
 * Ordered by preference. The recorder should choose the first supported type.
 * WebM keeps browser recordings small; MP4 is the iOS/Safari fallback.
 */
export const PREFERRED_RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=h264,aac",
  "video/mp4",
] as const;

export const PITCH_UPLOAD_MIME_TYPES = ["video/webm", "video/mp4", "video/quicktime"] as const;

export const TELEPROMPTER_CUES = [
  {
    id: "intro",
    title: "Intro & Degree",
    prompt: "Your name, the degree you earned, and where you studied.",
    startSeconds: 0,
    endSeconds: 20,
  },
  {
    id: "evidence",
    title: "Studies / Projects / Experience",
    prompt: "One standout project, research result, or role. Show your impact.",
    startSeconds: 20,
    endSeconds: 45,
  },
  {
    id: "target",
    title: "Target Role",
    prompt: "The role you want and the value you would bring in your first 90 days.",
    startSeconds: 45,
    endSeconds: MAX_PITCH_SECONDS,
  },
] as const;

// ── Corporate email gate ─────────────────────────────────────────────────────

/**
 * Employers must register with an official corporate domain. Candidates are not
 * restricted — access to opportunity should not depend on owning a domain.
 */
export const BLOCKED_CORPORATE_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "ymail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
] as const;

// ── Storage (Cloudflare R2) ──────────────────────────────────────────────────

export const STORAGE_BUCKETS = {
  privateCredentials: "private-credentials",
  pitchVideos: "pitch-videos",
  companyLogos: "company-logos",
} as const;

export const STORAGE_BUCKET_NAMES = [
  STORAGE_BUCKETS.privateCredentials,
  STORAGE_BUCKETS.pitchVideos,
  STORAGE_BUCKETS.companyLogos,
] as const;

export type StorageBucket = (typeof STORAGE_BUCKET_NAMES)[number];

export const ALLOWED_UPLOAD_MIME_TYPES = {
  "private-credentials": ["application/pdf", "image/jpeg", "image/png"],
  "pitch-videos": [...PITCH_UPLOAD_MIME_TYPES],
  // SVG is intentionally excluded: it can carry script and is served from the
  // public logo bucket, which would give an attacker a same-origin foothold.
  "company-logos": ["image/png", "image/jpeg", "image/webp"],
} as const satisfies Record<StorageBucket, readonly string[]>;

export const MAX_UPLOAD_BYTES = {
  "private-credentials": 10 * 1024 * 1024,
  "pitch-videos": PITCH_VIDEO_SPEC.maxUploadBytes,
  "company-logos": 2 * 1024 * 1024,
} as const satisfies Record<StorageBucket, number>;

export const PRESIGN_TTL_SECONDS = {
  upload: 10 * 60,
  /** Certificate/diploma links must be short-lived (spec: 5 minutes). */
  privateDownload: 5 * 60,
  mediaDownload: 10 * 60,
} as const;

// ── Monetization ─────────────────────────────────────────────────────────────

export const FREE_TRIAL_CREDITS = 2;
export const UNLOCK_COST_CREDITS = 1;

export const CREDIT_PACKS = [
  {
    id: "credits_5",
    label: "Starter",
    credits: 5,
    priceEnvKey: "STRIPE_PRICE_CREDITS_5",
    highlight: false,
  },
  {
    id: "credits_15",
    label: "Growth",
    credits: 15,
    priceEnvKey: "STRIPE_PRICE_CREDITS_15",
    highlight: true,
  },
  {
    id: "credits_30",
    label: "Scale",
    credits: 30,
    priceEnvKey: "STRIPE_PRICE_CREDITS_30",
    highlight: false,
  },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export const CREDIT_PACK_IDS = CREDIT_PACKS.map((pack) => pack.id) as [
  CreditPackId,
  ...CreditPackId[],
];

export const CANDIDATE_PRO_PLAN = {
  id: "candidate_pro",
  label: "Priority Pro",
  priceEnvKey: "STRIPE_PRICE_CANDIDATE_PRO",
} as const;

// ── UI layout tokens shared by both clients ───────────────────────────────────

export const MARQUEE_PLACEHOLDER_COUNT = 6;
export const CANDIDATE_GRID_PAGE_SIZE = 24;
export const CANDIDATE_GRID_MAX_PAGE_SIZE = 60;

export const APP_NAME = "University Talent Network";
export const APP_SHORT_NAME = "UTN";
export const APP_TAGLINE = "Verified talent. Real potential.";
