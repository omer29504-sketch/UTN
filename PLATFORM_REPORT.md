# University Talent Network — Platform Report

**Report date:** 2026-11-18
**Repository:** `/home/bannda/Desktop/University Talent Network (UTN)`
**Commit:** `985a04c` (main, pushed)
**Client:** responsive Next.js web app (the Expo client was removed)
**Backend:** Supabase Cloud project `jecdhhihbtaocbfzlljt`
**Local URL:** `http://localhost:3000` (LAN `http://192.168.70.72:3000`)
**Design system:** "Midnight Emerald" — deep emerald-ink canvas, dark glass cards,
champagne-gold hairlines, warm ivory type, and a permanent aurora (see §11)

This document describes the platform as built: what it does, how each flow works, every
technology and tool in use, the data model, the API surface, the security controls, the
design system, and what is still missing. It is the "everything" reference; the shorter
`PROJECT_REPORT.md` is the delivery narrative and `SECURITY.md` is the security policy.

---

## Contents

1. [What the platform is](#1-what-the-platform-is)
2. [How the platform works end to end](#2-how-the-platform-works-end-to-end)
3. [Architecture](#3-architecture)
4. [Technology and tools inventory](#4-technology-and-tools-inventory)
5. [Data model](#5-data-model)
6. [Authentication and authorization](#6-authentication-and-authorization)
7. [Features implemented](#7-features-implemented)
8. [API reference](#8-api-reference)
9. [Storage and media pipeline](#9-storage-and-media-pipeline)
10. [Security program](#10-security-program)
11. [UI and design system](#11-ui-and-design-system)
12. [Configuration](#12-configuration)
13. [Build, run, and operations](#13-build-run-and-operations)
14. [Verification status](#14-verification-status)
15. [Gaps and roadmap](#15-gaps-and-roadmap)
16. [File map](#16-file-map)
17. [Glossary](#17-glossary)

---

## 1. What the platform is

### 1.1 The product

University Talent Network (UTN) is a two-sided recruitment marketplace built around one
idea: **a degree claim is worth nothing until someone verifies it, and a CV is worth
nothing until you see the person.**

- A **graduate** uploads a degree certificate, records a single unedited 60–120 second
  camera pitch, and consents to registrar verification. Only after an administrator
  approves the submission does the profile become discoverable.
- An **employer** signs up with a corporate email address, searches verified graduates for
  free, watches pitch videos for free, and spends **one unlock credit** to reveal contact
  details, open the confidential certificate, and start a chat.
- An **administrator** reviews each submission against the certificate, the OCR text, and
  the pitch, then records an immutable decision.

### 1.2 Actors and permissions

| Actor         | Can do                                                                                            | Cannot do                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Candidate** | Create/edit own profile; upload certificate and pitch; submit for review; chat after an unlock    | See other candidates; spend credits; self-verify; upload after submission          |
| **Employer**  | Create company; search verified candidates; watch pitches; spend credits; open certificates; chat | See certificates without consent + unlock; download media; self-verify the company |
| **Admin**     | Review queue; read any media; approve/reject with audit trail; read all audit logs                | Sign up through the public form; self-promote from the UI                          |
| **Anonymous** | Landing page; sign-up/sign-in; public company marquee; legal clause                               | Any workspace, API, or database table                                              |

### 1.3 Business model

| Item                           | Value                                     | Source                      |
| ------------------------------ | ----------------------------------------- | --------------------------- |
| Free trial credits per company | 2                                         | `FREE_TRIAL_CREDITS`        |
| Cost per candidate unlock      | 1 credit                                  | `UNLOCK_COST_CREDITS`       |
| Credit packs                   | Starter 5 · Growth 15 · Scale 30          | `CREDIT_PACKS`              |
| Candidate upgrade              | Priority Pro (paid placement + analytics) | `CANDIDATE_PRO_PLAN`        |
| Pitch length                   | 60–120 seconds, camera only               | `MIN/MAX_PITCH_SECONDS`     |
| Certificate formats            | PDF, JPEG, PNG up to 10 MB                | `ALLOWED_UPLOAD_MIME_TYPES` |

Revenue comes from employer credit packs and the optional candidate upgrade. Browsing and
pitch playback are deliberately free so employers only pay at the moment of intent.

### 1.4 Trust rules the platform enforces

These are database rules, not UI conventions:

1. Certificates and pitch videos live in private object storage; certificates are never
   downloadable, only streamed into a canvas viewer.
2. Candidate names are masked (`Verified Candidate ####`) until a credit is spent.
3. Verification status only moves through an admin decision recorded in an audit table.
4. Employer accounts require a corporate domain; free consumer domains are rejected.
5. Credits are append-only ledger rows; the balance is always derived, never stored.
6. Unlocks are atomic and idempotent; two concurrent requests cannot both spend the last
   credit.
7. Admin is not a public sign-up role and cannot be self-assigned.
8. Every certificate view is watermarked, gated by consent, and written to an append-only
   audit log before the bytes are returned.

---

## 2. How the platform works end to end

### 2.1 Candidate journey

```
Sign up (candidate)
   │  Supabase Auth → profiles row (trigger) → /candidate/profile
   ▼
Complete profile (name, university, degree, graduation year, experience, headline)
   │  candidate_profiles row
   ▼
Verification studio
   ├─ Upload certificate → POST /api/storage/presign (PUT to R2) → POST /api/verification/ocr
   ├─ Record pitch (MediaRecorder, 60–120 s, 1280×720) → preview → upload to R2
   └─ Consent to registrar verification → POST /api/verification/finalize
   ▼
Status: unverified → pending (trigger, when both assets exist)
   ▼
Admin approves or requests changes
   ├─ approve → verified → appears in employer search
   └─ reject  → rejected + reason → candidate can resubmit
   ▼
Employer unlocks → chat opens → messages flow in realtime
```

### 2.2 Employer journey

```
Sign up (employer, corporate email only)
   │  profiles row + POST /api/auth/provision → companies row
   │  companies trigger grants 2 trial credits (once per company)
   ▼
Create/confirm company profile (/employer/company)
   ▼
Search verified candidates (free)
   │  RPC get_verified_candidates_for_employer: masked names, no contacts
   ▼
Watch pitch video (free, presigned GET after entitlement check)
   ▼
Unlock (spends 1 credit)
   │  POST /api/employer/unlock → RPC unlock_candidate (advisory lock + ledger)
   ▼
Unlocked detail page
   ├─ Contact email + phone
   ├─ Confidential certificate viewer (consent → stream → canvas + watermark + audit)
   ├─ Pitch video
   └─ Realtime chat
```

### 2.3 Admin journey

```
/admin/verification (queue: status = pending)
   ▼
Review detail: profile claims · OCR text · certificate link (5 min) · pitch link (10 min)
   ▼
Approve / request changes (reason required, ≤ 1,000 chars)
   │  POST /api/admin/verification
   │  1. insert verification_reviews row (auditor identity snapshot)
   │  2. update candidate_profiles.verification_status
   │  3. roll back the audit row if the update fails
   ▼
Candidate sees the decision and review history
```

### 2.4 Lifecycle of one authenticated API call

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

The Stripe webhook is the one route that does not use bearer auth; it verifies the Stripe
signature instead, under its own IP budget and body cap.

### 2.5 Money flow

```
Employer clicks a credit pack
  → POST /api/stripe/checkout (role + company checks, pack lookup, price env lookup)
  → Stripe Checkout session (metadata: kind, companyId, packId, credits)
  → user pays on Stripe
  → checkout.session.completed webhook
      → signature verified against raw body
      → ledger insert (+N, reason=stripe_credit_pack, reference=hash(session.id))
      → unique index makes retries idempotent
  → balance = SUM(ledger.delta)
```

Priority Pro uses the same flow with `kind=candidate_pro`; the webhook sets
`candidate_profiles.is_featured = true`.

### 2.6 Media flow

```
Browser ──(1) presign request──▶ /api/storage/presign ──(auth + ownership)──▶ R2 signer
        ◀──(2) short-lived PUT URL + signed Content-Type/Length──
        ──(3) PUT bytes────────────────────────────────────────▶ R2 bucket
        ──(4) finalize/OCR with the key───────────────────────▶ API
                                                              ├─ HEAD object (exists/size/type)
                                                              ├─ GET object (server-side OCR)
                                                              └─ record keys in Postgres
```

The browser never holds R2 credentials and never chooses its own object key.

---

## 3. Architecture

### 3.1 Runtime topology

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                 │
│  React 19 client components · MediaRecorder · pdf.js · canvas viewer     │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ HTTPS
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  apps/web — Next.js 15 App Router on Node.js                             │
│  ├─ Server Components: SSR pages, session-aware data reads               │
│  ├─ Client Components: forms, studio, viewer, chat                       │
│  ├─ Route handlers: 10 API endpoints (nodejs runtime)                    │
│  ├─ Middleware: session refresh + route protection                       │
│  └─ Security headers + CSP on every response                             │
└───────┬───────────────────┬───────────────────────┬──────────────────────┘
        │                   │                       │
        ▼                   ▼                       ▼
┌───────────────┐   ┌───────────────────┐   ┌──────────────────────┐
│ Supabase      │   │ Cloudflare R2     │   │ Stripe               │
│ Postgres      │   │ private-creds     │   │ Checkout             │
│ Auth          │   │ pitch-videos      │   │ Webhooks             │
│ Realtime      │   │ company-logos     │   │ (signed events)      │
│ RLS + RPCs    │   │ (S3-compatible)   │   └──────────────────────┘
└───────────────┘   └───────────────────┘
        ▲
        │ optional
┌───────────────┐
│ Upstash Redis │  distributed rate-limit counters
└───────────────┘
```

There is no separate backend service, no queue, and no background worker. Everything is
either a Next.js server render, a route handler, a Supabase RPC/trigger, or a browser API.

### 3.2 Monorepo layout

```
.
├── apps/web/                     Next.js 15 App Router (the only client)
│   ├── src/app/
│   │   ├── (app)/                Session-guarded role workspaces
│   │   ├── auth/                 Sign-in, sign-up, PKCE callback
│   │   ├── api/                  10 route handlers
│   │   ├── legal/                Public employer confidentiality clause
│   │   ├── layout.tsx            Fonts, metadata, skip link
│   │   └── page.tsx              Public landing page
│   ├── src/components/           UI primitives, feature components, motion
│   ├── src/lib/
│   │   ├── api/                  authFetch + API error helpers
│   │   ├── auth/                 session, role guard, provisioning, redirects
│   │   ├── security/             rate limit, origin check, logging, fingerprints
│   │   └── supabase/             browser / server / auth / admin clients
│   └── src/middleware.ts
├── packages/shared/              Zod schemas, types, constants, helpers, legal copy
├── packages/storage/             R2 config, key builder, presign/head/read/delete
├── supabase/
│   ├── migrations/               0001 … 0005
│   ├── seed.sql                  Local demo data (fixed UUIDs)
│   └── config.toml               Local stack; built-in Storage disabled
├── scripts/sync-pdfjs-worker.mjs Copies the pdf.js worker into public/ on install
├── .github/workflows/security.yml Audit + secret scan + typecheck
├── .github/dependabot.yml        Weekly dependency updates
├── SECURITY.md                   Policy, external config, IR, GDPR
├── PROJECT_REPORT.md             Delivery report
└── PLATFORM_REPORT.md            This document
```

Workspace packages export TypeScript source directly; `next.config.ts` lists them in
`transpilePackages`, so there is no separate build step for `@utn/shared` or `@utn/storage`.

### 3.3 Why these choices

| Decision                                  | Reason                                             | Consequence                                                                      |
| ----------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| Supabase Cloud (not local Docker)         | Docker/CLI unavailable in the build environment    | Migrations applied via Management API/SQL editor; local reset path untested here |
| Cloudflare R2 instead of Supabase Storage | Zero egress fees and independent access control    | Presigning code, CORS, and bucket policy are our responsibility                  |
| Authorization in PostgreSQL               | The UI can be bypassed; the database cannot        | RLS + triggers + security-definer RPCs are the real boundary                     |
| Append-only credit ledger                 | Auditable, race-free, idempotent                   | Balance is a `SUM()`; no mutable balance column                                  |
| Service role only after explicit auth     | Limits blast radius of a bug                       | Every route runs `requireApiCaller()` first                                      |
| One web client                            | One auth model, one API surface, one header policy | No push notifications or app-store presence                                      |
| CSS-first visuals                         | No image weight, no canvas, no JS for decoration   | Aurora is pure CSS/SVG and freezes under reduced motion                          |

---

## 4. Technology and tools inventory

### 4.1 Languages and runtimes

| Item                     | Version                             | Where                           |
| ------------------------ | ----------------------------------- | ------------------------------- |
| TypeScript               | 5.9.3                               | All workspaces                  |
| Node.js                  | ≥ 20.9 (verified on Node 24)        | Next.js server, scripts         |
| SQL (PostgreSQL dialect) | Supabase Postgres                   | Migrations, RPCs, RLS           |
| CSS                      | Tailwind 3.4.19 + custom properties | Styling                         |
| Bash / Node scripts      | —                                   | `scripts/sync-pdfjs-worker.mjs` |

### 4.2 Frameworks and libraries

| Tool                              | Version       | Role in the platform                                     |
| --------------------------------- | ------------- | -------------------------------------------------------- |
| **Next.js**                       | 15.5.29       | App Router, SSR, route handlers, middleware, `next/font` |
| **React / React DOM**             | 19.1.0        | Server and client components                             |
| **Tailwind CSS**                  | 3.4.19        | Utility styling; palette in `tailwind.config.ts`         |
| **Lucide React**                  | 1.72.0        | Icon set                                                 |
| **clsx + tailwind-merge**         | 2.1.1 / 2.6.0 | Conditional class composition (`cn`)                     |
| **@supabase/ssr**                 | 0.12.7        | Cookie-based sessions shared by server and browser       |
| **@supabase/supabase-js**         | 2.119.0       | PostgREST queries, Auth, Realtime, RPC calls             |
| **Zod**                           | 3.25.76       | Every input contract, shared by client and server        |
| **Stripe Node SDK**               | 23.1.0        | Checkout sessions and webhook signature verification     |
| **tesseract.js**                  | 7.0.0         | Server-side OCR of raster certificates                   |
| **pdfjs-dist**                    | 4.10.38       | PDF rendering into the certificate canvas                |
| **@aws-sdk/client-s3**            | 3.1167.0      | R2 object operations (S3-compatible)                     |
| **@aws-sdk/s3-request-presigner** | 3.1167.0      | Signed PUT/GET URLs                                      |

### 4.3 Development and delivery tooling

| Tool                       | Version         | Role                                              |
| -------------------------- | --------------- | ------------------------------------------------- |
| **pnpm**                   | 9.15.4          | Workspace-aware package manager                   |
| **Turborepo**              | 2.11.11         | Task graph, caching, `build`/`typecheck`/`dev`    |
| **Prettier**               | 3.10.1          | Formatting (with Tailwind class sorting)          |
| **TypeScript compiler**    | 5.9.3           | `tsc --noEmit` typecheck per workspace            |
| **GitHub Actions**         | —               | Dependency audit, gitleaks secret scan, typecheck |
| **Dependabot**             | —               | Weekly npm + Actions updates                      |
| **Supabase CLI**           | via `npx`       | `db:start`, `db:reset`, `db:push`                 |
| **PostCSS + Autoprefixer** | 8.5.6 / 10.4.21 | Tailwind pipeline                                 |

### 4.4 External services

| Service                                     | Purpose                                         | State                                        |
| ------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| **Supabase Cloud** (`jecdhhihbtaocbfzlljt`) | Postgres, Auth, Realtime, RLS                   | Connected and smoke-tested                   |
| **Cloudflare R2**                           | Private credentials, pitch videos, public logos | Placeholder credentials; buckets not created |
| **Stripe**                                  | Credit packs and Priority Pro                   | Placeholder keys and price IDs               |
| **Upstash Redis** (optional)                | Distributed rate limiting                       | Not configured; in-memory fallback           |
| **Google Fonts** (via `next/font`)          | Plus Jakarta Sans + Inter, self-hosted at build | Active                                       |
| **GitHub**                                  | Source, CI, Dependabot                          | Active                                       |

### 4.5 Browser platform APIs used

| API                                         | Used for                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `navigator.mediaDevices.getUserMedia`       | Front camera + microphone for the pitch             |
| `MediaRecorder`                             | WebM VP9/VP8 → MP4 H.264 fallback recording         |
| `fetch` + `Blob`                            | Presigned uploads and streamed certificate bytes    |
| `HTMLCanvasElement`                         | Certificate rendering and burned-in watermark       |
| `pdfjs-dist` worker                         | Multi-page PDF rasterization                        |
| `ResizeObserver` / `IntersectionObserver`   | Reveal animations and layout                        |
| `matchMedia('(prefers-reduced-motion)')`    | Motion freeze                                       |
| `document.visibilitychange` / `window.blur` | Certificate privacy shield                          |
| `navigator.clipboard` (implicit)            | Not used; no copy affordances on protected surfaces |

### 4.6 Notable implementation patterns

- **Server Components by default.** Data reads for dashboards, queues, and detail pages run
  on the server with the caller's cookie session, so RLS applies and no data is shipped
  before authorization.
- **Client Components only where interaction requires it**: forms, verification studio,
  certificate viewer, chat, checkout buttons, motion.
- **One fetch wrapper.** `authFetch()` attaches the Supabase access token; every protected
  route validates it server-side.
- **One input contract.** Zod schemas in `@utn/shared` are imported by both the form and
  the route, so validation cannot drift.
- **Fail closed.** Missing configuration returns `503` rather than degrading silently;
  a failed audit insert blocks certificate delivery.
- **Lazy configuration.** Secrets are read at request time, so `next build` works on a
  machine without production credentials.

---

## 5. Data model

**Location:** `supabase/migrations/0001_initial_schema.sql` … `0005_security_hardening.sql`
**Objects in the repository schema:** 2 enums · 10 tables · 1 view · 23 functions ·
12 triggers · 26 RLS policies · 15 indexes.

> The live cloud project currently has 9 tables because migrations `0004` and `0005` are
> authored but not yet pushed. Everything below describes the repository schema.

### 5.1 Enums

```sql
create type public.user_role as enum ('candidate', 'employer', 'admin');
create type public.verification_status as enum
  ('unverified', 'pending', 'verified', 'rejected');
```

Both are created inside re-runnable `do $$ … exception when duplicate_object` blocks.

### 5.2 Tables

| #   | Table                         | Purpose                           | Key rules                                                                                       |
| --- | ----------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | `profiles`                    | One row per auth user             | `id → auth.users`, unique normalized email, role protected by trigger, employer consent columns |
| 2   | `candidate_profiles`          | Candidate domain data             | Status, rejection reason, `is_featured`, registrar consent + reference                          |
| 3   | `candidate_media`             | Private verification assets       | R2 keys, duration 60–120, OCR text, `submitted_at`; uploads locked while pending/verified       |
| 4   | `companies`                   | One per employer owner            | Unique owner, unique corporate domain, `is_verified`, logo consent                              |
| 5   | `credit_ledger`               | Append-only credit history        | `delta <> 0`; unique `(company_id, reason, reference_id)`                                       |
| 6   | `company_unlocked_candidates` | Paid entitlements                 | PK `(company_id, candidate_id)`                                                                 |
| 7   | `messages`                    | Unlocked direct chat              | Body 1–4,000 chars; unlock enforced by trigger; replica identity full                           |
| 8   | `candidate_profile_views`     | Priority Pro analytics            | One row per employer view                                                                       |
| 9   | `verification_reviews`        | Immutable admin decision trail    | Reviewer email snapshot; decision verified/rejected                                             |
| 10  | `document_access_logs`        | Immutable credential access trail | Append-only trigger; `candidate_id` deliberately has no FK                                      |

**Derived state instead of mutable counters**

```sql
balance = select coalesce(sum(delta), 0) from credit_ledger where company_id = …
```

There is no `credits` column anywhere. That removes the classic lost-update race and makes
every balance explainable from history.

### 5.3 Functions and RPCs (23)

| Function                                       | Kind    | Purpose                                                       |
| ---------------------------------------------- | ------- | ------------------------------------------------------------- |
| `is_blocked_consumer_domain(text)`             | helper  | Blocklist check                                               |
| `is_consumer_email(text)`                      | helper  | Domain extraction + blocklist                                 |
| `is_admin()`                                   | helper  | Security-definer role check                                   |
| `current_user_role()`                          | helper  | Caller's role                                                 |
| `current_company_id()`                         | helper  | Caller's company                                              |
| `is_company_owner(uuid)`                       | helper  | Ownership check                                               |
| `has_unlocked(uuid, uuid)`                     | helper  | Entitlement check for chat                                    |
| `company_credit_balance(uuid)`                 | helper  | Derived balance                                               |
| `get_my_credit_balance()`                      | RPC     | Balance for the signed-in employer                            |
| `unlock_candidate(uuid, uuid)`                 | RPC     | Atomic credit-backed unlock                                   |
| `get_verified_candidates_for_employer(9 args)` | RPC     | Masked discovery + total count                                |
| `set_updated_at()`                             | trigger | Maintains `updated_at`                                        |
| `normalize_profile_email()`                    | trigger | Lowercase/trim                                                |
| `handle_new_user()`                            | trigger | Creates `profiles` from auth metadata; never mints admins     |
| `protect_profile_role()`                       | trigger | Blocks self-promotion                                         |
| `protect_candidate_fields()`                   | trigger | Controls status, `is_featured`, rejection reason              |
| `guard_candidate_media()`                      | trigger | Locks media while pending/verified; key ownership             |
| `sync_candidate_submission()`                  | trigger | Promotes unverified/rejected → pending when both assets exist |
| `validate_company_domain()`                    | trigger | Syntax + consumer-domain + owner-email match                  |
| `protect_company_fields()`                     | trigger | Blocks self-verification and domain/owner changes             |
| `grant_signup_credits()`                       | trigger | Grants exactly 2 trial credits once per company               |
| `enforce_message_unlock()`                     | trigger | Rejects messages without an entitlement                       |
| `prevent_document_access_log_mutation()`       | trigger | Raises on any UPDATE of the audit log                         |

`unlock_candidate` is the money path. It:

1. requires an authenticated caller and resolves the company owner (admins may act);
2. takes `pg_advisory_xact_lock` per company, so concurrent requests serialize;
3. returns early if the pair is already unlocked (idempotent);
4. rejects non-verified candidates and balances below 1;
5. inserts `-1 / candidate_unlock / reference=candidate_id`;
6. inserts the entitlement row;
7. treats a unique violation as "already unlocked" on retry.

### 5.4 Triggers (12)

| Trigger                             | Table                | Effect                                |
| ----------------------------------- | -------------------- | ------------------------------------- |
| `candidate_profiles_updated_at`     | candidate_profiles   | Timestamps edits                      |
| `profiles_normalize_email`          | profiles             | Normalizes email                      |
| `on_auth_user_created`              | auth.users           | Creates the profile row               |
| `profiles_protect_role`             | profiles             | Blocks role changes by non-admins     |
| `candidate_profiles_protect_fields` | candidate_profiles   | Guards verification fields            |
| `candidate_media_guard`             | candidate_media      | Locks uploads during review           |
| `candidate_media_sync_submission`   | candidate_media      | Sets `pending` on complete submission |
| `companies_validate_domain`         | companies            | Corporate-domain enforcement          |
| `companies_protect_fields`          | companies            | Blocks self-verification              |
| `companies_grant_signup_credits`    | companies            | 2 trial credits                       |
| `messages_enforce_unlock`           | messages             | Chat requires an unlock               |
| `document_access_logs_no_update`    | document_access_logs | Append-only enforcement               |

### 5.5 Row Level Security (26 policies)

| Table                         | Policies                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `profiles`                    | select own/admin · insert self with `role <> 'admin'` · update own/admin      |
| `candidate_profiles`          | select own/admin · insert self as candidate · update own/admin                |
| `candidate_media`             | select own/admin · insert self · update own/admin                             |
| `companies`                   | select owner/admin · insert employer self · update owner/admin · delete admin |
| `credit_ledger`               | select owner/admin · insert admin only                                        |
| `company_unlocked_candidates` | select participant/admin · insert admin · delete admin                        |
| `messages`                    | select participant/admin · insert unlocked participant                        |
| `candidate_profile_views`     | select own/admin · insert by caller's company for a verified candidate        |
| `verification_reviews`        | select candidate/admin · insert admin with `reviewer_id = auth.uid()`         |
| `document_access_logs`        | insert own (employer) · select admin; no update/delete policy                 |

The service-role key bypasses RLS by design, but only after `requireApiCaller()` has
verified the caller and role.

### 5.6 Indexes (15)

Discovery and money paths are indexed explicitly:

- `candidate_profiles (verification_status)`
- `candidate_profiles (verification_status, is_featured desc, updated_at desc)` — search
- `candidate_profiles (industry, degree_level, university_name, graduation_year)` — filters
- `candidate_profiles (experience_years)`
- `credit_ledger (company_id, created_at desc)`
- `credit_ledger (company_id, reason, reference_id) where reference_id is not null` — idempotency
- `company_unlocked_candidates (candidate_id)`
- `messages (company_id, candidate_id, created_at)` and `(sender_id)`
- `candidate_profile_views (candidate_id, viewed_at desc)`
- `verification_reviews (candidate_id, created_at desc)` and `(decision, created_at desc)`
- `document_access_logs` by employer, candidate, and event type

### 5.7 Public view

```sql
create or replace view public.company_marquee
with (security_invoker = false) as
select id, company_name, logo_r2_key, created_at
from public.companies
where is_verified = true and display_logo_consent = true
order by created_at asc;
```

This is the only object anonymous visitors read. It exposes no contact, domain, or owner
information.

### 5.8 Migration timeline

| Migration                                   | Adds                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `0001_initial_schema`                       | Enums, 9 core tables, RLS, triggers, RPCs, marquee view                          |
| `0002_verification_reviews`                 | Immutable review trail + indexes                                                 |
| `0003_degree_verification_compliance`       | Registrar consent + verification reference + `chk_registrar_consent`             |
| `0004_employer_certificate_confidentiality` | Employer consent columns + `document_access_logs` + append-only trigger          |
| `0005_security_hardening`                   | Revokes `PUBLIC`/`anon` EXECUTE on RPCs; pins `search_path` on trigger functions |

### 5.9 Seed data (local only)

Seven accounts with fixed UUIDs: one admin, three employers (one with a purchased pack and
an unlock), and three candidates (verified + Priority Pro, pending, rejected). The seed
also inserts a review history, a conversation, and profile-view analytics. Media keys are
placeholders, so playback returns 404 until real objects are uploaded.

---

## 6. Authentication and authorization

### 6.1 Session model

| Layer             | Mechanism                                                          |
| ----------------- | ------------------------------------------------------------------ |
| Browser           | `@supabase/ssr` cookie session; `createBrowserClient`              |
| Server Components | `createServerClient` reading the same cookies; `getUser()`         |
| Middleware        | Refreshes cookies and gates route prefixes                         |
| API routes        | `Authorization: Bearer <access_token>` verified with Supabase Auth |
| Service role      | Server-only client, used after bearer verification                 |

### 6.2 Sign-up, sign-in, callback

- **Sign-up** (`/auth/sign-up`) collects role, full name, password, and — for employers —
  company name. `signUpSchema` excludes `admin` and rejects consumer email domains for
  employers. The client calls `supabase.auth.signUp` with metadata, then
  `POST /api/auth/provision`.
- **Provisioning** (`provisionAccount`) creates the company row from metadata when the
  employer has a corporate domain. It is idempotent and safe to retry.
- **Sign-in** (`/auth/sign-in`) uses password auth and redirects through `safeNextPath`,
  which only permits same-origin relative paths and rejects `/auth/*`.
- **Callback** (`/auth/callback`) exchanges the PKCE code, provisions the account, and
  redirects. Required when email confirmation is enabled in production.

### 6.3 Five authorization layers

1. **Middleware** — unauthenticated users are redirected from `/dashboard`, `/candidate`,
   `/employer`, `/admin`; signed-in users are redirected away from auth pages.
2. **Layout guard** — `(app)/layout.tsx` re-checks the session server-side.
3. **Role guard** — `requireRole()` on each workspace redirects mismatched roles.
4. **API guard** — `requireApiCaller()` verifies the token, role, origin, size, and budget.
5. **Database** — RLS, triggers, and RPC ownership checks.

A bug in any single layer does not grant access.

### 6.4 Admin bootstrap

Admin is intentionally not a public role:

```sql
update public.profiles set role = 'admin' where email = 'real-admin@your-domain.com';
```

Run it with the service role or in the SQL editor. The sign-up schema, the
`protect_profile_role` trigger, and the `profiles_insert_self` policy all block
self-promotion.

---

## 7. Features implemented

### 7.1 Public landing page (`/`)

- Aurora silk-ribbon hero, primary/secondary CTAs, signed-in-aware navbar.
- "For graduates" / "For employers" value cards.
- Four-step how-it-works.
- Trust grid: 60–120 s pitch, private credentials, atomic unlocks, realtime chat.
- "Trusted by" infinite logo marquee from `company_marquee`; six neutral placeholders when
  empty.
- Second aurora panel for the final CTA.
- Server-rendered on every request (`force-dynamic`) so the session state is accurate.

### 7.2 Candidate profile (`/candidate/profile`)

- Required: full name, university, degree level, graduation year, experience.
- Optional: headline (140 chars), industry, phone.
- Priority Pro card (upgrade or active state).
- Validation mirrors `candidateProfileSchema` on the server.

### 7.3 Verification studio (`/candidate/verification`)

A client component built on `getUserMedia` + `MediaRecorder`.

**Certificate step**

- Accepts PDF/JPEG/PNG up to 10 MB; MIME is normalized from the file extension when the
  browser reports an empty type.
- Requests a presigned PUT, uploads directly to R2 with the signed content type, then calls
  the OCR endpoint with the fresh key.
- Shows extracted text and confidence, or a "manual review" message for PDFs and unreadable
  images.
- The OCR endpoint refuses keys that do not belong to the caller and re-checks the bytes.

**Pitch step**

- Camera + microphone only; no gallery upload.
- 1280×720, 30 fps, 1.2 Mbps, front-facing.
- Picks the first supported MIME type: WebM VP9 → WebM VP8 → WebM → MP4 H.264.
- Live timer, teleprompter cues (intro 0–20 s, evidence 20–45 s, target 45–120 s),
  automatic stop at 120 s.
- Submit stays disabled below 60 s; preview and discard before submission.

**Submission step**

- Presigns and uploads the video blob.
- Calls `/api/verification/finalize` with exact sizes, types, duration, verification
  reference, and registrar consent.
- On success the studio is replaced by a locked summary with profile, media status, review
  history, and rejection reason.

### 7.4 OCR (`POST /api/verification/ocr`)

- Candidate-only, 6 requests per 5 minutes per user, plus a per-instance concurrency cap
  of 2 (Tesseract spawns a WASM worker per request).
- Accepts a freshly uploaded key or falls back to the stored certificate.
- Confirms the object exists with `HEAD`, skips PDFs with an explicit message, downloads
  raster images server-side, and verifies magic bytes before OCR.
- Tesseract worker caches `eng.traineddata` in `os.tmpdir()/utn-tesseract-cache`.
- Text is cleaned (line endings, trailing spaces, blank runs) and capped at 20,000
  characters; the draft is upserted into `candidate_media`.
- Failures return `502` with a "you can still submit for manual review" message.

### 7.5 Finalize (`POST /api/verification/finalize`)

Re-validates everything before submission:

1. Caller is a candidate with a profile.
2. Status is not `pending` or `verified`.
3. Certificate key is under `private-credentials/<caller-uuid>/`.
4. Video key is under `pitch-videos/<caller-uuid>/`.
5. Both objects exist in R2.
6. Object sizes exactly match the submitted sizes.
7. Object content types match the submitted types (parameters stripped).
8. Registrar consent and verification reference are persisted **before** the media upsert
   (the media trigger promotes to `pending`, and `chk_registrar_consent` requires consent
   to already be true).
9. Status is read back and returned.

This stops a client from claiming an upload succeeded when the object is missing, empty,
wrong type, or owned by someone else.

### 7.6 Admin review

**Queue** (`/admin/verification`)

- Lists pending candidates with profile summary and submission time.
- Shows counts and recent decisions.

**Detail** (`/admin/verification/[candidateId]`)

- Profile claims beside the document.
- OCR text and confidence.
- Certificate link (5-minute presign) and pitch link (10-minute presign).
- Approve / request-changes panel; rejection reason required, ≤ 1,000 characters.
- Review history.
- Decision API writes the audit row first, then updates the profile; if the update fails it
  deletes the just-inserted audit row and returns an error.

### 7.7 Discovery and search (`/employer/candidates`)

- Calls `get_verified_candidates_for_employer` with search, industry, degree level,
  university, graduation year, max experience, Priority Pro filter, page.
- Page size 24, maximum 60; server-side pagination.
- Pre-unlock cards show masked name, headline, degree, university, graduation year,
  experience, Priority Pro badge, and pitch duration.
- Pitch playback is free: a presigned GET is issued after verifying the caller is an
  employer and the candidate is verified.
- Unlock button spends a credit and updates the card and balance.

### 7.8 Unlock (`POST /api/employer/unlock`)

- Employer-only; the requested company must belong to the caller.
- Calls the `unlock_candidate` RPC with the **user's** JWT, so the database sees the real
  caller (the service-role client is not used for the RPC itself).
- Returns `success`, `alreadyUnlocked`, `creditBalance`, and a machine-readable message.
- `429` budget: 30 unlocks per minute per user.

### 7.9 Confidential certificate viewer

This is the most security-sensitive UI in the product.

**Server side (`GET /api/employer/certificates/[candidateId]/stream`)**

- Employer role only; candidate id must be a UUID.
- Requires `profiles.employer_tos_accepted_at` (versioned click-through consent).
- Requires a `company_unlocked_candidates` row for the caller's company.
- Reads the private object server-side; no presigned URL, redirect, or public link exists.
- Writes a `certificate_viewed` audit row **before** returning bytes; if the audit write
  fails, the request fails (`500 audit_failed`).
- Verifies magic bytes; only PDF/JPEG/PNG are served.
- Sends `no-store`, `no-cache`, `Pragma`, `Expires: 0`, `nosniff`, `DENY`,
  `no-referrer`, `same-origin`.
- `?format=base64` returns the same audited bytes as JSON for API compatibility with the
  former native client; no URL is returned either way.

**Client side (`secure-certificate-viewer.tsx`)**

- Fetches the stream with `authFetch`, renders PDFs with pdf.js or images onto an
  `<canvas>`. No `<img src>`, blob URL, or download link exists in the DOM.
- Burns a diagonal watermark into canvas pixels and mirrors it as an SVG overlay:
  employer name, email, short id, UTC timestamp, refreshed every 60 seconds.
- Click-through clause on first open; warning modal on every open; one-hour
  re-acknowledgment checked every 10 seconds (`hourly_reack_completed` logged).
- Window blur / tab hidden covers the canvas with a privacy shield and logs
  `focus_loss_blur`.
- `PrintScreen`, `Ctrl/Cmd+P`, `Ctrl/Cmd+S`, `Ctrl/Cmd+Shift+I` blank the canvas, show a
  warning, and log `print_or_devtools_attempt`.
- Right-click, selection, and drag are suppressed; `@media print` hides the viewer.
- Screen capture cannot be blocked by a browser, so the control set is deterrence:
  watermark + consent + append-only audit.

### 7.10 Realtime chat

- `ChatThread` loads messages for a `(company_id, candidate_id)` pair.
- Subscribes to `postgres_changes` INSERT events filtered by `company_id`, then ignores
  rows for other candidates.
- Inserts through the browser Supabase client, so RLS and `enforce_message_unlock` apply.
- Deduplicates the sender's own insert against the realtime event.
- Auto-scrolls; shows sender-side and receiver-side bubble styles.
- Candidate inbox lists companies that unlocked them; opening a thread without an unlock
  shows a locked state.

### 7.11 Billing and Priority Pro

- `/employer/billing` shows the derived balance, three packs, and success/cancel states.
- `CheckoutButton` calls `/api/stripe/checkout` and redirects to Stripe.
- Priority Pro card on the candidate profile does the same with `kind=candidate_pro`.
- The webhook grants credits or sets `is_featured`; both are idempotent.
- No customer portal, refunds, or invoices yet.

### 7.12 Dashboards

| Role      | Content                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------- |
| Candidate | Welcome, verification checklist, status badge, rejection alert, latest review, Priority Pro view count, quick links |
| Employer  | Company summary, credit balance, discovery entry point, candidate grid                                              |
| Admin     | Pending count, recent decisions, review queue entry point                                                           |

### 7.13 Legal page

`/legal/employer-confidentiality` renders the full clause from
`packages/shared/src/security/certificate-confidentiality.ts`, so the copy in the modal,
the viewer gate, and the public page cannot drift. Version `v1.0` is stored on acceptance.

---

## 8. API reference

All routes use `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Every route except
the Stripe webhook starts with `requireApiCaller()`.

| #   | Method | Route                                             | Auth             | Budget                  | Purpose                             |
| --- | ------ | ------------------------------------------------- | ---------------- | ----------------------- | ----------------------------------- |
| 1   | POST   | `/api/auth/provision`                             | Bearer           | 10/min                  | Idempotent post-signup provisioning |
| 2   | POST   | `/api/storage/presign`                            | Bearer           | 60/min                  | Upload/download presigned URLs      |
| 3   | POST   | `/api/verification/ocr`                           | Bearer candidate | 6/5 min + concurrency 2 | OCR a certificate                   |
| 4   | POST   | `/api/verification/finalize`                      | Bearer candidate | 8/5 min                 | Validate uploads and submit         |
| 5   | POST   | `/api/admin/verification`                         | Bearer admin     | 60/min                  | Record a decision + audit row       |
| 6   | POST   | `/api/employer/unlock`                            | Bearer employer  | 30/min                  | Spend a credit atomically           |
| 7   | GET    | `/api/employer/certificates/[candidateId]/stream` | Bearer employer  | 60/min                  | Audited certificate bytes           |
| 8   | POST   | `/api/employer/certificates/security-event`       | Bearer employer  | 30/min                  | Consent + anti-capture telemetry    |
| 9   | POST   | `/api/stripe/checkout`                            | Bearer           | 10/min                  | Create a Checkout session           |
| 10  | POST   | `/api/webhooks/stripe`                            | Stripe signature | 600/min + 512 KiB       | Grant credits / Priority Pro        |

**Pre-auth budget:** 300 requests/minute per IP on every API route.

**Error shape**

```json
{ "error": "machine_code", "message": "Human-readable message.", "details": [] }
```

| Status | Meaning                                                   |
| ------ | --------------------------------------------------------- |
| 400    | Invalid JSON, malformed key, incomplete upload            |
| 401    | Missing/invalid token                                     |
| 403    | Wrong role, missing company/profile, locked, cross-origin |
| 404    | Candidate/pack not found                                  |
| 405    | Wrong method                                              |
| 409    | Media locked / not pending / already verified             |
| 413    | Body too large                                            |
| 415    | Unsupported document type                                 |
| 422    | Schema validation failed                                  |
| 429    | Rate limited / OCR busy                                   |
| 500    | Unexpected server failure                                 |
| 502    | OCR upstream failure                                      |
| 503    | Supabase/R2/Stripe not configured                         |

---

## 9. Storage and media pipeline

### 9.1 Buckets

| Bucket                | Contents            | Access                                                              |
| --------------------- | ------------------- | ------------------------------------------------------------------- |
| `private-credentials` | Degree certificates | Private; presign for owner/admin only; employers via audited stream |
| `pitch-videos`        | 60–120 s pitches    | Private; presigned GET for verified candidates, owner, admin        |
| `company-logos`       | Company logos       | Optional public domain; no SVG                                      |

### 9.2 Key construction

```
private-credentials/<candidate-uuid>/<random-uuid>.pdf
pitch-videos/<candidate-uuid>/<random-uuid>.webm
company-logos/<company-uuid>/<random-uuid>.png
```

- Owner ids must be UUIDs; the server derives the owner from the session.
- Keys are unguessable, ownership-prefixed, and reject `..` or leading `/`.
- Upload keys are never accepted from the browser.

### 9.3 Presigning rules

| Rule                                           | Effect                                       |
| ---------------------------------------------- | -------------------------------------------- |
| `Content-Type` and `Content-Length` are signed | The browser cannot swap type or inflate size |
| Upload TTL 10 minutes                          | Short-lived capability                       |
| Certificate GET TTL 5 minutes                  | Short-lived; employers cannot get one at all |
| Pitch GET TTL 10 minutes                       | Enough to stream a 120 s clip                |
| Path-style addressing, `region: auto`          | R2 compatibility                             |
| CRC32 checksums `WHEN_REQUIRED`                | Prevents invalidated browser PUTs            |

### 9.4 Download authorization matrix

| Caller            | Pitch video            | Certificate                         | Logo            |
| ----------------- | ---------------------- | ----------------------------------- | --------------- |
| Admin             | Any                    | Any                                 | Any             |
| Candidate (owner) | Own                    | Own                                 | —               |
| Employer          | Any verified candidate | **Never** (`403 use_secure_viewer`) | —               |
| Anonymous         | —                      | —                                   | Public URL only |

### 9.5 Retention and lifecycle

- No automatic deletion of orphaned uploads yet; add R2 lifecycle rules.
- `document_access_logs` is append-only and intentionally survives candidate deletion
  (`candidate_id` has no FK). Employer deletion cascades from `auth.users`.
- `verification_reviews` keeps reviewer email snapshots so history survives reviewer
  deletion.

---

## 10. Security program

### 10.1 Threat model → control → residual risk

| Threat                            | Controls                                                                                                                                     | Residual                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Credential stuffing / brute force | Supabase Auth, per-IP 300/min, per-route budgets, generic errors                                                                             | No CAPTCHA or MFA gate yet                              |
| Cross-site request forgery        | Bearer tokens (no ambient auth) + Origin/host check on state-changing requests                                                               | Non-browser clients may omit Origin (allowed by design) |
| XSS                               | React escaping, CSP (`object-src 'none'`, `base-uri 'self'`), no `dangerouslySetInnerHTML` except the motion bootstrap, SVG uploads rejected | `'unsafe-inline'` in `script-src` (Next.js bootstrap)   |
| Malicious upload                  | Magic-byte sniffing before OCR/render, MIME allowlist, size caps, ownership-prefixed keys, signed content type/length                        | No antivirus scan                                       |
| IDOR / data scraping              | RLS, server-side masking, RPC-only discovery, per-user rate limits                                                                           | A verified employer can still view what they unlocked   |
| Credit theft / double spend       | Advisory lock, derived balance, unique ledger reference, idempotent retries                                                                  | —                                                       |
| Payment forgery                   | Stripe signature over raw body, server-side price IDs, metadata checks                                                                       | —                                                       |
| Document exfiltration             | No presigned employer certificate URL, canvas-only render, watermark, consent, append-only audit, `no-store`                                 | Browser screen capture is unblockable                   |
| Privilege escalation              | Sign-up excludes admin, role trigger, RLS insert policy, service role server-only                                                            | Role changes are SQL-only and unlogged                  |
| Secret leakage                    | Server-only env access, static public references, gitleaks in CI, service-role key absent from bundles                                       | `.env.local` on disk                                    |
| Dependency compromise             | `pnpm audit` in CI (blocks critical), Dependabot weekly, lockfile committed                                                                  | 10 known high advisories (build-time PostCSS, Zod 3)    |
| Denial of service                 | Per-IP and per-user budgets, 64 KiB body cap, OCR concurrency cap, webhook cap                                                               | No WAF/CDN rate limit in front                          |
| Log injection / PII leakage       | Structured JSON events, field redaction, truncated UA/IP                                                                                     | No central log drain configured                         |

### 10.2 Controls inventory

**Application**

- `requireApiCaller()` is the single chokepoint: origin, body size, IP budget, token,
  user budget, profile lookup.
- Zod validation on every request body and every shared form.
- Role checks before any service-role query.
- `safeNextPath` for redirects.
- Generic auth errors; detailed errors only where actionable.

**Database**

- RLS on all 10 tables; service role bypass only after application authorization.
- Security-definer helpers with pinned `search_path` (migration `0005`).
- `PUBLIC`/`anon` EXECUTE revoked on RPCs and trigger functions.
- Append-only triggers on both audit tables.
- Check constraints for duration, body length, ledger delta, consent, and TOS version.

**Transport and browser**

- CSP: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev),
  `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self' checkout.stripe.com`,
  `upgrade-insecure-requests` in production.
- HSTS (production), `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy,
  Permissions-Policy (camera/mic self only), COOP, CORP, `X-Permitted-Cross-Domain-Policies`.
- `poweredByHeader: false`.
- Certificate responses add `no-store` and `no-referrer`.

**Operations**

- GitHub Actions: `pnpm audit --prod --audit-level critical` blocks; high is reported;
  gitleaks scans history; typecheck runs.
- Dependabot: weekly npm and Actions PRs.
- `SECURITY.md`: external configuration checklist, key rotation, incident response,
  GDPR erasure notes.

### 10.3 Rate limits

| Policy              | Limit | Window | Key           |
| ------------------- | ----- | ------ | ------------- |
| `apiByIp`           | 300   | 60 s   | IP (pre-auth) |
| `apiDefault`        | 120   | 60 s   | user          |
| `authProvision`     | 10    | 60 s   | user          |
| `ocr`               | 6     | 300 s  | user          |
| `finalize`          | 8     | 300 s  | user          |
| `presign`           | 60    | 60 s   | user          |
| `unlock`            | 30    | 60 s   | user          |
| `checkout`          | 10    | 60 s   | user          |
| `adminDecision`     | 60    | 60 s   | user          |
| `certificateStream` | 60    | 60 s   | user          |
| `certificateEvent`  | 30    | 60 s   | user          |
| `webhook`           | 600   | 60 s   | IP            |

Backends: Upstash Redis REST when `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set (INCR/PTTL
pipeline); otherwise an in-process map with pruning at 20,000 keys. If Redis is configured
but unreachable, the limiter logs and falls back rather than failing the API.

### 10.4 Auditing and observability

- `securityLog()` writes one JSON line per event with a redaction backstop for
  authorization, cookie, password, secret, and token fields.
- Events include: `api_cross_origin_blocked`, `api_payload_too_large`,
  `api_ip_rate_limited`, `api_user_rate_limited`, `api_invalid_token`,
  `stripe_webhook_rate_limited`.
- `document_access_logs` records employer consent, certificate views, hourly
  re-acknowledgment, focus loss, screenshot attempts, and print/devtools attempts with IP,
  user agent, and watermark signature.
- No metrics, tracing, error reporting, or log drain is wired up yet.

### 10.5 Secrets and environment

- `NEXT_PUBLIC_*` values are referenced statically so Next.js can inline them.
- Server secrets are read through `read()` at request time and never bundled.
- The service-role key was scanned out of `.next/static` (no match).
- `.env.example` documents every variable with no real values.
- Live values live in `apps/web/.env.local` (untracked).

### 10.6 Residual risks

1. `mailer_autoconfirm = true` in the live project — anyone can create an unconfirmed
   account. Turn off before production.
2. No MFA gate on `/admin`; a stolen admin password is enough.
3. Per-instance rate limiting without Upstash.
4. Inline-script CSP until routes can use nonces.
5. No automated tests for RLS/RPC/API behavior.
6. No malware scanning on uploaded documents.
7. Placeholder admin email and placeholder Stripe/R2 credentials.
8. Browser screen capture cannot be blocked; the watermark and audit trail are the
   deterrent.
9. Admin actions (role changes, company verification, credit adjustments) are SQL-only and
   not audited.
10. Supabase PAT was pasted into an earlier session and should be revoked.

---

## 11. UI and design system

### 11.1 Principles

**Midnight Emerald** — modern luxury that is easy on the eyes. A deep emerald-ink canvas,
dark glass cards, warm ivory type, champagne hairlines, and jewel accents (emerald,
sapphire, amethyst, teal, rose, gold) that read like light passing through cut stone.
Generous whitespace, a tight typographic hierarchy, and slow motion that suggests quality
rather than demanding attention.

The direction replaced the earlier light "Jewel Atelier" palette. It is applied
platform-wide: landing page, auth, every candidate/employer/admin workspace, and the 404
and error screens. There is deliberately no white surface left; the only light tone is a
warm ivory "paper" reserved for document and certificate previews, where a real page is
the correct metaphor.

### 11.2 Palette and type

| Token                   | Value     | Use                                            |
| ----------------------- | --------- | ---------------------------------------------- |
| `brand.navy`            | `#04100C` | Emerald ink: heroes, dark fills, ink on gold    |
| `brand.navy-soft`       | `#081A14` | Secondary dark surface                         |
| `brand.navy-line`       | `#173B31` | Hairlines on dark                              |
| `surface.canvas`        | `#06120F` | Page background                                |
| `surface.card`          | `#0A1C17` | Cards and panels                               |
| `surface.muted`         | `#0C231C` | Inset wells and secondary fills                |
| `surface.elevated`      | `#0F2A22` | Raised surfaces                                |
| `surface.paper`         | `#F2ECDF` | Document/certificate stock (only light surface) |
| `accent.emerald`        | `#10B981` | Bright accent                                  |
| `accent.emerald-hover`  | `#34D399` | Small emerald text on dark and soft chips      |
| `accent.emerald-deep`   | `#0B7A57` | Solid fill behind white text                   |
| `accent.gold`           | `#C8A45D` | Eyebrows, hairlines, Priority Pro              |
| `accent.gold-hover`     | `#E9CF96` | Small champagne text on dark                   |
| `accent.sapphire`       | `#3B5BFF` | Employer/indigo accents                        |
| `accent.sapphire-ink`   | `#8FA3FF` | Sapphire badge text on `sapphire-soft`         |
| `accent.amethyst`       | `#8B5CF6` | Premium/amethyst accents                       |
| `accent.amethyst-ink`   | `#C4B5FD` | Amethyst badge text on `amethyst-soft`         |
| `accent.teal`           | `#0FB5BA` | Data and secondary jewel accent                |
| `accent.rose`           | `#E2557B` | Rejection and destructive accents              |
| `ink.primary`           | `#EDE6D6` | Body text (warm ivory)                         |
| `ink.muted`             | `#9DB2A8` | Secondary text (sage)                          |
| `ink.inverse`           | `#04100C` | Text on paper and gold                         |
| `line`                  | `#1B3A30` | Hairline border                                |
| `danger`                | `#F87171` | Errors (4.5:1 on rose-soft)                    |
| `danger-deep`           | `#B91C1C` | Destructive fill behind white text             |
| `warning`               | `#FBBF24` | Warnings (4.5:1 on `warning-soft`)             |
| `warning-soft`          | `#2A1F0B` | Warning chip background                        |

- Headings: **Plus Jakarta Sans** (600/700/800).
- Body: **Inter** (400/500/600).
- Both load through `next/font` and are self-hosted at build time.
- Text-safe variants (`emerald-hover`, `gold-hover`, `sapphire-ink`, `amethyst-ink`) exist
  because a hue cannot be both a bright accent on a near-black canvas and a fill behind
  white text; `*-deep` tokens carry solid fills. `color-scheme: dark` makes native selects,
  pickers, and scrollbars match the canvas.

`packages/shared/design-tokens.cjs` still holds the legacy slate palette and the shared
card radius. The web app defines its own explicit palette in
`apps/web/tailwind.config.ts` so a shared token change cannot silently recolour the
product; it consumes only the radius token.

### 11.3 Aurora / midnight silk

- Seven heavily blurred gradient ribbons (emerald, indigo, cyan, jade, amethyst, gold,
  pearl) drifting over the emerald-ink sky, each on its own sway cycle so the layers never
  visibly repeat.
- A slow conic sheen (`.aurora-sheen`, 72 s) turns beneath the ribbons, and a warm pearl
  horizon (`.aurora-horizon`, 22 s breathe) anchors the bottom edge, so the light field
  reads as depth rather than a flat tint.
- Eight hairline SVG silk filaments (`.aurora-threads`) are drawn above the ribbons.
- Composed with the engraved contour field (`TopographicField`), security grain, and a
  deep vignette.
- Implemented as `.aurora-*` classes in `globals.css` plus
  `components/ui/AuroraRibbons.tsx`; no images, no canvas, no client JavaScript.
- `TopographicHeroBg` layers the contour print under the aurora, so every dark banner
  inherits it without per-page edits.
- Landing hero and auth aside use `hero` intensity; in-app banners use `ambient`.
- Workspace pages carry a masked `.aurora-wash` behind the content, so the silk signature
  is present on every screen rather than only on marketing pages.
- `prefers-reduced-motion` freezes the ribbon drift, sheen, and horizon at resting
  opacity; below 640 px the four smallest ribbons (d–g) are hidden and blur is reduced.

### 11.4 Components

| Group       | Components                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Primitives  | `Button` (primary/secondary/ghost/danger/emerald/gold), `Input`, `Textarea`, `Select`, `Field`, `Card`, `Badge` (8 tones), `Alert`          |
| Surfaces    | `SpotlightGlassCard` (cursor spotlight), `surface-card`, jewel-border and hairline utilities                                                |
| Backgrounds | `AuroraRibbons`, `TopographicField`, `TopographicHeroBg`, `aurora-wash`                                                                     |
| Motion      | `Reveal`, `GradCap`, `CountUp` (all respect reduced motion)                                                                                 |
| Brand       | `BrandMark`, `Navbar`, `AppShell`, `SignOutButton`, `RoleBadge`                                                                             |
| Feature     | Verification studio, secure certificate viewer, pitch player, chat thread, candidate card, checkout button, Priority Pro card, logo marquee |
| Route state | `not-found.tsx` (404), `error.tsx` (segment boundary), `global-error.tsx` (root boundary)                                                   |

### 11.5 Responsive behavior

- Mobile-first Tailwind; primary breakpoints at `sm` (640), `md` (768), `lg` (1024).
- The nav collapses into a menu below `lg`.
- Tables and grids collapse to single-column cards.
- The verification studio and certificate viewer are usable on phone browsers.
- Pitch recording uses the browser camera; no native app is required.

### 11.6 Accessibility

- Lighthouse accessibility **100** on every audited route: `/`, `/auth/sign-in`,
  `/auth/sign-up`, `/legal/employer-confidentiality`, `/dashboard`, `/candidate/profile`,
  `/candidate/verification`, `/candidate/messages`, `/employer/company`,
  `/employer/candidates`, `/employer/billing`, `/admin/verification`,
  `/admin/verification/[candidateId]`, plus the 404 and error screens.
- Contrast audited and tuned on 16 routes across all three roles with a rendered-colour
  audit that composites alpha layers, gradient stops, and the emerald canvas: **0 failures**
  at WCAG AA (4.5:1 body, 3:1 large).
- Dark-only palette means no bright surface can wash out type: text-safe accent variants
  (`emerald-hover`, `gold-hover`, `sapphire-ink`, `amethyst-ink`), solid `*-deep` fills
  behind white text, `warning-soft`/rose-soft chips for warning and danger, and warm ivory
  `ink.primary` on every canvas.
- `color-scheme: dark` makes native selects, date pickers, and scrollbars match the canvas
  instead of flashing white.
- Skip link to `#main`.
- Visible `:focus-visible` outline (emerald, 2 px offset).
- Labels and `aria-invalid` on form fields; `role="radiogroup"` for role selection; every
  talent-search filter is `htmlFor`/`id` bound.
- `aria-hidden` on decorative visuals.
- Reduced-motion support for every animation, including the ribbons, sheen, and horizon.
- Semantic headings and `text-wrap: balance` on titles.
- No horizontal overflow at 1296 px or mobile widths on any audited route.

### 11.7 Route failure states

Route failures stay inside the design system instead of falling back to framework screens:

| File                   | Trigger                         | Behavior                                                                                                     |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `app/not-found.tsx`    | Unmatched URL                   | Emerald aurora 404, champagne headline, gold "Back to home", signposts, `noindex`                            |
| `app/error.tsx`        | Error in a route segment        | Client boundary with "Try again" (`reset()`), optional error digest, branded tab title                       |
| `app/global-error.tsx` | Error in the root layout itself | Inline-styled last resort; renders its own `<html>`/`<body>` so the palette survives even without global CSS |

All three reuse the emerald-ink + aurora + champagne language, and the 404/error screens
were audited at accessibility 100 with no overflow.

---

## 12. Configuration

### 12.1 Environment variables

**App**

| Variable              | Scope  | Purpose                         |
| --------------------- | ------ | ------------------------------- |
| `NEXT_PUBLIC_APP_URL` | public | Metadata base, Stripe redirects |

**Supabase**

| Variable                        | Scope  | Purpose                       |
| ------------------------------- | ------ | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | public | Project URL                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | RLS-scoped client key         |
| `SUPABASE_SERVICE_ROLE_KEY`     | server | Trusted operations after auth |

**Abuse protection**

| Variable                   | Scope  | Purpose                                         |
| -------------------------- | ------ | ----------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | server | Distributed limiter                             |
| `UPSTASH_REDIS_REST_TOKEN` | server | Distributed limiter                             |
| `SECURITY_ALLOWED_ORIGINS` | server | Extra allowed browser origins (comma-separated) |

**Cloudflare R2**

| Variable                          | Default                                      | Purpose                      |
| --------------------------------- | -------------------------------------------- | ---------------------------- |
| `R2_ACCOUNT_ID`                   | —                                            | Endpoint + signing           |
| `R2_ACCESS_KEY_ID`                | —                                            | Signing                      |
| `R2_SECRET_ACCESS_KEY`            | —                                            | Signing                      |
| `R2_ENDPOINT`                     | `https://<account>.r2.cloudflarestorage.com` | Override                     |
| `R2_BUCKET_PRIVATE_CREDENTIALS`   | `private-credentials`                        | Bucket name                  |
| `R2_BUCKET_PITCH_VIDEOS`          | `pitch-videos`                               | Bucket name                  |
| `R2_BUCKET_COMPANY_LOGOS`         | `company-logos`                              | Bucket name                  |
| `R2_PUBLIC_LOGOS_BASE_URL`        | —                                            | Public domain for logos only |
| `R2_PRESIGN_UPLOAD_TTL_SECONDS`   | 600                                          | Upload TTL                   |
| `R2_PRESIGN_DOWNLOAD_TTL_SECONDS` | 300                                          | Default GET TTL              |

**Stripe**

| Variable                                 | Purpose                |
| ---------------------------------------- | ---------------------- |
| `STRIPE_SECRET_KEY`                      | Server API             |
| `STRIPE_WEBHOOK_SECRET`                  | Signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`     | Client (reserved)      |
| `STRIPE_PRICE_CREDITS_5` / `_15` / `_30` | Credit pack prices     |
| `STRIPE_PRICE_CANDIDATE_PRO`             | Priority Pro price     |

### 12.2 Degraded modes

| Missing configuration | Behavior                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Supabase public keys  | App renders, API returns `503 supabase_not_configured`, workspaces show a configuration alert |
| Service role key      | Same as above; no trusted operations                                                          |
| R2 credentials        | Uploads, OCR, playback, streaming return `503 storage_not_configured`                         |
| Stripe keys/prices    | Checkout returns `503`; the rest of the product works                                         |
| Upstash               | In-memory rate limiting (per instance)                                                        |
| Public logo base URL  | Logos stay private; marquee shows placeholders                                                |

---

## 13. Build, run, and operations

### 13.1 Scripts

| Command                        | Action                                       |
| ------------------------------ | -------------------------------------------- |
| `pnpm dev`                     | All workspace dev tasks                      |
| `pnpm dev:web`                 | Next.js dev server on `:3000` (Turbopack)    |
| `pnpm build`                   | Turbo production build                       |
| `pnpm typecheck`               | TypeScript across shared, storage, web       |
| `pnpm format` / `format:check` | Prettier                                     |
| `pnpm clean`                   | Remove artifacts and `node_modules`          |
| `pnpm db:start` / `db:stop`    | Local Supabase stack (Docker required)       |
| `pnpm db:reset`                | Re-apply migrations + seed                   |
| `pnpm db:push`                 | Push migrations to the linked project        |
| `postinstall`                  | Copies the pdf.js worker into `public/pdfjs` |

### 13.2 Local development

```bash
pnpm install
cp .env.example apps/web/.env.local   # fill Supabase, R2, Stripe
pnpm typecheck
pnpm dev:web                          # http://localhost:3000
```

The Supabase CLI is optional; the app runs against the cloud project when the env file
points at it.

### 13.3 CI

`.github/workflows/security.yml` runs on push, PR, and weekly:

1. `pnpm install --frozen-lockfile`
2. `pnpm audit --prod --audit-level critical` (blocking)
3. `pnpm audit --prod --audit-level high` (non-blocking report)
4. gitleaks secret scan (full history)
5. `pnpm typecheck`

Dependabot opens weekly npm and Actions updates.

### 13.4 Production checklist

1. Turn off email autoconfirm; configure SMTP; verify the callback URL.
2. Enable leaked-password protection, CAPTCHA, and TOTP MFA for admins.
3. Push migrations `0004` and `0005` (`pnpm db:push`).
4. Set `UPSTASH_REDIS_REST_URL`/`_TOKEN` so limits are global.
5. Create the three R2 buckets and an Object Read & Write token; apply CORS for the
   production origin; optionally attach a public domain to `company-logos`.
6. Create the four Stripe prices; register the webhook for
   `checkout.session.completed`; set the signing secret.
7. Replace the placeholder admin email and promote a real account.
8. Revoke any leaked Supabase personal access token.
9. Put a WAF/CDN in front (Cloudflare) with managed rules and bot protection.
10. Configure log drain/alerting for `level:"security"` events.
11. Enable PITR/backups and test a restore.
12. Run a penetration test and an accessibility audit.

### 13.5 Backup, DR, and incident response

- Supabase provides daily backups on paid plans; PITR must be enabled explicitly.
- R2 versioning/lifecycle rules should be enabled per bucket.
- `SECURITY.md` defines the incident flow: contain (revoke keys, disable accounts),
  assess (audit tables, logs), notify (candidates/employers, regulator within 72 h under
  GDPR), remediate, and record.
- Account deletion: profile cascade removes domain rows; audit logs survive by design.

---

## 14. Verification status

| Check                                                        | Result                                      |
| ------------------------------------------------------------ | ------------------------------------------- |
| `pnpm typecheck` (shared, storage, web)                      | Pass                                        |
| `pnpm build` (Next.js production)                            | Pass                                        |
| Landing page and sign-in HTTP 200                            | Pass                                        |
| Browser sign-up against live Supabase                        | Pass                                        |
| Profile trigger on signup                                    | Pass                                        |
| Employer provisioning + company + 2 trial credits            | Pass                                        |
| Admin promotion via service role                             | Pass                                        |
| Service-role key absent from client bundle                   | Pass                                        |
| Security headers (CSP, HSTS, nosniff, DENY, Referrer-Policy) | Present                                     |
| Cross-origin POST                                            | `403 cross_origin_blocked`                  |
| Same-origin POST without token                               | `401 missing_token`                         |
| 310 rapid requests                                           | `429 rate_limited` + `Retry-After`          |
| 70 KB JSON body                                              | `413 payload_too_large`                     |
| Unauthenticated `/dashboard`                                 | `307` to sign-in                            |
| Aurora rendering (landing, auth, workspace)                  | 7 ribbons + sheen + horizon, no console errors |
| Hero contrast                                                | Mean RGB ≈ (35, 67, 64), luminance p50 ≈ 49 |
| PGlite behavioral suite (earlier phase)                      | 41/41 checks                                |
| tesseract.js OCR smoke test                                  | 95% confidence                              |

**Midnight Emerald and three-workspace smoke test (2026-11-18)**

| Check                                                                                      | Result                                              |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Lighthouse accessibility, 16 audited routes + 404                                           | **100** everywhere                                  |
| Lighthouse best-practices and SEO (audited routes)                                         | **100**                                             |
| Rendered-colour contrast failures (16 routes, all three roles)                              | 0                                                   |
| Bright surfaces (luma > 0.7, > 4000 px²) across 5 routes                                    | 0; body always `rgb(6,18,15)`                       |
| Aurora live render                                                                          | 7 ribbons ×2 instances, 16 filaments, sheen + horizon |
| Reduced-motion freeze for ribbons, sheen, and horizon                                       | Present in built CSS                                |
| Horizontal overflow at 1296 px and mobile widths                                           | 0 on every audited route                            |
| Unauthenticated protected routes (`/dashboard`, `/candidate/*`, `/employer/*`, `/admin/*`) | `307` → `/auth/sign-in?next=…`                      |
| API routes without a token                                                                 | `401 {"error":"missing_token"}`                     |
| Stripe webhook without a signature                                                         | `400 {"error":"missing_signature"}`                 |
| Employer talent-search filter GET                                                          | Works; all 7 controls labelled; empty state renders |
| Employer company save                                                                      | `PATCH` → `204`, success copy shown                 |
| Billing checkout with placeholder keys                                                     | Fails gracefully ("Checkout failed") + `500`        |
| Branded 404 (`/does-not-exist`)                                                            | `404`, aurora + gold CTA, a11y 100                  |
| Branded error boundary (temporary throwing route, since removed)                           | `500`, "Try again" + digest, a11y 100               |
| Browser console errors on audited app routes                                               | None (the 404 logs only its expected document 404)  |

**Not verified in this environment**

- Real R2 upload/download/OCR/finalize end to end.
- Real Stripe Checkout and webhook delivery.
- Camera recording on a physical device.
- Local Supabase stack (`pnpm db:reset`) — Docker/CLI unavailable here.
- Migrations `0004`/`0005` against the live project (authored, not pushed).
- `global-error.tsx` under a real root-layout crash (it ships in the client chunk and
  typechecks; it cannot be triggered without breaking the layout).

---

## 15. Gaps and roadmap

### 15.1 Blocking a full demo

1. **Cloudflare R2** — buckets, token, CORS, optional public logo domain.
2. **Stripe** — four prices, webhook endpoint, signing secret.

### 15.2 Product gaps

- No transactional email (approval, rejection, unlock, new message).
- No candidate unlock notification or notification center.
- No saved searches, shortlists, or employer notes.
- No candidate-initiated interest; chat is employer-initiated after unlock.
- Priority Pro analytics is a total view count only.
- No company logo upload UI (API support exists).
- No admin UI for company verification, credits, users, or role changes.
- No refunds, invoices, or Stripe customer portal.
- No installable PWA or push notifications.

### 15.3 Engineering gaps

- No unit, integration, or E2E tests in the repository.
- No deploy workflow; CI covers audit, secrets, and typecheck only.
- No metrics, tracing, or error reporting.
- No background jobs (cleanup, notifications, lifecycle rules).
- No load testing of discovery or chat.
- Accessibility is verified manually with Lighthouse (100 across audited routes) but there
  is no automated regression gate.
- No i18n.
- Ten known high dependency advisories (build-time PostCSS, Zod 3), mitigated but not
  resolved.

### 15.4 Documentation debt

- `README.md` still contains Expo/mobile references in several sections; it needs the same
  web-only rewrite already applied to `PROJECT_REPORT.md`.
- A few source comments still mention the removed native client
  (`packages/shared/src/security/certificate-confidentiality.ts`,
  `packages/shared/src/schemas.ts`, `packages/shared/src/constants.ts`,
  `packages/shared/design-tokens.cjs`, `apps/web/src/lib/security/origin.ts`, and the
  certificate stream's base64 note).
- The sign-in page still shows a "local demo accounts" box that does not apply to the
  cloud project.
- `PROJECT_REPORT.md` is tracked, but this platform report is intentionally untracked
  working documentation.

### 15.5 Suggested sequence

1. Configure R2 and Stripe to complete the end-to-end demo.
2. Push migrations `0004`/`0005`; disable autoconfirm; enable MFA for admins.
3. Add transactional email and in-app notifications.
4. Add database/API tests and a deploy workflow.
5. Add admin tooling for companies, credits, and roles.
6. Add observability (Sentry/OpenTelemetry + log drain + alerts).
7. Move to nonce-based CSP.
8. Commission a penetration test and accessibility audit.

---

## 16. File map

| Concern                                 | File                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Root scripts / workspace                | `package.json`, `pnpm-workspace.yaml`, `turbo.json`                     |
| Next.js config, CSP, headers            | `apps/web/next.config.ts`                                               |
| Env access                              | `apps/web/src/lib/env.ts`                                               |
| Middleware                              | `apps/web/src/middleware.ts`                                            |
| API chokepoint                          | `apps/web/src/lib/api/auth.ts`                                          |
| API helpers                             | `apps/web/src/lib/api/http.ts`, `client.ts`                             |
| Rate limiting                           | `apps/web/src/lib/security/rate-limit.ts`                               |
| Origin check                            | `apps/web/src/lib/security/origin.ts`                                   |
| Security logging                        | `apps/web/src/lib/security/log.ts`                                      |
| Request fingerprints                    | `apps/web/src/lib/security/request-context.ts`                          |
| Supabase clients                        | `apps/web/src/lib/supabase/{admin,auth,client,server}.ts`               |
| Session / role guards                   | `apps/web/src/lib/auth/{session,redirect,provision}.ts`                 |
| Schema                                  | `supabase/migrations/0001…0005`                                         |
| Seed                                    | `supabase/seed.sql`                                                     |
| Shared constants                        | `packages/shared/src/constants.ts`                                      |
| Shared schemas                          | `packages/shared/src/schemas.ts`                                        |
| Shared types / helpers                  | `packages/shared/src/{types,helpers}.ts`                                |
| Confidentiality contract                | `packages/shared/src/security/certificate-confidentiality.ts`           |
| Design tokens (legacy palette + radius) | `packages/shared/design-tokens.cjs`                                     |
| Web palette                             | `apps/web/tailwind.config.ts`                                           |
| R2 config / keys / presign              | `packages/storage/src/{config,keys,presign}.ts`                         |
| pdf.js worker sync                      | `scripts/sync-pdfjs-worker.mjs`                                         |
| Verification studio                     | `apps/web/src/app/(app)/candidate/verification/verification-studio.tsx` |
| Secure certificate viewer               | `apps/web/src/components/employer/secure-certificate-viewer.tsx`        |
| Chat                                    | `apps/web/src/components/chat/chat-thread.tsx`                          |
| Aurora                                  | `apps/web/src/components/ui/AuroraRibbons.tsx`, `TopographicField.tsx`  |
| Global styles                           | `apps/web/src/app/globals.css`                                          |
| 404 / error boundaries                  | `apps/web/src/app/{not-found,error,global-error}.tsx`                   |
| Security policy                         | `SECURITY.md`                                                           |
| Delivery report                         | `PROJECT_REPORT.md`                                                     |
| This report                             | `PLATFORM_REPORT.md`                                                    |

---

## 17. Glossary

| Term                    | Meaning                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| **Unlock**              | Spending one credit to reveal contact details, the certificate, and chat |
| **Entitlement**         | A `company_unlocked_candidates` row                                      |
| **Ledger**              | Append-only `credit_ledger`; balance is always derived                   |
| **Masked candidate**    | Pre-unlock display name derived from a hash                              |
| **Verification**        | Admin approval of a degree certificate plus a live pitch                 |
| **Finalize**            | Server-side validation of uploads before review                          |
| **Priority Pro**        | Paid candidate placement plus view analytics                             |
| **RLS**                 | PostgreSQL Row Level Security                                            |
| **RPC**                 | A Postgres function called through PostgREST                             |
| **Presign**             | A short-lived signed URL that grants one storage operation               |
| **Watermark signature** | Employer name · email · short id · UTC timestamp                         |
| **Aurora**              | The CSS/SVG Northern Lights ribbon background                            |

---

**End of report.**
