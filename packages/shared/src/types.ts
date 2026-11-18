import type { DegreeLevel, Industry, Role, VerificationStatus } from "./constants";

// ── Domain entities (snake_case mirrors PostgreSQL/PostgREST) ────────────────

export interface Profile {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface CandidateProfile {
  user_id: string;
  full_name: string;
  headline: string | null;
  industry: Industry | null;
  university_name: string;
  major_specialization: string | null;
  degree_level: DegreeLevel;
  graduation_year: number;
  experience_years: number;
  phone: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  certificate_verification_ref: string | null;
  registrar_consent_given: boolean;
  registrar_consent_at: string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoSessionQuestion {
  /** 1-based question index inside the 4-question assessment. */
  index: 1 | 2 | 3 | 4;
  /** Certificate-derived assessment question shown to the candidate. */
  question_text: string;
  /** Allocated seconds for this question. Sums to the session total (120). */
  allocated_seconds: number;
  /** Exact second offset inside the single recorded video where answering started. */
  start_offset_seconds: number;
  /** Exact second offset inside the single recorded video where answering finished. */
  end_offset_seconds: number;
}

export interface CandidateMedia {
  candidate_id: string;
  certificate_r2_key: string | null;
  video_r2_key: string | null;
  video_duration_seconds: number | null;
  ocr_extracted_text: string | null;
  /** Generated 4-question assessment with recorded chapter timestamps. */
  video_session_questions: VideoSessionQuestion[] | null;
  video_total_duration_seconds: number | null;
  questions_generated_at: string | null;
  submitted_at: string | null;
}

export type VerificationDecision = Extract<VerificationStatus, "verified" | "rejected">;

export interface VerificationReview {
  id: string;
  candidate_id: string;
  reviewer_id: string | null;
  reviewer_email: string;
  decision: VerificationDecision;
  rejection_reason: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  owner_id: string;
  company_name: string;
  corporate_domain: string;
  logo_r2_key: string | null;
  is_verified: boolean;
  display_logo_consent: boolean;
  created_at: string;
}

export interface CreditLedgerEntry {
  id: string;
  company_id: string;
  delta: number;
  reason: string;
  reference_id: string | null;
  created_at: string;
}

export interface CompanyUnlockedCandidate {
  company_id: string;
  candidate_id: string;
  unlocked_at: string;
}

export interface Message {
  id: string;
  company_id: string;
  candidate_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface CandidateProfileView {
  id: string;
  candidate_id: string;
  viewer_company_id: string;
  viewed_at: string;
}

/** Public-safe company projection used by the landing-page marquee. */
export interface MarqueeCompany {
  id: string;
  company_name: string;
  logo_r2_key: string | null;
  created_at: string;
}

// ── Employer search projection (RPC: get_verified_candidates_for_employer) ───

export interface EmployerCandidateCard {
  candidate_id: string;
  /** Masked as "Verified Candidate #0421" until the company unlocks the profile. */
  display_name: string;
  headline: string | null;
  industry: Industry | null;
  university_name: string;
  degree_level: DegreeLevel;
  major_specialization: string | null;
  graduation_year: number;
  experience_years: number;
  is_featured: boolean;
  video_r2_key: string | null;
  video_duration_seconds: number | null;
  /** Certificate-generated 4-question assessment chapters. */
  video_session_questions: VideoSessionQuestion[] | null;
  is_unlocked: boolean;
  /** Contact/document fields are null while locked. */
  full_name: string | null;
  email: string | null;
  phone: string | null;
  certificate_r2_key: string | null;
  /** True until the employer spends a credit to unlock the real certificate. */
  certificate_locked: boolean;
  total_count: number;
}

export interface UnlockCandidateResult {
  success: boolean;
  already_unlocked: boolean;
  credit_balance: number | null;
  message: string;
}

// ── Storage presigning API contract ──────────────────────────────────────────

export interface PresignUploadResponse {
  intent: "upload";
  bucket: string;
  key: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

export interface PresignDownloadResponse {
  intent: "download";
  bucket: string;
  key: string;
  url: string;
  expiresAt: string;
}

export type PresignResponse = PresignUploadResponse | PresignDownloadResponse;

// ── API envelope ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

// ── UI models ────────────────────────────────────────────────────────────────

export interface PitchRecordingState {
  status: "idle" | "requesting" | "recording" | "paused" | "completed";
  elapsedSeconds: number;
  canSubmit: boolean;
  recordedBlobSize: number | null;
  mimeType: string | null;
}

export interface VerificationGate {
  id: "document" | "pitch";
  title: string;
  description: string;
  complete: boolean;
}
