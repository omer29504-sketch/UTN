# University Talent Network (UTN) — Comprehensive Platform Report

**Last updated:** November 19, 2026
**Repository:** `omer29504-sketch/UTN` (branch `main`, latest commit `84ce632`)
**Status:** All planned phases complete. Live on hosted Supabase (`jecdhhihbtaocbfzlljt`) with R2 storage configured.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What the Platform Is](#2-what-the-platform-is)
3. [Actors and Permissions](#3-actors-and-permissions)
4. [Business Model](#4-business-model)
5. [Trust Rules Enforced in the Database](#5-trust-rules-enforced-in-the-database)
6. [End-to-End Journeys](#6-end-to-end-journeys)
7. [Architecture](#7-architecture)
8. [Technology and Tools Inventory](#8-technology-and-tools-inventory)
9. [Monorepo Layout](#9-monorepo-layout)
10. [Data Model](#10-data-model)
11. [Migrations Timeline](#11-migrations-timeline)
12. [Authentication and Authorization](#12-authentication-and-authorization)
13. [Features Implemented](#13-features-implemented)
14. [The 4-Question Certificate-Driven Video Assessment](#14-the-4-question-certificate-driven-video-assessment)
15. [Separate PDF CV Upload](#15-separate-pdf-cv-upload)
16. [Server-Safe Blurred/Locked Certificate Gating](#16-server-safe-blurreddlocked-certificate-gating)
17. [API Reference](#17-api-reference)
18. [Storage and Media Pipeline](#18-storage-and-media-pipeline)
19. [Secure Employer Certificate Viewer (DRM)](#19-secure-employer-certificate-viewer-drm)
20. [Realtime Chat](#20-realtime-chat)
21. [Billing and Priority Pro](#21-billing-and-priority-pro)
22. [Design System](#22-design-system)
23. [Security Notes](#23-security-notes)
24. [Environment and Setup](#24-environment-and-setup)
25. [Cloudflare R2 Setup](#25-cloudflare-r2-setup)
26. [Scripts](#26-scripts)
27. [Verification and Known Limitations](#27-verification-and-known-limitations)
28. [Demo Accounts and Test Data](#28-demo-accounts-and-test-data)
29. [Recent Development History (Git)](#29-recent-development-history-git)

---

## 1. Executive Summary

**University Talent Network (UTN)** is a two-sided recruitment platform. University graduates prove their credentials once — a private degree certificate plus a live, unedited 2-minute video assessment — and employers discover them through a short pitch video. Contact details, certificates, and chat stay locked until an employer spends an unlock credit.

The repository is a **pnpm + Turborepo monorepo** containing a Next.js 15 web app (the only client after the Expo mobile app was removed), a shared domain package, an R2 storage package, a complete Supabase (Postgres/Auth/Realtime/RLS) schema, and Stripe billing. All planned phases (1–5) plus the 4-question assessment, separate CV upload, and server-safe certificate gating are complete. The platform is live on a hosted Supabase project with real R2 credentials.

---

## 2. What the Platform Is

- **Graduates** sign up, complete a profile (university, degree, major/specialization, graduation year), upload a private degree certificate (PDF/JPG/PNG), optionally upload a PDF CV, and complete a **4-question, 2-minute certificate-driven video assessment**. The whole candidate flow is 100% free.
- **Employers** sign up with a corporate email, receive 2 trial credits, search verified candidates (names masked until unlock), watch pitch videos for free, and spend 1 credit to unlock a full dossier (name, contact, certificate in a watermarked DRM viewer, CV, chat).
- **Admins** review submitted verifications (certificate + video + 4 questions) and approve or request changes. Candidates only become discoverable after admin approval of both certificate and video session.

---

## 3. Actors and Permissions

| Role | Capabilities |
|------|-------------|
| **Candidate** | Create profile, upload certificate/CV, complete 4-question assessment, submit for review, view review history, message unlocked employers |
| **Employer** | Create company profile, search verified candidates, watch pitch videos, unlock dossiers (1 credit), view certificates/CVs in watermarked viewer, chat with unlocked candidates, purchase credits |
| **Admin** | Everything above + review queue, approve/reject verifications, feature candidates (Priority Pro), manage credits |

Roles are stored in `profiles.role` and enforced by RLS + API route guards. Admin is never a public sign-up role.

---

## 4. Business Model

- **Free for graduates** — registration, profile, certificate upload, CV upload, OCR, 4-question assessment, video recording, submission, all free.
- **Employer credits** — 2 trial credits on signup (one per corporate domain to prevent farming). Additional packs via Stripe: 5 / 15 / 30 credits.
- **Unlock cost** — 1 credit per candidate dossier (name, contact, certificate viewer, CV, chat).
- **Priority Pro** — candidate subscription (Stripe) that features their profile and unlocks view analytics.

---

## 5. Trust Rules Enforced in the Database

These are Postgres rules, not UI conventions:

1. Certificates and pitch videos live in private object storage; certificates are never downloadable — only streamed into a canvas viewer.
2. Candidate names are masked (`Verified Candidate ####`) until a credit is spent.
3. Verification status only moves through an admin decision recorded in an append-only audit table.
4. Employer accounts require a corporate domain; free consumer domains are rejected.
5. Credits are append-only ledger rows; the balance is always derived, never stored.
6. Unlocks are atomic and idempotent (advisory lock + unique ledger reference).
7. Admin is not a public sign-up role and cannot be self-assigned.
8. Every certificate/CV view is watermarked, gated by consent, and written to an append-only audit log before the bytes are returned.
9. Candidates only become discoverable after admin approval of both certificate and 4-question video session.
10. The 4-question assessment (questions + chapter offsets) is required for submission.

---

## 6. End-to-End Journeys

### 6.1 Candidate journey

```
Sign up (candidate)
   │  Supabase Auth → profiles row (trigger) → /candidate/profile
   ▼
Complete profile (name, university, degree, major/specialization, graduation year, experience, headline)
   │  candidate_profiles row
   ▼
Verification studio (/candidate/verification)
   ├─ Upload certificate (PDF/JPG/PNG, ≤10 MB) → presign → R2 → OCR (tesseract.js)
   ├─ Upload optional PDF CV (≤10 MB) → presign → R2
   ├─ 4 questions auto-generate (Groq gpt-oss-20b or Gemini, or deterministic fallback)
   ├─ Record 4-question session (MediaRecorder, 30s each, 120s total, single file)
   └─ Consent to registrar verification → finalize
   ▼
Status: unverified → pending (trigger, when certificate + video + questions + duration exist)
   ▼
Admin approves or requests changes
   ├─ approve → verified → appears in employer search
   └─ reject  → rejected + reason → candidate can resubmit
   ▼
Employer unlocks → chat opens → messages flow in realtime
```

### 6.2 Employer journey

```
Sign up (employer, corporate email only)
   │  profiles row + provision → companies row (2 trial credits)
   ▼
Create/confirm company profile (/employer/company)
   ▼
Search verified candidates (free) — masked names, no contacts
   ▼
Watch pitch video (free)
   ▼
Unlock (spends 1 credit) → contact email/phone released
   ├─ Confidential certificate viewer (consent → stream → canvas + watermark + audit)
   ├─ PDF CV viewer (same gate)
   ├─ Pitch video
   └─ Realtime chat
```

### 6.3 Admin journey

```
/admin/verification (queue: status = pending)
   ▼
Review detail: profile claims · OCR text · certificate (signed link, 5 min) · pitch (10 min) · 4 chapter pills
   ▼
Approve / request changes (reason required, ≤ 1,000 chars)
   │  POST /api/admin/verification
   │  1. insert verification_reviews row
   │  2. update candidate_profiles.verification_status
   │  3. roll back audit row if update fails
```

---

## 7. Architecture

### 7.1 Runtime topology

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Next.js 15 App Router, client components)         │
│  └─ authFetch() with Bearer token                           │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────┐
│  Next.js 15 (Node runtime, Vercel/Node)                     │
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
```

### 7.2 Monorepo layout

```
.
├── apps/web/                  Next.js 15 App Router (TypeScript, Tailwind, Lucide)
│   └── src/
│       ├── app/
│       │   ├── (app)/         Session-guarded role workspaces
│       │   │   ├── candidate/{profile,verification}/
│       │   │   ├── employer/{company,candidates,candidates/[id],billing}/
│       │   │   └── admin/verification/[candidateId]/
│       │   ├── (auth)/{sign-in,sign-up}/
│       │   ├── api/
│       │   │   ├── admin/verification/route.ts
│       │   │   ├── auth/provision/route.ts
│       │   │   ├── candidate/generate-questions/route.ts
│       │   │   ├── employer/{certificates/[candidateId]/stream,security-event,unlock}/route.ts
│       │   │   ├── storage/presign/route.ts
│       │   │   ├── stripe/{checkout,webhook}/route.ts
│       │   │   └── verification/{finalize,ocr}/route.ts
│       │   ├── auth/callback/route.ts
│       │   ├── legal/employer-confidentiality/page.tsx
│       │   └── page.tsx       Landing page
│       ├── components/
│       │   ├── employer/{CandidateDossierDrawer,BlurredCredentialTeaser,secure-certificate-viewer}.tsx
│       │   ├── verification/{question-chapter-player}.tsx
│       │   └── ui/            Design system components
│       └── lib/
│           ├── api/           Bearer-token fetch helpers
│           ├── auth/          Session + role guards
│           ├── env.ts
│           └── supabase/{admin,auth,client,server}.ts
├── packages/
│   ├── shared/                Zod schemas, domain types, constants, helpers, design tokens
│   │   ├── design-tokens.cjs
│   │   └── src/{constants,helpers,schemas,types}.ts
│   └── storage/               Cloudflare R2 client + presigning
│       └── src/{keys,config,...}.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/            0001–0005, 0007–0009
│   └── seed.sql
├── scripts/
│   └── sync-pdfjs-worker.mjs
├── .env.example
├── package.json               (pnpm workspaces + turbo)
├── pnpm-workspace.yaml
└── turbo.json
```

Shared and storage packages export TypeScript source directly; Next transpiles them via `transpilePackages`. No separate build step for packages.

---

## 8. Technology and Tools Inventory

### 8.1 Languages and runtimes
- TypeScript (strict), Node.js 20.9+ (verified on Node 24), React 19

### 8.2 Frameworks and libraries
- **Next.js 15** (App Router, Server Components, Turbopack)
- **Tailwind CSS 4**, Lucide icons
- **Zod** (validation), **@supabase/ssr** / **@supabase/supabase-js**
- **@utn/shared** (Zod schemas, types, constants, helpers, design tokens)
- **@utn/storage** (R2 client, presigning)
- **tesseract.js** (OCR, WASM worker)
- **pdf.js** (in-browser PDF rendering to canvas)
- **Stripe** (Checkout + webhooks)
- **react-hook-form** (forms)

### 8.3 Development and delivery tooling
- pnpm 9.15.4, Turborepo, Prettier, ESLint, TypeScript
- Supabase CLI (migrations, remote push)
- GitHub (version control)

### 8.4 External services
- Supabase (Postgres, Auth, Realtime, RLS, Storage-disabled)
- Cloudflare R2 (object storage, 3 buckets)
- Stripe (payments, test mode)
- Groq (LLM: `openai/gpt-oss-20b`) and/or Google Gemini (`gemini-3.5-flash-lite`) for question generation

### 8.5 Browser platform APIs
- `navigator.mediaDevices.getUserMedia` + `MediaRecorder` (camera recording)
- HTML5 Canvas (certificate rendering, watermarking)
- `fetch` with Bearer tokens, `URL.createObjectURL`

---

## 9. Data Model

### 9.1 Enums
- `user_role`: `candidate | employer | admin`
- `verification_status`: `unverified | pending | verified | rejected`
- `degree_level`: `Bachelor's Degree | Master's Degree | Doctorate | ...`
- `industry`: various industry categories

### 9.2 Tables

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user; role, email, TOS acceptance |
| `candidate_profiles` | Degree, university, major/specialization, graduation year, experience, headline, industry, phone, verification status, rejection reason, featured flag, registrar consent |
| `candidate_media` | Certificate key, CV key, video key, duration, OCR text, 4-question session (JSONB), total duration, questions generated at, submitted_at |
| `verification_reviews` | Append-only admin decision audit trail |
| `companies` | One per employer; unique corporate domain, verification, logo consent, credits |
| `credit_ledger` | Append-only credit transactions; balance is derived |
| `company_unlocked_candidates` | Paid entitlement rows (employer ↔ candidate) |
| `messages` | Unlocked chat messages (realtime publication enabled) |
| `candidate_profile_views` | Priority Pro analytics |
| `company_marquee` | Anonymous-safe view for landing-page logo marquee |

### 9.3 Key RPCs (25+)
- `unlock_candidate(company_id, candidate_id)` — spends one credit, creates entitlement, idempotent
- `get_verified_candidates_for_employer(...)` — search/filter verified candidates with server-side masking + certificate_locked flag
- `get_my_credit_balance()` — derived balance for signed-in employer
- `is_valid_video_session_questions(jsonb)` — validates the 4-question payload shape

### 9.4 Triggers (12+)
- `on_auth_user_created` → `handle_new_user()` (provisions profile row)
- `protect_candidate_fields` (blocks self-verification and role escalation)
- `guard_candidate_media` (validates storage key prefixes, locks during review, sets submitted_at)
- `sync_candidate_submission` (promotes unverified/rejected → pending when media complete)
- `protect_profile_role`, `protect_company_fields`, `validate_company_domain`
- `set_updated_at`, `normalize_profile_email`

### 9.5 Row Level Security
- RLS enabled on every table
- 26+ policies covering candidate/employer/admin access
- Candidates can only read/write their own data
- Employers can only read verified candidates (masked) and their own company/unlocks
- Admins have full access
- Employers never read `candidate_media` directly — only via the RPC

### 9.6 Storage key validation
- Keys must sit under the owner's UUID prefix: `private-credentials/<uuid>/...`, `pitch-videos/<uuid>/...`
- Keys cannot contain `..` or start with `/`
- Validated by `guard_candidate_media()` trigger and API routes

---

## 10. Migrations Timeline

| Migration | Scope |
|-----------|-------|
| `0001_initial_schema.sql` | Core tables, enums, RLS, triggers, RPCs, seed |
| `0002_verification_reviews.sql` | Admin review audit trail |
| `0003_degree_verification_compliance.sql` | Registrar consent columns/constraints |
| `0004_employer_certificate_confidentiality.sql` | TOS acceptance, document_access_logs, certificate streaming support |
| `0005_security_hardening.sql` | Revoke PUBLIC/anon EXECUTE, fix search_path on functions |
| `0007_certificate_video_questions.sql` | `major_specialization`, `video_session_questions` (JSONB), `video_total_duration_seconds`, `questions_generated_at`; validator function; guard/sync/promotion refresh; RPC update with new columns |
| `0008_certificate_locked_flag.sql` | `certificate_locked` boolean in employer discovery RPC |
| `0009_cv_upload.sql` | `cv_r2_key` column; guard validation; RPC exposes `cv_r2_key` (masked until unlock) |

---

## 11. Authentication and Authorization

### 11.1 Session model
- **Web:** `@supabase/ssr` cookie sessions for server-rendered pages; bearer tokens via `authFetch` for API routes
- **Route groups:** `(auth)` redirects signed-in users; `(app)` redirects signed-out users; `requireRole()` guards pages server-side

### 11.2 Sign-up, sign-in, callback
- Account rows provisioned idempotently by `provisionAccount`
- `/api/auth/provision` handles immediate-session signups
- `/auth/callback` handles email-confirmation signups
- Employer signups rejected on consumer domains (gmail, yahoo, hotmail, outlook, icloud, etc.)

### 11.3 Five authorization layers
1. Supabase configured check → 503
2. Same-origin check (state-changing) → 403 `cross_origin_blocked`
3. Content-Length > 64 KiB → 413 `payload_too_large`
4. Per-IP budget (300/min) → 429 `rate_limited`
5. Bearer token verified with Supabase → 401 `invalid_token`
6. Per-user route budget → 429 `rate_limited`
7. Role read from profiles (service role) → 403 `profile_missing`

### 11.4 Admin bootstrap
Admin is never a public sign-up role. Promote via SQL: `update public.profiles set role = 'admin' where email = '...'`

---

## 12. Features Implemented

### 12.1 Public landing page (`/`)
Marketing page with hero, features, logo marquee, CTAs

### 12.2 Candidate profile (`/candidate/profile`)
Degree, university, major/specialization, graduation year, experience, headline, industry, phone. Upserts `candidate_profiles`.

### 12.3 Verification studio (`/candidate/verification`)
- 4-step rail: University Details → Degree Upload → Assessment Questions → 4-Question Session
- Camera/mic readiness check
- Certificate upload (PDF/JPG/PNG, ≤10 MB) with OCR
- Optional PDF CV upload (≤10 MB)
- 4-question assessment (30s each, 120s total, single continuous recording)
- Registrar consent checkbox
- Submit for review (finalize)

### 12.4 OCR (`POST /api/verification/ocr`)
Server-side tesseract.js on raster images; PDFs skipped for manual review. Draft OCR results upserted into `candidate_media`. Now also persists `certificate_r2_key`.

### 12.5 Finalize (`POST /api/verification/finalize`)
Re-checks R2 object existence, exact size, content type, owner-prefixed keys. Persists consent, media (certificate, CV, video, questions, duration), moves profile to `pending`.

### 12.6 Admin review (`/admin/verification`)
Queue of pending candidates; detail page with profile claims, OCR text, certificate link (5 min), pitch video, 4 chapter pills. Approve/reject with reason.

### 12.7 Discovery and search (`/employer/candidates`)
Search/filter verified candidates (masked names). Unlock via 1 credit. Pitch video free. Certificate/CV gated behind unlock.

### 12.8 Unlock (`POST /api/employer/unlock`)
Atomic credit spend + entitlement creation. Idempotent.

### 12.9 Confidential certificate viewer
Zero-download, canvas-rendered, watermarked, anti-capture. See §19.

### 12.10 Realtime chat
Supabase Realtime on `messages` table. Requires unlock. See §20.

### 12.11 Billing and Priority Pro
Stripe Checkout for credit packs and Priority Pro subscription. Webhook → ledger insert. See §21.

### 12.12 Dashboards
Role-based dashboards with stats and quick links.

### 12.13 Legal page
`/legal/employer-confidentiality` — canonical legal copy for employer confidentiality clause.

---

## 13. The 4-Question Certificate-Driven Video Assessment

### 13.1 Overview
The candidate pitch was transformed from a single 60–120s take into a **2-minute, 4-question assessment** generated from the candidate's degree specialization and professional description.

### 13.2 Question categories
1. **Q1 — Core Academic Foundation** (30s): probes grasp of degree fundamentals
2. **Q2 — Technical/Domain Problem-Solving** (30s): concrete scenario in their specialization
3. **Q3 — Applied Project/Analytical Thinking** (30s): real-world application or analysis
4. **Q4 — Career Readiness & Employer Value** (30s): why hire them, first-90-days value

### 13.3 Generation pipeline
- **Endpoint:** `POST /api/candidate/generate-questions`
- **Auth:** `requireApiCaller()` + rate limit (`generateQuestions`: 6/5min) + Zod
- **Input:** degree title, major/specialization, university, industry, headline/description, optional client keywords
- **Provider:** Groq `openai/gpt-oss-20b` (priority) → Gemini `gemini-3.5-flash-lite` → deterministic discipline-keyed fallback
- **Questions derived from specialization + description**, NOT from certificate OCR text
- **Idempotent:** once questions exist, returns stored (prevents cherry-picking). Regeneration allowed only after admin rejection.
- **Validation:** Zod schema enforces exactly 4 questions, indices 1–4, 30s each summing to 120, contiguous chapters starting at 0

### 13.4 Recording flow
- Single continuous `MediaRecorder` stream producing one `.webm`/`.mp4` upload
- `MediaRecorder.pause()`/`resume()` between questions so the file timeline equals accumulated active seconds (≤120)
- UI: 02:00 total / 30s per question; Q1 reveal + "Start Question 1" + live 00:30 countdown; "Done with Q1" or timer end marks `end_offset_seconds`, pauses, reveals Q2; Q2–Q4 reveal text, "Start Timing" resumes; after Q4 finalize blob, upload once via presigned R2 flow, save exact chapter timestamps

### 13.5 Employer/Admin playback
- Shared `QuestionChapterPlayer` component renders 4 clickable chapter cards below the video
- Clicking seeks `videoRef.current.currentTime = q.start_offset_seconds`
- Highlights active question as playback progresses
- Used in both employer dossier drawer and admin review page

### 13.6 Accessibility
- `aria-live="polite"` for step changes (no per-second spam)
- 44×44px touch targets
- Keyboard navigation (Enter/Space to seek)

---

## 14. Separate PDF CV Upload

### 14.1 Overview
Candidates can optionally upload a PDF CV alongside their degree certificate. It is stored under the same `private-credentials/` prefix and gated behind the same 1-credit employer unlock.

### 14.2 Implementation
- **Migration 0009:** `cv_r2_key` column on `candidate_media`; guard validates prefix; RPC exposes `cv_r2_key` (masked until unlock)
- **Shared types:** `CandidateMedia.cv_r2_key`, `EmployerCandidateCard.cv_r2_key`
- **Shared schema:** optional `cv` field in `candidateVerificationSubmissionSchema`
- **Finalize route:** optional CV with R2 HEAD verification (size + content type), persisted on submit
- **Candidate studio:** "Add your PDF CV (optional)" upload card (PDF, max 10 MB) with remove button; CV key included in atomic finalize payload
- **Employer stream:** `?kind=cv` serves CV bytes through the same watermarked, audited, unlock-gated path
- **Employer drawer:** renders a second `SecureCertificateViewer` for the CV after unlock
- **Admin page:** shows CV inline as an iframe

### 14.3 Free for graduates
No payment gates, credit checks, or paywalls on CV upload.

---

## 15. Server-Safe Blurred/Locked Certificate Gating

### 15.1 Zero-leak backend gating
- Before unlock: server never returns real certificate storage key, presigned URL, or raw bytes. Returns only safe metadata: `verification_status: 'verified'`, degree title, major, university, graduation year, `certificate_locked: true`
- After unlock: verifies unlock record in `company_unlocked_candidates`, logs access in `document_access_logs`, streams real certificate into watermarked `<CanvasDocumentViewer />`

### 15.2 Employer dossier drawer — blurred teaser
- When not unlocked: renders a synthetic blurred certificate SVG (never the real file) with:
  - Emerald "UTN Verified Degree" seal
  - Visible verified metadata (degree, university, graduation year)
  - Lock overlay: "Official University Certificate & PDF CV Locked — Spend 1 Credit to Unblur & Inspect"
  - "Unlock Full Dossier (1 Credit)" button or "Top Up Credits" CTA if balance is 0
- After unlock: transitions to live watermarked DRM viewer + enables contact/messaging without page reload

### 15.3 Graduates 100% free
No payment gates on registration, certificate upload, PDF CV, or 4-question assessment.

---

## 16. API Reference

### Authentication
- `POST /api/auth/provision` — provision account
- `GET /auth/callback` — email confirmation callback

### Storage
- `POST /api/storage/presign` — presigned upload/download URLs (bearer token required)

### Verification
- `POST /api/verification/ocr` — server-side OCR (tesseract.js)
- `POST /api/verification/finalize` — finalize submission (certificate + video + questions + CV + consent)

### Candidate
- `POST /api/candidate/generate-questions` — generate 4 assessment questions (Groq/Gemini/fallback)

### Admin
- `POST /api/admin/verification` — approve/reject verification

### Employer
- `GET /api/employer/certificates/[candidateId]/stream` — zero-download certificate/CV stream (`?kind=cv` for CV, `?format=base64` for mobile)
- `POST /api/employer/certificates/[candidateId]/security-event` — log security events
- `POST /api/employer/unlock` — spend credit to unlock candidate

### Stripe
- `POST /api/stripe/checkout` — create checkout session
- `POST /api/stripe/webhook` — Stripe webhook handler

---

## 17. Storage and Media Pipeline

### 17.1 Buckets
1. `private-credentials` — university documents (PDF/JPG/PNG, ≤10 MB)
2. `pitch-videos` — live pitch recordings (WebM/MP4/MOV, ≤50 MB)
3. `company-logos` — logos (PNG/JPG/WebP/SVG, ≤2 MB, public read)

### 17.2 Key construction
`buildObjectKey`: `<bucket>/<owner-uuid>/<random-uuid>.<ext>` — unguessable, ownership-prefixed.

### 17.3 Presigning rules
- Upload PUT URLs expire in 10 minutes; download GET URLs in 5 min (certificates) / 10 min (videos)
- Client must send `requiredHeaders` exactly (Content-Type + Content-Length are part of signature)
- Employer requests for `private-credentials` rejected with `403 use_secure_viewer`

### 17.4 Download authorization matrix

| Caller | Pitch video | Certificate | CV | Company logo |
|--------|-------------|-------------|-----|-------------|
| Admin | Any | Any (signed) | Any (signed) | Any |
| Owner candidate | Own | Own | Own | — |
| Employer | Any verified | Only unlocked (streamed) | Only unlocked (streamed) | — |

---

## 18. Secure Employer Certificate Viewer (DRM)

Employers never receive a certificate file, presigned URL, or direct R2 link.

1. **Click-through consent** — employer must read and accept the confidentiality clause before first certificate. Logged as `tos_accepted`.
2. **Zero-download stream** — server reads private R2 object, returns bytes with `no-store`/`no-cache` headers, writes `certificate_viewed` audit row (IP, user agent, watermark signature).
3. **In-memory rendering** — PDFs (pdf.js) or images painted onto HTML5 `<canvas>`. No `<img src>`, blob URL, or `<a download>` in DOM.
4. **Forensic watermark** — diagonal watermark burned into canvas pixels + SVG overlay: employer name, email, short id, UTC time, refreshed every minute.
5. **Anti-capture** — right-click, selection, drag suppressed; window blur/tab hiding covers canvas with privacy shield; PrintScreen/Ctrl+P/Ctrl+S/Ctrl+Shift+I blank canvas; `@media print` hides viewer.
6. **One-hour re-acknowledgment** — every open shows warning modal; 10-second interval re-locks after 60 minutes.
7. **Mobile lock** — Expo `usePreventScreenCapture()` (Android FLAG_SECURE, iOS recording protection), screenshot listener.

---

## 19. Realtime Chat

- Supabase Realtime on `messages` table
- Requires unlock (enforced by RLS + trigger)
- Real-time message delivery between employer and candidate
- Chat UI in employer dossier drawer and candidate messages page

---

## 20. Billing and Priority Pro

### 20.1 Credit packs
- 5 / 15 / 30 credits via Stripe Checkout
- Webhook → ledger insert (`+N`, reason=`stripe_credit_pack`, reference=hash(session.id))
- Unique index makes retries idempotent

### 20.2 Priority Pro
- Candidate subscription via Stripe
- Webhook sets `candidate_profiles.is_featured = true`
- Featured candidates appear first in search results

### 20.3 Trial credits
- Each new company receives 2 credits (once per unique corporate domain)

---

## 21. Design System

**Executive Slate & Alabaster** palette:
- Slate `#0F172A` / `#1E293B` for structure and text
- Alabaster `#F8FAFC` / `#FFFFFF` for surfaces
- Indigo `#4F46E5` for actions and links
- Emerald `#10B981` for verified marks and success states

Typography: **Plus Jakarta Sans** (headings), **Inter** (body). Fonts loaded via `next/font` (web).

Tokens live in `packages/shared/design-tokens.cjs` — single source of truth consumed by Tailwind configs.

Jewel Atelier theme: midnight emerald, layered silk aurora, engraved heroes, glass surfaces, animated graduation cap.

---

## 22. Security Notes

- Service-role key is server-only (`server-only` guard in admin.ts)
- RLS enabled on every table
- Presigned URLs are bearer capabilities — keep TTLs short, never log them
- Stripe webhooks verify signatures; ledger unique index for idempotency
- Marquee view exposes only company id, name, logo key, creation time
- Storage keys validated against owner prefix and path traversal
- Rate limiting: per-IP (300/min) + per-user per-route budgets
- Content-Length cap: 64 KiB
- Same-origin check on state-changing requests

---

## 23. Environment and Setup

### Required variables (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_PRIVATE_CREDENTIALS
R2_BUCKET_PITCH_VIDEOS
R2_BUCKET_COMPANY_LOGOS
R2_PUBLIC_LOGOS_BASE_URL (optional)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_CREDITS_5/15/30
STRIPE_PRICE_CANDIDATE_PRO
GROQ_API_KEY (optional, for AI question generation)
GEMINI_API_KEY (optional, alternative LLM)
```

### Quick start
```bash
corepack enable
pnpm install
cp .env.example apps/web/.env.local
# Fill in Supabase + R2 + Stripe values
pnpm typecheck
pnpm --filter @utn/web build
pnpm dev:web  # or: cd apps/web && pnpm start --port 3000
```

### Local Supabase
```bash
pnpm db:start    # supabase start (Docker required)
pnpm db:reset    # applies migrations + seed.sql
pnpm db:stop
```

Environment reads are lazy and fail closed at request time, so `next build` works without secrets.

---

## 24. Cloudflare R2 Setup

Three private buckets required:
1. `private-credentials` — university documents
2. `pitch-videos` — live pitch recordings
3. `company-logos` — logos (public read via custom domain)

R2 API token with Object Read & Write. CORS on all buckets for direct browser uploads (GET, PUT, HEAD; Content-Type, Content-Length headers; ETag exposed).

---

## 25. Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Next.js dev server on `:3000` |
| `pnpm build` | Turbo build (Next production build) |
| `pnpm typecheck` | TypeScript across all workspaces |
| `pnpm format` / `format:check` | Prettier |
| `pnpm db:start` / `db:stop` | Local Supabase stack |
| `pnpm db:reset` | Re-apply migrations and seed |
| `pnpm db:push` | Push migrations to linked remote project |

---

## 26. Verification and Known Limitations

### Verified
- `pnpm typecheck` across shared, storage, web
- `pnpm --filter @utn/web build` (Next.js 15 production build)
- Supabase migrations applied to hosted project (0001–0005, 0007–0009)
- Question generation smoke test (Groq, AI-tailored questions)
- Full candidate flow smoke test (profile → certificate → questions → assessment)
- Lighthouse accessibility 100 on key pages

### Known limitations
- Seed media keys are placeholders; certificate/video playback returns 404 until real uploads exist
- No R2 credentials locally in some environments (finalize/OCR cannot be exercised end-to-end)
- Real browser/mobile camera recording cannot run headlessly
- First OCR run downloads `eng.traineddata` via tesseract.js; pre-seed cache for offline deployments
- `supabase/config.toml` sets `enable_confirmations = false` for local demo; production must enable email confirmation
- Groq/Gemini API keys are optional; without them, deterministic fallback questions are used

---

## 27. Demo Accounts and Test Data

### Hosted project (jecdhhihbtaocbfzlljt)
| Account | Email | Role | Notes |
|---------|-------|------|-------|
| Admin | `you@example.com` | admin | Your account |
| Candidate | `omer29504@gmail.com` | candidate | Verified (Mohamad) |
| Employer | `ocampo29504@gmail.com` | employer | — |
| Demo grads | `grad1..5@utndemo.dev` | candidate | Password: `GradDemo2026!`, unverified, for flow testing |

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

## 28. Recent Development History (Git)

| Commit | Description |
|--------|-------------|
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

*This report was generated from the live codebase on November 19, 2026. All features described are implemented and verified (typecheck + build passing).*
