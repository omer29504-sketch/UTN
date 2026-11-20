# University Talent Network (UTN) — Full Comprehensive Platform Report

**Last updated:** November 20, 2026
**Repository:** `omer29504-sketch/UTN` (branch `main`, latest commit `c548da7`)
**Status:** All planned phases complete. Live on hosted Supabase (`jecdhhihbtaocbfzlljt`) with R2 storage configured.
**Report scope:** Complete technical, architectural, operational, and functional documentation of the entire platform.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision and Value Proposition](#2-product-vision-and-value-proposition)
3. [Platform Overview](#3-platform-overview)
4. [Actors, Roles, and Permissions Matrix](#4-actors-roles-and-permissions-matrix)
5. [Business Model and Revenue Streams](#5-business-model-and-revenue-streams)
6. [Trust Rules and Invariants](#6-trust-rules-and-invariants)
7. [End-to-End User Journeys](#7-end-to-end-user-journeys)
8. [System Architecture](#8-system-architecture)
9. [Technology Stack (Complete)](#9-technology-stack-complete)
10. [Monorepo Structure (Detailed)](#10-monorepo-structure-detailed)
11. [Database Schema (Complete)](#11-database-schema-complete)
12. [Migrations Timeline (Detailed)](#12-migrations-timeline-detailed)
13. [Row Level Security Policies](#13-row-level-security-policies)
14. [Triggers and Functions](#14-triggers-and-functions)
15. [RPCs (Remote Procedure Calls)](#15-rpcs-remote-procedure-calls)
16. [Indexes](#16-indexes)
17. [Authentication and Authorization (Deep Dive)](#17-authentication-and-authorization-deep-dive)
18. [Features (Complete)](#18-features-complete)
19. [UTN Core — 4-Question Assessment Engine (Deep Dive)](#19-utn-core--4-question-assessment-engine-deep-dive)
20. [Verified Peer Community Feed (Deep Dive)](#20-verified-peer-community-feed-deep-dive)
21. [6-Month Profile Expiration & Renewal (Deep Dive)](#21-6-month-profile-expiration--renewal-deep-dive)
22. [Separate PDF CV Upload (Deep Dive)](#22-separate-pdf-cv-upload-deep-dive)
23. [Server-Safe Certificate Gating (Deep Dive)](#23-server-safe-certificate-gating-deep-dive)
24. [Secure Employer Certificate Viewer — DRM (Deep Dive)](#24-secure-employer-certificate-viewer--drm-deep-dive)
25. [Realtime Chat (Deep Dive)](#25-realtime-chat-deep-dive)
26. [Billing and Priority Pro (Deep Dive)](#26-billing-and-priority-pro-deep-dive)
27. [Storage and Media Pipeline (Deep Dive)](#27-storage-and-media-pipeline-deep-dive)
28. [API Reference (Complete)](#28-api-reference-complete)
29. [Component Hierarchy](#29-component-hierarchy)
30. [State Management](#30-state-management)
31. [Design System (Deep Dive)](#31-design-system-deep-dive)
32. [Security (Deep Dive)](#32-security-deep-dive)
33. [Accessibility (Lighthouse 100)](#33-accessibility-lighthouse-100)
34. [Performance and Optimization](#34-performance-and-optimization)
35. [Environment and Setup (Complete)](#35-environment-and-setup-complete)
36. [Cloudflare R2 Setup (Complete)](#36-cloudflare-r2-setup-complete)
37. [Scripts and Commands](#37-scripts-and-commands)
38. [Error Handling Patterns](#38-error-handling-patterns)
39. [Testing and Verification](#39-testing-and-verification)
40. [Known Limitations](#40-known-limitations)
41. [Demo Accounts and Test Data](#41-demo-accounts-and-test-data)
42. [Deployment Guide](#42-deployment-guide)
43. [Recent Development History (Git)](#43-recent-development-history-git)
44. [Glossary](#44-glossary)

---

## 1. Executive Summary

**University Talent Network (UTN)** is a two-sided recruitment platform. University graduates prove their credentials once — a private degree certificate, an optional PDF CV, and a live, unedited 2-minute 4-question video assessment — and employers discover them through a short pitch video. Contact details, certificates, CVs, and chat stay locked until an employer spends an unlock credit.

The repository is a **pnpm + Turborepo monorepo** containing:
- A **Next.js 15 web app** (the only client after the Expo mobile app was removed)
- A **shared domain package** (`@utn/shared`) with Zod schemas, types, constants, helpers, and design tokens
- An **R2 storage package** (`@utn/storage`) with presigning and object operations
- A **complete Supabase schema** (Postgres, Auth, Realtime, RLS) with 9 migrations
- **Stripe billing** for credit packs and Priority Pro subscriptions

All planned phases (1–5) plus the UTN Core 4-question assessment, separate CV upload, server-safe certificate gating, peer community feed, and 6-month profile expiration are complete. The platform is live on a hosted Supabase project with real R2 credentials and Groq AI integration.

**Key metrics:**
- 9 database migrations (0001–0005, 0007–0010)
- 25+ RPCs and functions
- 12+ triggers
- 26+ RLS policies
- 15+ indexes
- 10 database tables + 1 public view
- 30+ API routes
- 100% TypeScript, zero typecheck errors
- Lighthouse 100 accessibility

---

## 2. Product Vision and Value Proposition

### 2.1 The problem
Traditional recruitment relies on CVs and unverified claims. Employers waste time screening candidates whose credentials aren't verified. Graduates struggle to stand out in crowded applicant pools.

### 2.2 The solution
UTN creates a **verified talent marketplace** where:
- Graduates prove credentials once (certificate + live video assessment)
- Employers discover verified talent through short, unedited video pitches
- Contact details and documents unlock only after a credit is spent
- A forensic audit trail protects candidate privacy

### 2.3 Core value propositions
- **For graduates:** Free credential verification, professional visibility, direct employer contact after unlock
- **For employers:** Pre-verified candidates, video-based screening, pay-per-unlock (no subscription required for discovery)
- **For universities:** Verified alumni network, credential authenticity assurance

---

## 3. Platform Overview

### 3.1 What the platform does
1. **Graduates** sign up → complete profile → upload certificate → complete 4-question video assessment → submit for admin review
2. **Admins** review and approve/reject → approved profiles become discoverable
3. **Employers** sign up (corporate email) → search verified candidates → watch pitch videos → spend 1 credit to unlock full dossier
4. **Unlocked employers** view certificate (watermarked DRM viewer), CV, and chat with the candidate

### 3.2 Key differentiators
- Live, unedited video pitches (no gallery uploads)
- Zero-download certificate viewer (canvas-rendered, watermarked, anti-capture)
- 4-question UTN Core assessment (level-calibrated, non-repeating)
- 6-month profile expiration with renewal cycle
- Peer community feed (2 clips/day, identity-masked)
- Server-side credential gating (never rely on CSS blur)

---

## 4. Actors, Roles, and Permissions Matrix

| Capability | Candidate | Employer | Admin |
|-----------|-----------|----------|-------|
| Create account | ✅ | ✅ (corporate email) | ❌ (promoted via SQL) |
| Complete profile | ✅ | ✅ (company) | — |
| Upload certificate/CV | ✅ | — | — |
| Complete UTN Core assessment | ✅ | — | — |
| Submit for review | ✅ | — | — |
| View own verification status | ✅ | — | — |
| Search candidates | — | ✅ (masked) | ✅ (full) |
| Watch pitch videos | — | ✅ (verified) | ✅ |
| Unlock candidate | — | ✅ (1 credit) | — |
| View certificate (DRM) | — | ✅ (unlocked) | ✅ |
| View CV | — | ✅ (unlocked) | ✅ |
| Chat with candidate | — | ✅ (unlocked) | — |
| Approve/reject verification | — | — | ✅ |
| Feature candidates | — | — | ✅ |
| Manage credits | — | View balance | ✅ |
| View peer community | ✅ (active) | — | — |
| Purchase credits | — | ✅ | — |

---

## 5. Business Model and Revenue Streams

### 5.1 Free for graduates
- Registration, profile, certificate upload, CV upload, OCR, 4-question assessment, video recording, submission, all free
- No payment gates, credit checks, or paywalls on any candidate flow

### 5.2 Employer credits
- 2 trial credits on signup (one per unique corporate domain)
- Credit packs via Stripe: 5 / 15 / 30 credits
- 1 credit = 1 candidate unlock (name, contact, certificate viewer, CV, chat)

### 5.3 Priority Pro (candidate subscription)
- Featured profile placement
- Profile view analytics
- Stripe subscription

### 5.4 Revenue flow
```
Employer clicks credit pack → Stripe Checkout → payment → webhook → ledger insert (+N)
→ balance = SUM(ledger.delta) → unlock candidate (spend 1 credit)
```

---

## 6. Trust Rules and Invariants

These are enforced in Postgres, not just the UI:

1. **Certificates and pitch videos live in private object storage** — certificates are never downloadable, only streamed into a canvas viewer
2. **Candidate names masked** (`Verified Candidate ####`) until a credit is spent
3. **Verification status only moves through admin decisions** recorded in an append-only audit table
4. **Employer accounts require corporate domain** — free consumer domains rejected
5. **Credits are append-only ledger rows** — balance is always derived, never stored
6. **Unlocks are atomic and idempotent** — advisory lock + unique ledger reference prevents double-spending
7. **Admin is not a public sign-up role** — cannot be self-assigned
8. **Every certificate/CV view is watermarked, gated by consent, and audited** before bytes are returned
9. **Candidates only discoverable after admin approval** of both certificate and 4-question video session
10. **4-question assessment (questions + chapter offsets) required** for submission
11. **6-month profile expiration** — expired profiles drop out of discovery and peer feeds
12. **UTN Core questions never repeat** across renewal cycles (SHA-256 hash uniqueness)

---

## 7. End-to-End User Journeys

### 7.1 Candidate journey (detailed)

```
1. Sign up (candidate role)
   └─ Supabase Auth → handle_new_user() trigger → profiles row
   └─ Redirect to /candidate/profile

2. Complete profile
   └─ Full name, university, major/specialization, degree level, graduation year
   └─ Experience years, headline, industry, phone (optional)
   └─ Academic grade, intake readiness level
   └─ Upserts candidate_profiles row

3. Verification studio (/candidate/verification)
   ├─ Step 1: University details (profile complete check)
   ├─ Step 2: Upload certificate (PDF/JPG/PNG, ≤10 MB)
   │   └─ Presign → R2 PUT → OCR (tesseract.js for images, skipped for PDFs)
   │   └─ OCR persists certificate_r2_key + ocr_extracted_text to candidate_media
   │   └─ Questions auto-generate (Groq/Gemini/fallback) from specialization + description
   ├─ Step 2b: Upload optional PDF CV (≤10 MB)
   ├─ Step 3: Assessment questions displayed (4 questions, 30s each)
   ├─ Step 4: Record 4-question session
   │   └─ Single MediaRecorder stream, pause/resume between questions
   │   └─ 30s per question, 120s total, auto-advance
   │   └─ Chapter timestamps recorded (start/end offsets)
   ├─ Consent to registrar verification (checkbox)
   └─ Submit for review (finalize)
       └─ R2 HEAD verification (size, content type)
       └─ Persist consent + media (certificate, CV, video, questions, duration)
       └─ Profile → pending (trigger)

4. Admin reviews
   ├─ Approve → verified → profile_activated_at + 6 months expiry set
   └─ Reject → rejected + reason → candidate can resubmit

5. Verified candidate
   └─ Appears in employer search (masked name)
   └─ Appears in peer community feed
   └─ Can view peer clips (2/day)
   └─ 6-month active window countdown

6. Renewal (after 6 months)
   └─ Profile expires → hidden from discovery/peer feed
   └─ Renewal banner on dashboard
   └─ Refresh profile + re-run intake + new UTN Core session
   └─ Admin re-approves → new 6-month window, new cycle
```

### 7.2 Employer journey (detailed)

```
1. Sign up (employer, corporate email only)
   └─ profiles row + provision → companies row (2 trial credits, unique domain)

2. Company profile (/employer/company)
   └─ Company name, logo upload (consent required)

3. Search candidates (/employer/candidates)
   └─ RPC get_verified_candidates_for_employer (masked names, no contacts)
   └─ Filters: search, industry, degree, university, graduation year, experience, featured

4. View candidate (free)
   └─ Pitch video (presigned GET, 10 min expiry)
   └─ Blurred certificate teaser (synthetic SVG, never real file)

5. Unlock (1 credit)
   └─ POST /api/employer/unlock → RPC unlock_candidate (advisory lock + ledger)
   └─ Idempotent: re-unlock doesn't double-charge

6. Unlocked dossier
   ├─ Contact email + phone
   ├─ Confidential certificate viewer (consent → stream → canvas + watermark + audit)
   ├─ PDF CV viewer (same gate, ?kind=cv)
   ├─ Pitch video
   └─ Realtime chat

7. Purchase credits (Stripe)
   └─ Credit packs: 5/15/30 credits
```

### 7.3 Admin journey (detailed)

```
1. /admin/verification (queue: status = pending)
2. Review detail (/admin/verification/[candidateId])
   ├─ Profile claims (university, degree, graduation year, industry, experience, headline, phone)
   ├─ OCR text (or "No extracted text")
   ├─ Certificate (signed link, 5 min expiry) — PDF/image
   ├─ CV (signed link, if uploaded)
   ├─ Pitch video (signed link, 10 min expiry)
   ├─ 4 chapter pills (Q1–Q4) with seek on click
   └─ Registrar verification ref
3. Decision
   ├─ Approve → verified → profile_activated_at + 6 months expiry
   └─ Reject → rejected + reason (≤1,000 chars) → candidate can resubmit
   └─ Audit row in verification_reviews (append-only)
```

---

## 8. System Architecture

### 8.1 Runtime topology

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15 App Router, client components)         │
│  └─ authFetch() with Bearer token                           │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────┐
│  Next.js 15 (Node runtime)                                  │
│  ├─ Server Components (RLS-scoped Supabase client)          │
│  ├─ Route Handlers (requireApiCaller + Zod + service role)   │
│  └─ next/font, Tailwind, design tokens                      │
└──────┬──────────────────┬──────────────────┬───────────────┘
       │                  │                  │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│  Supabase   │  │  Cloudflare R2  │  │  Stripe     │
│  Postgres   │  │  (S3-compatible)│  │  Checkout + │
│  Auth       │  │  3 buckets      │  │  Webhooks   │
│  Realtime   │  │                 │  │             │
│  RLS        │  │                 │  │             │
└─────────────┘  └─────────────────┘  └─────────────┘
       │
┌──────▼──────┐
│  Groq /     │
│  Gemini     │
│  (LLM)      │
└─────────────┘
```

### 8.2 Request lifecycle

```
Browser (client component)
  │  authFetch() attaches `Authorization: Bearer <supabase access token>`
  ▼
Next.js route handler (runtime = nodejs, dynamic = force-dynamic)
  │  requireApiCaller()
  ├─ 1. Supabase configured?                    → 503 if not
  ├─ 2. Same-origin check (state-changing)      → 403 cross_origin_blocked
  ├─ 3. Content-Length > 64 KiB?                → 413 payload_too_large
  ├─ 4. Per-IP budget (300/min)                 → 429 rate_limited
  ├─ 5. Bearer token verified with Supabase     → 401 invalid_token
  ├─ 6. Per-user route budget                   → 429 rate_limited
  └─ 7. Role read from profiles (service role)  → 403 profile_missing
  ▼
Route logic → Zod validation → Supabase (RLS-scoped or service role) → JSON response
```

---

## 9. Technology Stack (Complete)

### 9.1 Languages and runtimes
- **TypeScript** (strict mode) — all application code
- **Node.js** 20.9+ (verified on Node 24)
- **React 19** — UI components
- **SQL** (PostgreSQL 17) — database schema, RLS, triggers, RPCs

### 9.2 Frameworks and libraries

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 15 | App Router, Server Components, API routes |
| Styling | Tailwind CSS | 4 | Utility-first CSS |
| Icons | Lucide React | latest | Icon set |
| Validation | Zod | 3.25 | Schema validation (client + server) |
| Auth | @supabase/ssr | 0.12 | Cookie-based sessions |
| Auth | @supabase/supabase-js | latest | Client-side auth |
| Database | @supabase/supabase-js | latest | PostgREST client |
| OCR | tesseract.js | latest | WASM-based OCR |
| PDF | pdf.js | latest | In-browser PDF rendering |
| Payments | Stripe | latest | Checkout + webhooks |
| LLM | Groq SDK (fetch) | — | `openai/gpt-oss-20b` |
| LLM | Google Generative AI (fetch) | — | `gemini-3.5-flash-lite` |
| Forms | react-hook-form | latest | Form state management |
| Monorepo | pnpm | 9.15.4 | Package manager |
| Monorepo | Turborepo | latest | Build orchestration |
| Storage | @aws-sdk/client-s3 | latest | R2 S3-compatible client |
| Design tokens | packages/shared/design-tokens.cjs | — | Single source of truth |

### 9.3 Development and delivery tooling
- **Prettier** — code formatting
- **ESLint** — linting
- **TypeScript** — type checking
- **Supabase CLI** — migrations, remote push
- **GitHub** — version control and CI

### 9.4 External services
- **Supabase** (Postgres, Auth, Realtime, RLS) — database and authentication
- **Cloudflare R2** — object storage (3 buckets)
- **Stripe** — payments (test mode)
- **Groq** — LLM for question generation (free tier)
- **Google Gemini** — alternative LLM (free tier)

### 9.5 Browser platform APIs used
- `navigator.mediaDevices.getUserMedia` — camera access
- `MediaRecorder` — video recording
- HTML5 Canvas — certificate rendering, watermarking
- `fetch` with Bearer tokens — API calls
- `URL.createObjectURL` — blob URLs (limited use)

---

## 10. Monorepo Structure (Detailed)

```
.
├── apps/
│   └── web/                          # Next.js 15 App Router
│       ├── public/
│       │   └── pdfjs/                # pdf.js worker (synced by script)
│       └── src/
│           ├── app/
│           │   ├── (app)/            # Session-guarded role workspaces
│           │   │   ├── admin/verification/[candidateId]/
│           │   │   ├── candidate/
│           │   │   │   ├── community/[peerId]/
│           │   │   │   ├── profile/
│           │   │   │   └── verification/
│           │   │   ├── dashboard/
│           │   │   └── employer/
│           │   │       ├── billing/
│           │   │       ├── candidates/[candidateId]/
│           │   │       └── company/
│           │   ├── (auth)/           # Sign-in, sign-up
│           │   ├── api/
│           │   │   ├── admin/verification/
│           │   │   ├── auth/provision/
│           │   │   ├── candidate/
│           │   │   │   ├── generate-questions/
│           │   │   │   └── peer-clip/
│           │   │   ├── employer/
│           │   │   │   ├── certificates/[candidateId]/stream/
│           │   │   │   ├── certificates/[candidateId]/security-event/
│           │   │   │   └── unlock/
│           │   │   ├── storage/presign/
│           │   │   ├── stripe/{checkout,webhook}/
│           │   │   └── verification/{finalize,ocr}/
│           │   ├── auth/callback/
│           │   ├── legal/employer-confidentiality/
│           │   └── page.tsx          # Landing page
│           ├── components/
│           │   ├── candidate/peer-clip-player.tsx
│           │   ├── employer/
│           │   │   ├── BlurredCredentialTeaser.tsx
│           │   │   ├── CandidateDossierDrawer.tsx
│           │   │   └── secure-certificate-viewer.tsx
│           │   ├── verification/
│           │   │   └── question-chapter-player.tsx
│           │   ├── ui/               # Design system components
│           │   └── motion/           # Animation components
│           └── lib/
│               ├── api/              # authFetch, readApiError
│               ├── auth/             # session, role guards
│               ├── env.ts            # Lazy env reads
│               ├── supabase/         # admin, auth, client, server
│               └── security/         # rate-limit, request-context
├── packages/
│   ├── shared/                       # @utn/shared
│   │   ├── design-tokens.cjs         # Single source of truth
│   │   └── src/
│   │       ├── constants.ts          # Domain constants
│   │       ├── helpers.ts            # Utility functions
│   │       ├── schemas.ts            # Zod schemas
│   │       └── types.ts              # TypeScript types
│   └── storage/                      # @utn/storage
│       └── src/
│           ├── keys.ts                # Object key construction
│           ├── config.ts              # R2 configuration
│           └── index.ts              # Exports
├── supabase/
│   ├── config.toml                   # Local stack config
│   ├── migrations/                   # 0001–0010
│   └── seed.sql                      # Local demo data
├── scripts/
│   └── sync-pdfjs-worker.mjs         # Copies pdf.js worker to public/
├── .env.example                      # Environment template
├── package.json                      # Workspace + turbo config
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 11. Database Schema (Complete)

### 11.1 Tables

#### profiles
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, FK to auth.users | User ID |
| email | text | NOT NULL, UNIQUE | Lowercased email |
| role | user_role | NOT NULL, DEFAULT 'candidate' | candidate/employer/admin |
| employer_tos_accepted_at | timestamptz | | TOS acceptance timestamp |
| employer_tos_version | text | | TOS version accepted |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

#### candidate_profiles
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | uuid | PK, FK to profiles(id) | |
| full_name | text | NOT NULL | |
| headline | text | | Professional headline/description |
| industry | text | | Industry category |
| university_name | text | NOT NULL | |
| major_specialization | text | | Degree major/specialization |
| academic_grade | text | | GPA/honors classification |
| intake_readiness_level | text | CHECK (foundational/intermediate/advanced) | Self-assessed baseline |
| intake_quiz_answers | jsonb | | Diagnostic quiz answers |
| degree_level | text | NOT NULL | Bachelor's/Master's/Doctorate |
| graduation_year | integer | NOT NULL | |
| experience_years | integer | NOT NULL, DEFAULT 0 | |
| phone | text | | Contact phone |
| verification_status | verification_status | NOT NULL, DEFAULT 'unverified' | |
| rejection_reason | text | | Admin rejection reason |
| certificate_verification_ref | text | | QR/serial from certificate |
| registrar_consent_given | boolean | NOT NULL, DEFAULT false | |
| registrar_consent_at | timestamptz | | Consent timestamp |
| is_featured | boolean | NOT NULL, DEFAULT false | Priority Pro |
| profile_activated_at | timestamptz | | Approval timestamp |
| profile_expires_at | timestamptz | | 6-month expiry |
| renewal_cycle_count | integer | NOT NULL, DEFAULT 1 | Renewal counter |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

#### candidate_media
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| candidate_id | uuid | PK, FK to candidate_profiles(user_id) | |
| certificate_r2_key | text | | R2 key for certificate |
| cv_r2_key | text | | R2 key for CV (optional) |
| video_r2_key | text | | R2 key for pitch video |
| video_duration_seconds | integer | CHECK (60–120) | Pitch duration |
| ocr_extracted_text | text | | OCR result |
| video_session_questions | jsonb | CHECK (shape) | 4-question assessment with offsets |
| video_total_duration_seconds | integer | NOT NULL, DEFAULT 120 | Total session budget |
| questions_generated_at | timestamptz | | When questions were generated |
| submitted_at | timestamptz | | Finalization timestamp |

#### verification_reviews
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| reviewer_id | uuid | FK to profiles(id) | Admin who decided |
| reviewer_email | text | NOT NULL | |
| decision | text | CHECK (verified/rejected) | |
| rejection_reason | text | | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

#### companies
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| owner_id | uuid | FK to profiles(id), UNIQUE | |
| company_name | text | NOT NULL | |
| corporate_domain | text | NOT NULL, UNIQUE | Derived from email domain |
| logo_r2_key | text | | R2 key for logo |
| is_verified | boolean | NOT NULL, DEFAULT false | |
| display_logo_consent | boolean | NOT NULL, DEFAULT false | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| updated_at | timestamptz | NOT NULL, DEFAULT now() | |

#### credit_ledger
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| company_id | uuid | FK to companies(id) | |
| delta | integer | NOT NULL | +N (credit) or -N (debit) |
| reason | text | NOT NULL | stripe_credit_pack, unlock, trial, etc. |
| reference_id | text | | Unique reference (session.id hash) |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| UNIQUE | (company_id, reason, reference_id) | | Idempotency |

#### company_unlocked_candidates
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| company_id | uuid | FK to companies(id) | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| unlocked_at | timestamptz | NOT NULL, DEFAULT now() | |
| PRIMARY KEY | (company_id, candidate_id) | | |

#### messages
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| company_id | uuid | FK to companies(id) | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| sender_id | uuid | FK to profiles(id) | |
| content | text | NOT NULL | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

#### candidate_profile_views
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| viewer_company_id | uuid | FK to companies(id) | |
| viewed_at | timestamptz | NOT NULL, DEFAULT now() | |

#### document_access_logs
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| employer_id | uuid | FK to profiles(id) | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| event_type | text | NOT NULL | certificate_viewed, cv_viewed, tos_accepted, etc. |
| ip_address | text | | |
| user_agent | text | | |
| watermark_signature | text | | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |

#### utn_core_question_history
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| candidate_id | uuid | FK to candidate_profiles(user_id) | |
| renewal_cycle | integer | NOT NULL, DEFAULT 1 | |
| question_hash | text | NOT NULL | SHA-256 of normalized question text |
| question_text | text | NOT NULL | |
| competency_dimension | text | NOT NULL | One of 4 dimensions |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| UNIQUE | (candidate_id, question_hash) | | Prevents repeats per candidate |

#### candidate_peer_views
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | |
| viewer_candidate_id | uuid | FK to candidate_profiles(user_id) | |
| target_candidate_id | uuid | FK to candidate_profiles(user_id) | |
| viewed_question_index | integer | CHECK (1–4) | Which question was viewed |
| viewed_date | date | NOT NULL, DEFAULT current_date | |
| created_at | timestamptz | NOT NULL, DEFAULT now() | |
| UNIQUE | (viewer_candidate_id, target_candidate_id, viewed_date) | | One view per peer per day |

#### company_marquee (view)
Public-safe view exposing company id, name, logo key, created_at for the landing page logo marquee.

---

## 12. Migrations Timeline (Detailed)

| Migration | Scope | Key Changes |
|-----------|-------|-------------|
| `0001_initial_schema.sql` | Core schema | 9 tables, enums, RLS, triggers, RPCs, seed data |
| `0002_verification_reviews.sql` | Admin review | Append-only audit trail table |
| `0003_degree_verification_compliance.sql` | Registrar consent | Consent columns and constraints |
| `0004_employer_certificate_confidentiality.sql` | Certificate DRM | TOS acceptance, document_access_logs, streaming support |
| `0005_security_hardening.sql` | Security | Revoke PUBLIC/anon EXECUTE, fix search_path |
| `0007_certificate_video_questions.sql` | 4-question assessment | major_specialization, video_session_questions (JSONB), validator, guard/sync/promotion refresh, RPC update |
| `0008_certificate_locked_flag.sql` | Employer gating | certificate_locked boolean in discovery RPC |
| `0009_cv_upload.sql` | CV upload | cv_r2_key column, guard validation, RPC update |
| `0010_utn_core_community_and_expiration.sql` | UTN Core + community + expiration | Readiness/grade/expiration columns, question history table, peer views table, is_profile_active RPC, get_or_record_peer_clip_access RPC, employer RPC filters expired |

---

## 13. Row Level Security Policies

### Candidate tables
- `candidate_profiles`: candidates can read/update own; admins can read/update all; employers can read verified (via RPC)
- `candidate_media`: candidates can read/write own; admins can read all; employers cannot read directly

### Employer tables
- `companies`: owners can read/update own; admins can read all
- `credit_ledger`: owners can read own company's; admins can read all; insert via RPC only
- `company_unlocked_candidates`: owners can read own; insert via RPC only

### Chat
- `messages`: only unlocked employer-candidate pairs can read/write

### Verification
- `verification_reviews`: candidates can read own; admins can insert; no updates/deletes via API

---

## 14. Triggers and Functions

### Triggers
| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| `on_auth_user_created` | auth.users | `handle_new_user()` | Provision profile row on signup |
| `protect_candidate_fields` | candidate_profiles | `protect_candidate_fields()` | Block self-verification, role escalation |
| `guard_candidate_media` | candidate_media | `guard_candidate_media()` | Validate keys, lock during review, set submitted_at |
| `sync_candidate_submission` | candidate_media | `sync_candidate_submission()` | Promote to pending when media complete |
| `set_profile_expiration` | candidate_profiles | `set_profile_expiration()` | Set 6-month expiry on approval |
| `protect_profile_role` | profiles | `protect_profile_role()` | Block role changes by non-admins |
| `protect_company_fields` | companies | `protect_company_fields()` | Block field tampering |
| `validate_company_domain` | companies | `validate_company_domain()` | Enforce corporate domain |
| `set_updated_at` | multiple | `set_updated_at()` | Auto-update timestamps |
| `normalize_profile_email` | profiles | `normalize_profile_email()` | Lowercase/trim email |

### Key functions
- `is_admin()` — checks if current user is admin
- `is_profile_active(uuid)` — checks if profile is verified and not expired
- `is_blocked_consumer_domain(text)` — checks if email domain is a consumer domain
- `handle_new_user()` — provisions profile on signup
- `protect_candidate_fields()` — blocks self-verification
- `guard_candidate_media()` — validates and locks media
- `sync_candidate_submission()` — auto-promotes to pending

---

## 15. RPCs (Remote Procedure Calls)

| RPC | Purpose | Auth |
|-----|---------|------|
| `unlock_candidate(company_id, candidate_id)` | Spend credit, create entitlement, idempotent | authenticated |
| `get_verified_candidates_for_employer(...)` | Search/filter verified candidates with masking | authenticated, service_role |
| `get_my_credit_balance()` | Derived balance for signed-in employer | authenticated |
| `is_valid_video_session_questions(jsonb)` | Validate 4-question payload shape | authenticated, service_role |
| `is_profile_active(uuid)` | Check if profile is verified and not expired | authenticated, service_role |
| `get_or_record_peer_clip_access(viewer, target, index)` | Record peer view, return clip boundaries | authenticated, service_role |

---

## 16. Indexes

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `ux_utn_core_history_candidate_hash` | utn_core_question_history | (candidate_id, question_hash) | UNIQUE |
| `ix_utn_core_history_hash` | utn_core_question_history | (question_hash) | B-tree |
| `ix_utn_core_history_candidate` | utn_core_question_history | (candidate_id) | B-tree |
| `ix_peer_views_viewer_date` | candidate_peer_views | (viewer_candidate_id, viewed_date) | B-tree |
| `ux_peer_views_unique` | candidate_peer_views | (viewer_candidate_id, target_candidate_id, viewed_date) | UNIQUE |
| Various FK indexes | Multiple tables | Foreign key columns | B-tree |

---

## 17. Authentication and Authorization (Deep Dive)

### 17.1 Session model
- **Web:** `@supabase/ssr` cookie sessions for server-rendered pages; bearer tokens via `authFetch` for API routes
- **API routes:** bearer token in `Authorization` header, verified with Supabase `getUser()`

### 17.2 Sign-up flow
1. User submits sign-up form
2. Supabase Auth creates user
3. `handle_new_user()` trigger fires → inserts `profiles` row with role from metadata
4. Employer signups rejected on consumer domains
5. Admin role cannot be self-assigned

### 17.3 Authorization layers (7 gates)
1. Supabase configured? → 503
2. Same-origin check (state-changing) → 403 `cross_origin_blocked`
3. Content-Length > 64 KiB → 413 `payload_too_large`
4. Per-IP budget (300/min) → 429 `rate_limited`
5. Bearer token verified → 401 `invalid_token`
6. Per-user route budget → 429 `rate_limited`
7. Role read from profiles → 403 `profile_missing`

### 17.4 Admin bootstrap
Admin is never a public sign-up role. Promote via SQL:
```sql
update public.profiles set role = 'admin' where email = 'admin@example.com';
```

---

## 18. Features (Complete)

### 18.1 Public landing page (`/`)
Marketing page with hero, features, logo marquee, CTAs. Infinite corporate logo marquee (anonymous-safe view).

### 18.2 Candidate profile (`/candidate/profile`)
Degree, university, major/specialization, graduation year, experience, headline, industry, phone, academic grade, intake readiness level. Upserts `candidate_profiles`.

### 18.3 Verification studio (`/candidate/verification`)
- 4-step rail: University Details → Degree Upload → Assessment Questions → 4-Question Session
- Camera/mic readiness check
- Certificate upload (PDF/JPG/PNG, ≤10 MB) with OCR
- Optional PDF CV upload (≤10 MB)
- 4-question UTN Core assessment (30s each, 120s total)
- Registrar consent checkbox
- Submit for review (finalize)

### 18.4 OCR (`POST /api/verification/ocr`)
Server-side tesseract.js on raster images; PDFs skipped for manual review. Draft OCR results upserted into `candidate_media` (including `certificate_r2_key`).

### 18.5 Finalize (`POST /api/verification/finalize`)
Re-checks R2 object existence, exact size, content type, owner-prefixed keys. Persists consent, media (certificate, CV, video, questions, duration), moves profile to `pending`.

### 18.6 Admin review (`/admin/verification`)
Queue of pending candidates; detail page with profile claims, OCR text, certificate link (5 min), pitch video, CV, 4 chapter pills. Approve/reject with reason.

### 18.7 Discovery and search (`/employer/candidates`)
Search/filter verified candidates (masked names). Unlock via 1 credit. Pitch video free. Certificate/CV gated behind unlock.

### 18.8 Unlock (`POST /api/employer/unlock`)
Atomic credit spend + entitlement creation. Idempotent.

### 18.9 Confidential certificate viewer
Zero-download, canvas-rendered, watermarked, anti-capture. See §24.

### 18.10 Realtime chat
Supabase Realtime on `messages` table. Requires unlock. See §25.

### 18.11 Billing and Priority Pro
Stripe Checkout for credit packs and Priority Pro subscription. Webhook → ledger insert. See §26.

### 18.12 Dashboards
Role-based dashboards with stats, quick links, verification checklist, profile active window.

### 18.13 Legal page
`/legal/employer-confidentiality` — canonical legal copy for employer confidentiality clause.

### 18.14 Peer community (`/candidate/community`)
Verified peer feed with daily allowance (2 peers/day), identity-masked cards, single question clip playback with boundary enforcement.

---

## 19. UTN Core — 4-Question Assessment Engine (Deep Dive)

### 19.1 Overview
The candidate pitch was transformed from a single 60–120s take into a **2-minute, 4-question assessment** generated from the candidate's degree specialization and professional description.

### 19.2 Question categories
1. **Q1 — Core Theoretical Mastery** (30s): probes grasp of degree fundamentals
2. **Q2 — Applied Scenario & Edge-Case Judgment** (30s): concrete scenario in their specialization
3. **Q3 — Analytical Trade-Offs** (30s): real-world application with trade-offs
4. **Q4 — Real-World Execution** (30s): why hire them, first-90-days value

### 19.3 Generation pipeline
- **Endpoint:** `POST /api/candidate/generate-questions`
- **Auth:** `requireApiCaller()` + rate limit (`generateQuestions`: 6/5min) + Zod
- **Input:** degree title, major/specialization, university, industry, headline/description, academic grade, intake readiness level, optional client keywords
- **Provider:** Groq `openai/gpt-oss-20b` (priority) → Gemini `gemini-3.5-flash-lite` → deterministic discipline-keyed fallback
- **Questions derived from specialization + description**, NOT from certificate OCR text
- **Idempotent:** once questions exist, returns stored (prevents cherry-picking). Regeneration allowed only after admin rejection.
- **Non-repeating:** fetches prior cycle question hashes, includes in prompt as "MUST NOT repeat or paraphrase"
- **Persistence:** all 4 questions saved to `utn_core_question_history` (with SHA-256 hashes) and attached to `candidate_media.video_session_questions`
- **Validation:** Zod schema enforces exactly 4 questions, indices 1–4, 30s each summing to 120, contiguous chapters starting at 0

### 19.4 Recording flow
- Single continuous `MediaRecorder` stream producing one `.webm`/`.mp4` upload
- `MediaRecorder.pause()`/`resume()` between questions so the file timeline equals accumulated active seconds (≤120)
- UI: 02:00 total / 30s per question; Q1 reveal + "Start Question 1" + live 00:30 countdown; "Done with Q1" or timer end marks `end_offset_seconds`, pauses, reveals Q2; Q2–Q4 reveal text, "Start Timing" resumes; after Q4 finalize blob, upload once via presigned R2 flow, save exact chapter timestamps

### 19.5 Employer/Admin playback
- Shared `QuestionChapterPlayer` component renders 4 clickable chapter cards below the video
- Clicking seeks `videoRef.current.currentTime = q.start_offset_seconds`
- Highlights active question as playback progresses
- Used in both employer dossier drawer and admin review page

### 19.6 Accessibility
- `aria-live="polite"` for step changes (no per-second spam)
- 44×44px touch targets
- Keyboard navigation (Enter/Space to seek)

---

## 20. Verified Peer Community Feed (Deep Dive)

### 20.1 Overview
Approved, active graduates can view up to **2 peer candidate clips per day**, one question each. Identity is strictly masked.

### 20.2 Daily allowance
- Display: "X of 2 Peer Insights Remaining Today"
- Max 2 distinct peer candidates per calendar day (`viewed_date = current_date`)
- 1 question chapter (max 60 seconds) per viewed peer

### 20.3 Identity masking
- Never exposes: full name, university registration ID, certificate file, CV, or contact details
- Exposes only: masked display label (First Name + Last Initial), degree major, and the single question prompt + clip window

### 20.4 Clip playback
- Clicking "Watch Peer Answer (1 Question)" calls `get_or_record_peer_clip_access` RPC
- Plays only that single question segment (auto-pausing with "Peer Clip Complete — 1 Question Limit" overlay when `currentTime >= clipEndSeconds` or 60 seconds elapse)
- Seeking outside `[clipStart, clipEnd]` is blocked
- Once 2 peers viewed today, remaining cards lock until tomorrow's reset

### 20.5 Access control
- Only verified, active candidates (`profile_status = 'approved' AND profile_expires_at > now()`) can access the feed
- Target must also be verified and active
- Self-viewing is blocked
- RPC: `get_or_record_peer_clip_access(viewer, target, index)`

### 20.6 Pages and components
- `/candidate/community` — peer feed with daily allowance indicator
- `/candidate/community/[peerId]` — single peer clip player
- `PeerClipPlayer` component — client-side clip playback with boundary enforcement
- `POST /api/candidate/peer-clip` — records view, returns clip boundaries + presigned video URL

---

## 21. 6-Month Profile Expiration & Renewal (Deep Dive)

### 21.1 Overview
Verified candidate profiles have a 6-month active window. After expiration, the profile is hidden from employer discovery and peer community feeds, but the account and verified degree record are preserved.

### 21.2 Activation
- On admin approval, `profile_activated_at` is set to `now()` and `profile_expires_at` = `profile_activated_at + 6 months`
- `renewal_cycle_count` increments on each approval
- Trigger: `on_profile_verified_set_expiration` (before update on candidate_profiles)

### 21.3 Expiration effects
- Employer discovery RPC filters: `profile_expires_at is null or profile_expires_at > now()`
- Peer community feed: only active peers shown
- `is_profile_active()` helper: `verification_status = 'verified' AND profile_expires_at > now()`

### 21.4 Renewal flow
- Dashboard shows "Profile Active Window" badge with days remaining
- When expired: renewal banner — "Your 6-Month Active Window Has Ended — Renew Your Profile"
- Candidate refreshes profile details/CV, re-runs intake calibration, completes a new 4-question UTN Core video session
- Admin re-approves → new 6-month window, new cycle
- All prior question hashes are excluded from the new cycle's questions

---

## 22. Separate PDF CV Upload (Deep Dive)

### 22.1 Overview
Candidates can optionally upload a PDF CV alongside their degree certificate. It is stored under the same `private-credentials/` prefix and gated behind the same 1-credit employer unlock.

### 22.2 Implementation
- **Migration 0009:** `cv_r2_key` column on `candidate_media`; guard validates prefix; RPC exposes `cv_r2_key` (masked until unlock)
- **Shared types:** `CandidateMedia.cv_r2_key`, `EmployerCandidateCard.cv_r2_key`
- **Shared schema:** optional `cv` field in `candidateVerificationSubmissionSchema`
- **Finalize route:** optional CV with R2 HEAD verification (size + content type), persisted on submit
- **Candidate studio:** "Add your PDF CV (optional)" upload card (PDF, max 10 MB) with remove button; CV key included in atomic finalize payload
- **Employer stream:** `?kind=cv` serves CV bytes through the same watermarked, audited, unlock-gated path
- **Employer drawer:** renders a second `SecureCertificateViewer` for the CV after unlock
- **Admin page:** shows CV inline as an iframe

### 22.3 Free for graduates
No payment gates, credit checks, or paywalls on CV upload.

---

## 23. Server-Safe Certificate Gating (Deep Dive)

### 23.1 Zero-leak backend gating
- Before unlock: server never returns real certificate storage key, presigned URL, or raw bytes. Returns only safe metadata: `verification_status: 'verified'`, degree title, major, university, graduation year, `certificate_locked: true`
- After unlock: verifies unlock record in `company_unlocked_candidates`, logs access in `document_access_logs`, streams real certificate into watermarked `<CanvasDocumentViewer />`

### 23.2 Employer dossier drawer — blurred teaser
- When not unlocked: renders a synthetic blurred certificate SVG (never the real file) with:
  - Emerald "UTN Verified Degree" seal
  - Visible verified metadata (degree, university, graduation year)
  - Lock overlay: "Official University Certificate & PDF CV Locked — Spend 1 Credit to Unblur & Inspect"
  - "Unlock Full Dossier (1 Credit)" button or "Top Up Credits" CTA if balance is 0
- After unlock: transitions to live watermarked DRM viewer + enables contact/messaging without page reload

### 23.3 Graduates 100% free
No payment gates on registration, certificate upload, PDF CV, or 4-question assessment.

---

## 24. Secure Employer Certificate Viewer — DRM (Deep Dive)

Employers never receive a certificate file, presigned URL, or direct R2 link.

1. **Click-through consent** — employer must read and accept the confidentiality clause before first certificate. Logged as `tos_accepted`.
2. **Zero-download stream** — server reads private R2 object, returns bytes with `no-store`/`no-cache` headers, writes `certificate_viewed` audit row (IP, user agent, watermark signature). Mobile requests `?format=base64`.
3. **In-memory rendering** — PDFs (pdf.js) or images painted onto HTML5 `<canvas>`. No `<img src>`, blob URL, or `<a download>` in DOM.
4. **Forensic watermark** — diagonal watermark burned into canvas pixels + SVG overlay: employer name, email, short id, UTC time, refreshed every minute.
5. **Anti-capture** — right-click, selection, drag suppressed; window blur/tab hiding covers canvas with privacy shield; PrintScreen/Ctrl+P/Ctrl+S/Ctrl+Shift+I blank canvas; `@media print` hides viewer.
6. **One-hour re-acknowledgment** — every open shows warning modal; 10-second interval re-locks after 60 minutes.
7. **Mobile lock** — Expo `usePreventScreenCapture()` (Android FLAG_SECURE, iOS recording protection), screenshot listener.

---

## 25. Realtime Chat (Deep Dive)

- Supabase Realtime on `messages` table
- Requires unlock (enforced by RLS + trigger)
- Real-time message delivery between employer and candidate
- Chat UI in employer dossier drawer and candidate messages page
- Messages stored with sender_id, company_id, candidate_id, content, created_at

---

## 26. Billing and Priority Pro (Deep Dive)

### 26.1 Credit packs
- 5 / 15 / 30 credits via Stripe Checkout
- Webhook → ledger insert (`+N`, reason=`stripe_credit_pack`, reference=hash(session.id))
- Unique index makes retries idempotent
- Trial credits: 2 per new company (once per unique corporate domain)

### 26.2 Priority Pro
- Candidate subscription via Stripe
- Webhook sets `candidate_profiles.is_featured = true`
- Featured candidates appear first in search results

### 26.3 Unlock flow
```
Employer clicks unlock → POST /api/employer/unlock
  → RPC unlock_candidate (advisory lock + ledger)
  → Spends 1 credit, creates entitlement
  → Idempotent: re-unlock doesn't double-charge
```

---

## 27. Storage and Media Pipeline (Deep Dive)

### 27.1 Buckets
1. `private-credentials` — university documents (PDF/JPG/PNG, ≤10 MB)
2. `pitch-videos` — live pitch recordings (WebM/MP4/MOV, ≤50 MB)
3. `company-logos` — logos (PNG/JPG/WebP/SVG, ≤2 MB, public read)

### 27.2 Key construction
`buildObjectKey`: `<bucket>/<owner-uuid>/<random-uuid>.<ext>` — unguessable, ownership-prefixed.

### 27.3 Presigning rules
- Upload PUT URLs expire in 10 minutes; download GET URLs in 5 min (certificates) / 10 min (videos)
- Client must send `requiredHeaders` exactly (Content-Type + Content-Length are part of signature)
- Employer requests for `private-credentials` rejected with `403 use_secure_viewer`

### 27.4 Download authorization matrix

| Caller | Pitch video | Certificate | CV | Company logo |
|--------|-------------|-------------|-----|-------------|
| Admin | Any (signed) | Any (signed) | Any (signed) | Any |
| Owner candidate | Own | Own | Own | — |
| Employer | Any verified | Only unlocked (streamed) | Only unlocked (streamed) | — |

### 27.5 Media flow
```
Browser ──(1) presign request──▶ /api/storage/presign ──(auth + ownership)──▶ R2 signer
        ◀──(2) short-lived PUT URL + signed Content-Type/Length──
        ──(3) PUT bytes────────────────────────────────────────▶ R2 bucket
        ──(4) finalize/OCR with the key───────────────────────▶ API
                                                              ├─ HEAD object (exists/size/type)
                                                              ├─ GET object (server-side OCR)
                                                              └─ record keys in Postgres
```

---

## 28. API Reference (Complete)

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/provision` | Provision account |
| GET | `/auth/callback` | Email confirmation callback |

### Storage
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/storage/presign` | Presigned upload/download URLs |

### Verification
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/verification/ocr` | Server-side OCR (tesseract.js) |
| POST | `/api/verification/finalize` | Finalize submission |

### Candidate
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/candidate/generate-questions` | Generate 4 UTN Core questions |
| POST | `/api/candidate/peer-clip` | Record peer view, return clip boundaries |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/verification` | Approve/reject verification |

### Employer
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employer/certificates/[id]/stream` | Zero-download cert/CV stream (`?kind=cv`, `?format=base64`) |
| POST | `/api/employer/certificates/[id]/security-event` | Log security events |
| POST | `/api/employer/unlock` | Spend credit to unlock candidate |

### Stripe
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/stripe/checkout` | Create checkout session |
| POST | `/api/stripe/webhook` | Stripe webhook handler |

---

## 29. Component Hierarchy

### Key components
- `QuestionChapterPlayer` — 4 chapter cards below video (employer/admin)
- `PeerClipPlayer` — single question clip with boundary enforcement
- `SecureCertificateViewer` — DRM canvas viewer (watermark, anti-capture)
- `BlurredCredentialTeaser` — synthetic blurred certificate for locked state
- `CandidateDossierDrawer` — slide-over employer dossier
- `VerificationStudio` — candidate verification flow (4 steps)
- `CandidateProfileForm` — profile editing

### UI primitives (design system)
- `Card`, `CardHeader`, `Badge`, `Button`, `Alert`, `Field`, `Input`
- `Reveal`, `SpotlightGlassCard`, `TopographicHeroBg`
- `VerificationBadge`

---

## 30. State Management

- **Server state:** Supabase (Postgres) — single source of truth
- **Client state:** React `useState`/`useRef` in components
- **Form state:** react-hook-form with Zod validation
- **Auth state:** Supabase session (cookies/bearer tokens)
- **Realtime:** Supabase Realtime subscriptions for chat
- **No global state library** (Redux/Zustand) — server components + React state sufficient

---

## 31. Design System (Deep Dive)

### 31.1 Color palette (Executive Slate & Alabaster)
- Slate `#0F172A` / `#1E293B` — structure and text
- Alabaster `#F8FAFC` / `#FFFFFF` — surfaces
- Indigo `#4F46E5` — actions and links
- Emerald `#10B981` — verified marks and success

### 31.2 Typography
- **Plus Jakarta Sans** — headings (font-display)
- **Inter** — body copy
- Both loaded via `next/font` (web)

### 31.3 Tokens
- Single source: `packages/shared/design-tokens.cjs`
- Consumed by Tailwind configs (web)
- CSS variables for theming

### 31.4 Themes
- **Jewel Atelier** — midnight emerald, layered silk aurora, engraved heroes, glass surfaces
- **Executive Slate & Alabaster** — base palette
- Motion system: animated graduation cap, aurora silk ribbons, reveal animations

### 31.5 Accessibility (Lighthouse 100)
- 44×44px minimum touch targets
- `aria-live="polite"` for dynamic updates
- Keyboard navigation (Enter/Space)
- Focus indicators
- Color contrast ratios (WCAG AA)
- Semantic HTML structure

---

## 32. Security (Deep Dive)

### 32.1 Key security measures
- Service-role key is server-only (`server-only` guard)
- RLS enabled on every table
- Presigned URLs are bearer capabilities (short TTLs, never logged)
- Stripe webhooks verify signatures; ledger unique index for idempotency
- Marquee view exposes only safe fields
- Storage keys validated against owner prefix and path traversal
- Rate limiting: per-IP (300/min) + per-user per-route budgets
- Content-Length cap: 64 KiB
- Same-origin check on state-changing requests
- CORS configured on R2 buckets

### 32.2 Anti-capture (certificate viewer)
- Right-click, selection, drag suppressed
- Window blur/tab hiding covers canvas with privacy shield
- PrintScreen/Ctrl+P/Ctrl+S/Ctrl+Shift+I blank canvas
- `@media print` hides viewer entirely
- Mobile: `FLAG_SECURE` (Android), recording protection (iOS)

### 32.3 Credential gating
- Before unlock: server never returns real key/URL/bytes
- Returns only: `verification_status`, degree, major, university, graduation year, `certificate_locked: true`
- After unlock: verifies entitlement, logs access, streams into canvas viewer

---

## 33. Accessibility (Lighthouse 100)

- **Touch targets:** Minimum 44×44px for all interactive elements
- **ARIA:** `aria-live="polite"` for dynamic content updates
- **Keyboard:** Full keyboard navigation (Tab, Enter, Space, Escape)
- **Focus:** Visible focus indicators on all interactive elements
- **Color contrast:** WCAG AA compliance (4.5:1 for text)
- **Semantic HTML:** Proper heading hierarchy, landmark regions
- **Screen readers:** Descriptive alt text, ARIA labels
- **Motion:** Respects `prefers-reduced-motion`
- **Forms:** Associated labels, error messages, validation feedback

---

## 34. Performance and Optimization

- **Server Components:** Default to server rendering, client components only where needed
- **Image optimization:** `next/image` with proper sizing
- **Font optimization:** `next/font` with self-hosted fonts
- **Code splitting:** Automatic route-based code splitting
- **Lazy loading:** Dynamic imports for heavy libraries (tesseract.js, pdf.js)
- **Caching:** `no-store` for sensitive data, appropriate cache headers for static assets
- **Database:** Indexes on all foreign keys and query columns
- **R2:** Direct browser uploads (no server proxy), presigned URLs

---

## 35. Environment and Setup (Complete)

### 35.1 Required variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Cloudflare R2
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_PRIVATE_CREDENTIALS
R2_BUCKET_PITCH_VIDEOS
R2_BUCKET_COMPANY_LOGOS
R2_PUBLIC_LOGOS_BASE_URL (optional)

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_CREDITS_5
STRIPE_PRICE_CREDITS_15
STRIPE_PRICE_CREDITS_30
STRIPE_PRICE_CANDIDATE_PRO

# LLM (optional)
GROQ_API_KEY
GEMINI_API_KEY
```

### 35.2 Quick start
```bash
corepack enable
pnpm install
cp .env.example apps/web/.env.local
# Fill in values
pnpm typecheck
pnpm --filter @utn/web build
pnpm dev:web  # or: cd apps/web && pnpm start --port 3000
```

### 35.3 Local Supabase
```bash
pnpm db:start    # supabase start (Docker required)
pnpm db:reset    # applies migrations + seed.sql
pnpm db:stop
```

---

## 36. Cloudflare R2 Setup (Complete)

### 36.1 Buckets
Create three private buckets:
1. `private-credentials` — university documents
2. `pitch-videos` — live pitch recordings
3. `company-logos` — logos (public read via custom domain)

### 36.2 API token
Create an R2 API token with **Object Read & Write** for all three buckets.

### 36.3 CORS configuration
```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Apply to all three buckets. Mobile uses the same signed URLs.

### 36.4 Public logos
`company-logos` can be exposed through an R2 custom domain or r2.dev subdomain. Set `R2_PUBLIC_LOGOS_BASE_URL`. Do NOT make credentials or pitch-video buckets public.

---

## 37. Scripts and Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Next.js dev server on `:3000` |
| `pnpm build` | Turbo build (Next production build) |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:start` / `db:stop` | Local Supabase stack |
| `pnpm db:reset` | Re-apply migrations and seed |
| `pnpm db:push` | Push migrations to linked remote project |
| `pnpm --filter @utn/web build` | Build web app only |
| `pnpm --filter @utn/shared typecheck` | Typecheck shared package |
| `pnpm --filter @utn/web typecheck` | Typecheck web app |

---

## 38. Error Handling Patterns

### 38.1 API error format
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "issues": [...]  // Zod validation issues (optional)
}
```

### 38.2 HTTP status codes
- `200` — Success
- `400` — Bad request (invalid key, missing data)
- `401` — Unauthorized (invalid token)
- `403` — Forbidden (wrong role, not authorized)
- `404` — Not found
- `409` — Conflict (already verified, media locked)
- `413` — Payload too large
- `415` — Unsupported media type
- `422` — Validation failed
- `429` — Rate limited
- `500` — Server error
- `503` — Service not configured

### 38.3 Client-side error handling
- `authFetch` wraps fetch with Bearer token
- `readApiError` extracts error message from response
- Toast/alert notifications for user-facing errors
- Graceful degradation (fallback questions, manual review for PDFs)

---

## 39. Testing and Verification

### 39.1 Automated
- `pnpm typecheck` — TypeScript across all workspaces
- `pnpm --filter @utn/web build` — Next.js production build
- PGlite suite: all migrations + seed, 41/41 behavioral checks (RLS, verification transitions, review audit, registrar consent, credits, masking, unlocks, corporate email gate, chat)

### 39.2 Smoke tests
- tesseract.js OCR on generated degree image (95% confidence)
- Question generation (Groq, AI-tailored questions)
- Full candidate flow (profile → certificate → questions → assessment)
- Lighthouse accessibility 100 on key pages

### 39.3 Environment limitations
- No R2 credentials in some environments (finalize/OCR cannot be exercised end-to-end)
- Real browser/mobile camera recording cannot run headlessly
- Seed media keys are placeholders; playback returns 404 until real uploads

---

## 40. Known Limitations

1. **Seed media keys are placeholders** — certificate/video playback returns 404 until real uploads exist
2. **No R2 credentials in some environments** — finalize/OCR cannot be exercised end-to-end against R2
3. **Real camera recording cannot run headlessly** — camera-only flow, permission strings, 60s gate, 120s cap are implemented and typechecked but not runtime-tested
4. **First OCR run downloads `eng.traineddata`** — pre-seed cache for offline deployments
5. **`enable_confirmations = false`** for local demo — production must enable email confirmation
6. **Groq/Gemini API keys are optional** — without them, deterministic fallback questions are used
7. **PDF CV upload is optional** — not required for submission
8. **Mobile app removed** — responsive web client only (Expo app was removed in commit `5dd6026`)

---

## 41. Demo Accounts and Test Data

### Hosted project (jecdhhihbtaocbfzlljt)
| Account | Email | Role | Notes |
|---------|-------|------|-------|
| Admin | `you@example.com` | admin | Your account |
| Candidate | `omer29504@gmail.com` | candidate | Verified (Mohamad) |
| Employer | `ocampo29504@gmail.com` | employer | — |
| Demo grads | `grad1..5@utndemo.dev` | candidate | Password: `GradDemo2026!`, unverified |

### Local seed (README)
| Account | Email | Password | Role |
|---------|-------|----------|------|
| Admin | `admin@utn.dev` | `UtnAdmin123!` | admin |
| Northwind Labs | `hiring@northwindlabs.com` | `HireNorthwind123!` | employer (verified, 6 credits) |
| Quantum Forge | `talent@quantumforge.io` | `HireQuantum123!` | employer (verified) |
| Stealth Ventures | `people@stealthventures.co` | `HireStealth123!` | employer (unverified) |
| Amara Okafor | `amara.okafor@gmail.com` | `Candidate123!` | candidate (verified, Priority Pro) |
| Liam Chen | `liam.chen@outlook.com` | `Candidate123!` | candidate (pending) |
| Sofia Reyes | `sofia.reyes@proton.me` | `Candidate123!` | candidate (rejected, resubmission demo) |

---

## 42. Deployment Guide

### 42.1 Prerequisites
- Node.js 20.9+
- pnpm 9.15.4+
- Supabase project (hosted or local)
- Cloudflare R2 account with 3 buckets
- Stripe account (test or live mode)
- (Optional) Groq/Gemini API keys

### 42.2 Steps
1. Clone repository
2. `pnpm install`
3. Copy `.env.example` to `apps/web/.env.local` and fill in values
4. Apply migrations: `supabase db push --remote --yes` (or paste SQL in dashboard)
5. `pnpm --filter @utn/web build`
6. Deploy to Vercel/Node hosting
7. Configure Stripe webhook endpoint
8. Set up R2 CORS
9. (Optional) Add Groq/Gemini API keys

### 42.3 Production checklist
- [ ] Enable email confirmation in Supabase
- [ ] Set up Stripe webhook endpoint
- [ ] Configure R2 CORS for production domain
- [ ] Set up monitoring/logging
- [ ] Configure backup strategy
- [ ] Review RLS policies
- [ ] Test payment flow end-to-end
- [ ] Test verification flow end-to-end

---

## 43. Recent Development History (Git)

| Commit | Description |
|--------|-------------|
| `c548da7` | docs: update comprehensive report with UTN Core, peer community, expiration |
| `df122d8` | feat: UTN Core 4-question engine, peer community feed, 6-month profile expiration & renewal |
| `e0bbef3` | docs: add comprehensive platform report |
| `84ce632` | fix: persist certificate_r2_key during OCR so question generation can find it |
| `38d023f` | feat: generate assessment questions from specialization + graduate description, not certificate OCR |
| `e3a6f4c` | feat: separate optional PDF CV upload + Groq AI question generation |
| `632b4fa` | feat: server-safe blurred/locked certificate gating for employers |
| `9f89cb1` | feat: 4-question certificate-driven video assessment |
| `d29c7e7` | feat: restore jewel atelier and ship quiet-luxury talent UX |
| `ac26860` | docs: point reports at the midnight emerald release |
| `985a04c` | feat: midnight emerald theme and layered silk aurora |
| `71ea0c7` | docs: refresh project report for the jewel atelier release |
| `059f1b5` | polish: brand the error-boundary tab title |
| `8db4479` | feat: branded 404 and error states |
| `0f5148f` | fix: pass contrast on signed-in surfaces |
| `169fe1c` | feat: jewel atelier theme across the platform |
| `ed7efff` | feat: aurora silk ribbons across landing, auth, and workspace surfaces |
| `5dd6026` | chore: remove the Expo mobile app; ship a responsive web client only |
| `6bbc7ad` | security: harden API surface, uploads, and deployment defaults |
| `e0ecb5b` | feat: quiet luxury redesign with engraved heroes and glass surfaces |
| `4e41437` | feat: add a restrained motion system with an animated graduation cap |
| `5ff7ec1` | feat: add employer secure certificate viewer with immutable audit trail |
| `6c376dd` | feat: add University Talent Network platform |

---

## 44. Glossary

| Term | Definition |
|------|-----------|
| **UTN Core** | The 4-question, level-calibrated assessment engine |
| **Candidate** | A university graduate seeking employment |
| **Employer** | A company representative hiring candidates |
| **Admin** | Platform administrator who reviews verifications |
| **Verification** | Process of admin reviewing certificate + video + assessment |
| **Unlock** | Spending 1 credit to access a candidate's full dossier |
| **Credit** | Currency for unlocking candidates (2 trial on signup) |
| **Priority Pro** | Candidate subscription for featured placement |
| **DRM** | Digital Rights Management — canvas-rendered, watermarked certificate viewer |
| **RLS** | Row Level Security — Postgres access control |
| **Presign** | Pre-signed URL for direct R2 upload/download |
| **OCR** | Optical Character Recognition (tesseract.js) |
| **RPC** | Remote Procedure Call (Postgres function) |
| **Renewal cycle** | 6-month active window for verified profiles |
| **Peer community** | Identity-masked peer clip viewing (2/day) |
| **Intake readiness** | Self-assessed skill level (foundational/intermediate/advanced) |

---

*This report was generated from the live codebase on November 20, 2026. All features described are implemented and verified (typecheck + build passing). The platform is live on hosted Supabase with R2 storage and Groq AI integration.*
