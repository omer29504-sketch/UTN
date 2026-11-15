# University Talent Network (UTN) — Comprehensive Project Report

**Report date:** 2026-11-14
**Repository:** `/home/bannda/Desktop/University Talent Network (UTN)`
**Live backend:** Supabase Cloud project `jecdhhihbtaocbfzlljt` (`https://jecdhhihbtaocbfzlljt.supabase.co`)
**Web dev server:** `http://localhost:3000` (LAN: `http://192.168.70.72:3000`)
**Current stage:** All four planned phases are implemented across web and mobile. The
Supabase backend is live and connected. Cloudflare R2 and Stripe are still configuration
placeholders, so media upload/playback and payments are the only major flows that cannot
run end to end yet.

---

## 1. Executive summary

UTN is a two-sided, verified video recruitment platform for university graduates and
employers.

- **Graduates** prove their degree once with a private certificate and a live 60–120 second
  camera pitch. They become discoverable only after an administrator approves the
  submission.
- **Employers** sign up with a corporate email address, browse verified graduates for free,
  and watch pitch videos without spending anything. They spend **1 unlock credit** to reveal
  full contact details, open the private certificate, and start a direct chat.
- **Monetization** comes from employer credit packs (5 / 15 / 30 credits) and an optional
  candidate **Priority Pro** upgrade that pins the candidate higher in search and exposes
  profile-view analytics. Every new company receives **2 free trial credits**.

At this stage the product is **feature-complete for the planned scope**:

| Area | State |
|---|---|
| Monorepo, shared contracts, storage package | Complete |
| Supabase schema, RLS, triggers, RPCs, audit trail | Complete and applied to the cloud project |
| Web candidate / employer / admin flows | Complete |
| Web landing page, marquee, analytics, realtime chat | Complete |
| Mobile auth, candidate, employer, chat screens | Complete |
| Live Supabase Auth + database | Connected and smoke-tested |
| Cloudflare R2 | **Not configured** (placeholder credentials) |
| Stripe | **Not configured** (placeholder keys and price IDs) |
| Automated tests | Not present (typecheck + build + export + manual smoke tests only) |

**Practical readiness:** the application shell, authorization model, and database logic are
in place. To demo the full product, R2 and Stripe credentials must be supplied. To ship to
production, the security and operational items in §14 also need attention.

---

## 2. Product definition and business model

### 2.1 Candidate value proposition

- Verify a degree once, privately.
- Record a short, unedited pitch that replaces a cover letter.
- Control who sees contact information: only employers who spend a credit.
- Optionally pay for Priority Pro placement and view analytics.

### 2.2 Employer value proposition

- Search verified graduates without paying to browse.
- Watch pitch videos for free before spending.
- Spend credits only when a candidate is worth contacting.
- Start a direct, realtime conversation immediately after unlocking.

### 2.3 Trust rules

- Certificates and pitch videos live in private object storage, never in a public bucket.
- Candidate names are masked (`Verified Candidate ####`) until unlocked.
- Verification state transitions are controlled by admins in the database, not by the UI.
- Employer accounts require a corporate domain; free consumer email domains are blocked.
- Credits are append-only ledger entries; unlocks are atomic and idempotent.

### 2.4 Monetization constants

| Item | Value | Source |
|---|---|---|
| Free trial credits per company | 2 | `FREE_TRIAL_CREDITS` |
| Cost to unlock one candidate | 1 | `UNLOCK_COST_CREDITS` |
| Credit packs | Starter 5, Growth 15, Scale 30 | `CREDIT_PACKS` |
| Candidate upgrade | Priority Pro | `CANDIDATE_PRO_PLAN` |
| Pitch duration | 60–120 seconds | `MIN_PITCH_SECONDS` / `MAX_PITCH_SECONDS` |

---

## 3. System architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  apps/web (Next.js 15)       │        │  apps/mobile (Expo SDK 54)   │
│  App Router, React 19        │        │  Expo Router, React Native   │
│  Server Components + Client  │        │  NativeWind, expo-camera     │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │  @supabase/ssr cookies                │  supabase-js + AsyncStorage
               │  Bearer tokens for API routes         │  Bearer tokens for API routes
               ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Supabase Cloud — project jecdhhihbtaocbfzlljt                        │
│  PostgreSQL + Auth + Realtime + Row Level Security + RPCs             │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │                               │
                ▼                               ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Cloudflare R2 (S3 API)      │        │  Stripe Checkout + Webhooks  │
│  private-credentials         │        │  credit packs, Priority Pro  │
│  pitch-videos                │        │  signature-verified events   │
│  company-logos               │        └──────────────────────────────┘
└──────────────────────────────┘
                ▲
                │ presigned PUT/GET only via Next.js API
                │
        tesseract.js OCR (server-side, raster images)
```

### 3.1 Technology stack

| Layer | Technology | Version |
|---|---|---|
| Package manager | pnpm | 9.15.4 |
| Monorepo runner | Turborepo | 2.11.11 |
| Language | TypeScript | 5.9.x |
| Runtime | Node.js | >= 20.9 (verified on Node 24) |
| Web framework | Next.js App Router | 15.5.29 |
| Web UI | React, Tailwind CSS, Lucide | 19.1.0, 3.4.x, 1.72.x |
| Web auth | `@supabase/ssr` | 0.12.7 |
| Supabase client | `@supabase/supabase-js` | 2.119.0 |
| Payments | Stripe Node SDK | 23.1.0 |
| OCR | tesseract.js | 7.0.0 |
| Mobile framework | Expo SDK | ~54.0.38 |
| Mobile runtime | React Native | 0.81.5 |
| Mobile routing | Expo Router | 6.0.24 |
| Mobile styling | NativeWind | 4.2.7 |
| Mobile camera | expo-camera | 17.0.10 |
| Mobile video playback | expo-av | 16.0.8 |
| Mobile files | expo-document-picker / expo-file-system | 14.0.8 / 19.0.24 |
| Object storage client | `@aws-sdk/client-s3` + presigner | S3-compatible R2 |
| Database | Supabase PostgreSQL | Cloud |

### 3.2 Architectural decisions

1. **Supabase Cloud instead of local Docker.** The project uses the hosted project because
   Docker and the Supabase CLI are unavailable in this environment. The migrations were
   applied through the Supabase Management API and the dashboard SQL editor.
2. **R2 instead of Supabase Storage.** `supabase/config.toml` disables built-in Storage.
   All binaries live in R2 for zero-egress economics and independent access control.
3. **Authorization in PostgreSQL.** RLS, triggers, and security-definer RPCs enforce the
   business rules even if a client bypasses the UI. The UI is a convenience layer, not the
   security boundary.
4. **One storage door.** The browser never receives R2 credentials. It asks
   `POST /api/storage/presign` for a short-lived, ownership-scoped URL.
5. **No mutable balance column.** Credit balance is always `SUM(delta)` over
   `credit_ledger`, with a unique `(company_id, reason, reference_id)` index for
   idempotency.
6. **Admin is not a public sign-up role.** `signUpSchema` excludes `admin`, the
   `protect_profile_role` trigger blocks self-promotion, and `profiles_insert_self`
   requires `role <> 'admin'`. Admins are promoted out of band with the service role.
7. **Static public env references.** `NEXT_PUBLIC_*` values are read through static
   `process.env.NEXT_PUBLIC_*` expressions so Next.js inlines them into browser bundles.

---

## 4. Monorepo layout

```
.
├── apps/
│   ├── web/                     Next.js 15 App Router
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (app)/       Session-guarded role workspaces
│   │       │   │   ├── dashboard/
│   │       │   │   ├── candidate/{profile,verification,messages}/
│   │       │   │   ├── employer/{company,candidates,billing}/
│   │       │   │   └── admin/verification/
│   │       │   ├── auth/{sign-in,sign-up,callback}/
│   │       │   ├── api/         Eight route handlers
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx     Public landing page
│   │       ├── components/      UI primitives + feature components
│   │       ├── lib/
│   │       │   ├── api/         Bearer-token fetch helpers
│   │       │   ├── auth/        Session, role guard, provisioning, redirects
│   │       │   ├── supabase/    browser / server / auth / admin clients
│   │       │   ├── env.ts
│   │       │   └── utils.ts
│   │       └── middleware.ts
│   └── mobile/                  Expo SDK 54 + Expo Router + NativeWind
│       ├── app/
│       │   ├── (auth)/{sign-in,sign-up}.tsx
│       │   ├── (app)/
│       │   │   ├── dashboard.tsx
│       │   │   ├── candidate/{profile,verification,messages}.tsx
│       │   │   └── employer/{company,candidates,billing,chat/[candidateId]}.tsx
│       │   ├── index.tsx
│       │   └── _layout.tsx
│       ├── components/          Header, shell, UI, verification studio
│       └── lib/                 Supabase, auth context, API, env
├── packages/
│   ├── shared/                  Zod schemas, types, constants, helpers, tokens
│   └── storage/                 R2 config, key builder, presigning, object reads
├── supabase/
│   ├── config.toml              Local stack (Storage disabled)
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_verification_reviews.sql
│   │   └── 0003_degree_verification_compliance.sql
│   └── seed.sql                 Local-only demo data with fixed UUIDs
├── .env.example
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json
```

Shared and storage packages export TypeScript source directly. Next.js transpiles them via
`transpilePackages`; Expo consumes them through the workspace. There is no separate package
build step.

### 4.1 Root scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | All workspace dev tasks |
| `pnpm dev:web` | Next.js dev server on `:3000` |
| `pnpm dev:mobile` | Expo dev server |
| `pnpm build` | Turbo build (Next production build) |
| `pnpm typecheck` | TypeScript across all four workspaces |
| `pnpm format` / `format:check` | Prettier |
| `pnpm clean` | Remove build artifacts and `node_modules` |
| `pnpm db:start` / `db:stop` | Local Supabase stack (requires Docker) |
| `pnpm db:reset` | Re-apply migrations + seed |
| `pnpm db:push` | Push migrations to a linked remote project |

---

## 5. Database layer

**Location:** `supabase/migrations/0001_initial_schema.sql`,
`supabase/migrations/0002_verification_reviews.sql`, and
`supabase/migrations/0003_degree_verification_compliance.sql`

**Applied to:** Supabase Cloud project `jecdhhihbtaocbfzlljt` via the Management API and
dashboard SQL editor.

**Objects:** 2 enums, 9 tables, 1 view, 11 triggers, 22 functions, 24 RLS policies,
13 indexes/unique constraints, and the `chk_registrar_consent` check constraint.

### 5.1 Enums

```sql
create type public.user_role as enum ('candidate', 'employer', 'admin');
create type public.verification_status as enum
  ('unverified', 'pending', 'verified', 'rejected');
```

Both are created inside `do $$ ... exception when duplicate_object then null; $$` blocks,
so the migration is re-runnable.

### 5.2 Tables

#### `profiles` — one row per auth user

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | References `auth.users(id)` on delete cascade |
| `email` | text not null unique | Normalized by trigger |
| `role` | `user_role` not null default `candidate` | Assigned at signup or by admin |
| `employer_tos_accepted_at` | timestamptz | Migration 0004; NULL gates all employer certificate access |
| `employer_tos_version` | text | Required once acceptance is recorded (check constraint) |
| `created_at` | timestamptz not null default now() | |

#### `candidate_profiles` — candidate domain data

| Column | Type | Notes |
|---|---|---|
| `user_id` | uuid PK | References `profiles(id)` on delete cascade |
| `full_name` | text not null | Masked for employers before unlock |
| `headline` | text | 140 characters in the form schema |
| `industry` | text | One of the shared industry taxonomy |
| `university_name` | text not null | Matched against the certificate by an admin |
| `degree_level` | text not null | One of the shared degree taxonomy |
| `graduation_year` | integer not null | Check 1950–2100 |
| `experience_years` | integer not null default 0 | Check 0–60 |
| `phone` | text | Shared only after unlock |
| `verification_status` | `verification_status` not null default `unverified` | Admin-managed |
| `rejection_reason` | text | Set when requesting changes |
| `is_featured` | boolean not null default false | Priority Pro; admin/Stripe only |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

#### `candidate_media` — private verification assets

| Column | Type | Notes |
|---|---|---|
| `candidate_id` | uuid PK | References `candidate_profiles(user_id)` on delete cascade |
| `certificate_r2_key` | text | Private R2 key under the candidate UUID prefix |
| `video_r2_key` | text | Private R2 key under the candidate UUID prefix |
| `video_duration_seconds` | integer | Check 60–120 when present |
| `ocr_extracted_text` | text | Draft/final OCR result, capped in the API |
| `submitted_at` | timestamptz | Set on finalize |

#### `companies` — one per employer owner

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `owner_id` | uuid not null unique | References `profiles(id)` on delete cascade |
| `company_name` | text not null | |
| `corporate_domain` | text not null unique | Derived from the owner email; prevents trial-credit farming |
| `logo_r2_key` | text | Public logo bucket key |
| `is_verified` | boolean not null default false | Admin-managed |
| `display_logo_consent` | boolean not null default true | Controls marquee inclusion |
| `created_at` | timestamptz not null default now() | |

#### `credit_ledger` — append-only credit history

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `company_id` | uuid not null | References `companies(id)` on delete cascade |
| `delta` | integer not null | Check `delta <> 0` |
| `reason` | text not null | `signup_trial_credits`, `candidate_unlock`, `stripe_credit_pack` |
| `reference_id` | uuid | Unique per `(company_id, reason, reference_id)` |
| `created_at` | timestamptz not null default now() | |

Balance is always derived: `SELECT COALESCE(SUM(delta), 0)`.

#### `company_unlocked_candidates` — paid entitlements

| Column | Type | Notes |
|---|---|---|
| `company_id` | uuid not null | References `companies(id)` on delete cascade |
| `candidate_id` | uuid not null | References `candidate_profiles(user_id)` on delete cascade |
| `unlocked_at` | timestamptz not null default now() | |
| Primary key | `(company_id, candidate_id)` | One unlock per pair |

#### `messages` — unlocked direct chat

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `company_id` | uuid not null | References `companies(id)` on delete cascade |
| `candidate_id` | uuid not null | References `candidate_profiles(user_id)` on delete cascade |
| `sender_id` | uuid not null | References `profiles(id)` on delete cascade |
| `body` | text not null | Check 1–4000 characters |
| `created_at` | timestamptz not null default now() | |

`alter table public.messages replica identity full` enables complete realtime payloads.

#### `candidate_profile_views` — Priority Pro analytics

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `candidate_id` | uuid not null | References `candidate_profiles(user_id)` on delete cascade |
| `viewer_company_id` | uuid not null | References `companies(id)` on delete cascade |
| `viewed_at` | timestamptz not null default now() | |

#### `verification_reviews` — immutable audit trail (migration 0002)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `candidate_id` | uuid not null | References `candidate_profiles(user_id)` on delete cascade |
| `reviewer_id` | uuid | References `profiles(id)` on delete set null |
| `reviewer_email` | text not null | Snapshot so the trail survives reviewer deletion |
| `decision` | `verification_status` not null | Check `verified` or `rejected` |
| `rejection_reason` | text | |
| `created_at` | timestamptz not null default now() | |

#### `document_access_logs` — immutable credential audit trail (migration 0004)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `employer_id` | uuid not null | References `auth.users(id)` on delete cascade |
| `candidate_id` | uuid not null | Deliberately **no FK**, so evidence survives candidate deletion |
| `event_type` | text not null | Check: `tos_accepted`, `certificate_viewed`, `hourly_reack_completed`, `focus_loss_blur`, `screenshot_attempt`, `print_or_devtools_attempt` |
| `ip_address` | text | From `x-forwarded-for` / `cf-connecting-ip` / `x-real-ip` |
| `user_agent` | text | Truncated to 512 characters |
| `watermark_signature` | text | Employer name, email, short id, UTC timestamp |
| `created_at` | timestamptz not null default now() | |

RLS allows employers to INSERT only their own rows (`employer_id = auth.uid()` and role
`employer`) and admins to SELECT all rows. There is no UPDATE or DELETE policy, and a
BEFORE UPDATE trigger raises `document_access_logs_is_append_only` for every role.

### 5.3 Indexes and constraints

- `candidate_profiles_status_idx` on `(verification_status)`
- `candidate_profiles_discovery_idx` on `(verification_status, is_featured desc, updated_at desc)`
- `candidate_profiles_filters_idx` on `(industry, degree_level, university_name, graduation_year)`
- `candidate_profiles_experience_idx` on `(experience_years)`
- `credit_ledger_company_idx` on `(company_id, created_at desc)`
- `credit_ledger_reference_unique` on `(company_id, reason, reference_id)` where
  `reference_id is not null` — makes signup grants and Stripe webhooks idempotent
- `unlocked_candidates_candidate_idx` on `(candidate_id)`
- `messages_conversation_idx` on `(company_id, candidate_id, created_at)`
- `messages_sender_idx` on `(sender_id)`
- `profile_views_candidate_idx` on `(candidate_id, viewed_at desc)`
- `verification_reviews_candidate_idx` on `(candidate_id, created_at desc)`
- `verification_reviews_decision_idx` on `(decision, created_at desc)`

### 5.4 Functions and RPCs

#### Security helpers

| Function | Purpose |
|---|---|
| `is_blocked_consumer_domain(domain)` | Immutable check against the shared blocklist |
| `is_consumer_email(email)` | Extracts the domain and delegates to the blocklist |
| `is_admin()` | Security-definer check of the caller's role |
| `current_user_role()` | Returns the caller's `user_role` |
| `current_company_id()` | Returns the caller's company id |
| `is_company_owner(company_id)` | Ownership check |
| `has_unlocked(company_id, candidate_id)` | Entitlement check used by chat |
| `company_credit_balance(company_id)` | Derived ledger balance |
| `get_my_credit_balance()` | Balance for the signed-in employer |

#### Trigger functions

| Function | Trigger | Behavior |
|---|---|---|
| `set_updated_at()` | `candidate_profiles_updated_at` | Maintains `updated_at` |
| `normalize_profile_email()` | `profiles_normalize_email` | Lowercases/trims email |
| `handle_new_user()` | `on_auth_user_created` | Creates a `profiles` row from auth metadata; maps any non-employer role to candidate, so public signup can never mint an admin |
| `protect_profile_role()` | `profiles_protect_role` | Blocks self-promotion to admin / role changes |
| `protect_candidate_fields()` | `candidate_profiles_protect_fields` | Controls verification transitions, `is_featured`, and rejection reason |
| `guard_candidate_media()` | `candidate_media_guard` | Locks media uploads while `pending`/`verified`; enforces key ownership |
| `sync_candidate_submission()` | `candidate_media_sync_submission` | Promotes `unverified`/`rejected` to `pending` when both assets exist |
| `validate_company_domain()` | `companies_validate_domain` | Validates domain syntax, blocks consumer domains, requires matching owner email domain |
| `protect_company_fields()` | `companies_protect_fields` | Prevents employers from self-verifying or changing ownership/domain |
| `grant_signup_credits()` | `companies_grant_signup_credits` | Grants exactly 2 trial credits once per company |
| `enforce_message_unlock()` | `messages_enforce_unlock` | Rejects messages unless an unlock exists and the sender is a participant |

#### `unlock_candidate(p_company_id, p_candidate_id)`

Returns `(success, already_unlocked, credit_balance, message)`.

Behavior:

1. Requires an authenticated caller.
2. Resolves the company owner; rejects non-owners unless admin.
3. Takes a per-company advisory lock (`pg_advisory_xact_lock`) so concurrent requests cannot
   both spend the final credit.
4. Returns early and idempotently if the pair is already unlocked.
5. Rejects candidates that are not `verified`.
6. Rejects when the derived balance is below 1.
7. Inserts a `-1` ledger row with `reason = 'candidate_unlock'` and
   `reference_id = candidate_id`.
8. Inserts the entitlement row.
9. Returns the refreshed balance.
10. A `unique_violation` exception path treats a retried request as already unlocked.

#### `get_verified_candidates_for_employer(...)`

Parameters: `p_search`, `p_industry`, `p_degree_level`, `p_university`,
`p_graduation_year`, `p_max_experience_years`, `p_only_featured`, `p_limit`, `p_offset`.

Returns candidate card data plus `total_count`. Key behavior:

- Admins and employers can call it; candidates cannot.
- Only `verified` candidates are returned.
- The caller's company is resolved server-side.
- Before unlock, `display_name` is `'Verified Candidate #' || hash-derived 4 digits`, and
  `full_name`, `email`, `phone`, and `certificate_r2_key` are `NULL`.
- After unlock (or for admins), the real values are returned.
- `video_r2_key` and `video_duration_seconds` are always returned so employers can watch
  pitches for free.
- Ordering is `is_featured desc, updated_at desc`.
- Limits are clamped to 1–60, offset to >= 0.

### 5.5 Row Level Security

RLS is enabled on all 9 tables. Policies (24 total):

| Table | Policies |
|---|---|
| `profiles` | select own or admin; insert self with `role <> 'admin'`; update own or admin |
| `candidate_profiles` | select own or admin; insert self as candidate; update own or admin |
| `candidate_media` | select own or admin; insert self as candidate; update own or admin |
| `companies` | select owner or admin; insert employer self; update owner or admin; delete admin |
| `credit_ledger` | select owner or admin; insert admin only (service role bypasses RLS) |
| `company_unlocked_candidates` | select participant or admin; insert admin; delete admin |
| `messages` | select participant or admin; insert unlocked participant |
| `candidate_profile_views` | select own or admin; insert by the caller's company for a verified candidate |
| `verification_reviews` | select candidate or admin; insert admin with `reviewer_id = auth.uid()` |

Employers never read `candidate_media` directly. The discovery RPC exposes only the video
key, and the presign API performs the entitlement check.

### 5.6 Public marquee view

```sql
create or replace view public.company_marquee
with (security_invoker = false) as
select c.id, c.company_name, c.logo_r2_key, c.created_at
from public.companies c
where c.is_verified = true and c.display_logo_consent = true
order by c.created_at asc;
```

The view is intentionally anonymous-safe: no contact, domain, or owner data. It is the only
database object the public landing page reads.

### 5.7 Verification audit trail

- Decisions remain on `candidate_profiles.verification_status`.
- Every decision appends a `verification_reviews` row with reviewer identity and reason.
- The admin API writes the audit row first, then updates the profile. If the profile update
  fails, it deletes the just-inserted audit row and returns an error.
- Candidates can read their own history; only admins can insert; no update/delete grants are
  exposed through the API.
- A resubmission creates a new pending review, preserving prior decisions.

---

## 6. Shared package (`packages/shared`)

The shared package is framework-free: no React, DOM, Node, or database imports. It runs
unchanged in Next.js, React Native, edge functions, and tests.

### 6.1 Constants

- Roles, verification statuses and labels
- Degree levels and industries
- Pitch limits, video spec (1280×720, 30 fps, 1.2 Mbps), MIME preferences, teleprompter cues
- Blocked consumer email domains
- Storage buckets, allowed MIME types, max upload sizes
- Presign TTLs (upload 10 min, certificate download 5 min, media download 10 min)
- Credit packs, Priority Pro plan, trial credits, unlock cost
- Employer confidentiality clause copy/version, mandatory checkbox label, 60-minute
  acknowledgment TTL, 10-second expiry poll, watermark refresh interval, audit events
- UI layout tokens, page sizes, app name/tagline

### 6.2 Zod schemas

| Schema | Purpose |
|---|---|
| `uuidSchema`, `roleSchema` | Primitives |
| `corporateEmailSchema` | Validates and blocks consumer domains |
| `videoDurationSchema` | Coerces and enforces 60–120 seconds |
| `phoneSchema` | Optional phone validation |
| `paginationSchema` | Limit/offset |
| `candidateProfileSchema` | Candidate profile fields |
| `candidateMediaKeysSchema` | Media key shape |
| `candidateVerificationSubmissionSchema` | Certificate + video submission |
| `candidateSearchFiltersSchema` | Search/filter query |
| `candidateProCheckoutSchema` | Priority Pro checkout |
| `employerRegistrationSchema` | Employer signup |
| `companyProfileSchema` | Company name/domain/logo consent |
| `unlockCandidateSchema` | Company + candidate ids |
| `creditPackCheckoutSchema`, `checkoutSchema` | Discriminated checkout union |
| `adminVerificationDecisionSchema` | Approve/reject with reason rules |
| `messageSchema` | 1–4000 character message |
| `presignUploadSchema`, `presignDownloadSchema`, `presignRequestSchema` | Storage API |
| `documentAuditEventSchema` | Certificate security event type + candidate id |
| `employerConfidentialityAckSchema` | Click-through consent with `accepted: z.literal(true)` |
| `signUpSchema`, `signInSchema`, `signUpMetadataSchema` | Auth |

Notable validations:

- `signUpSchema` only accepts `candidate` or `employer`; admin is not a public role.
- Employer signup requires a non-consumer email domain.
- Rejections require a trimmed reason.
- Upload requests validate MIME type, byte size, and bucket-specific limits.
- Pitch duration must be an integer from 60 to 120.

### 6.3 Types and helpers

- Domain interfaces mirroring PostgREST snake_case: `Profile`, `CandidateProfile`,
  `CandidateMedia`, `VerificationReview`, `Company`, `CreditLedgerEntry`,
  `CompanyUnlockedCandidate`, `Message`, `CandidateProfileView`, `MarqueeCompany`,
  `EmployerCandidateCard`, `UnlockCandidateResult`, presign responses, API errors,
  pitch recording state, verification gate.
- Helpers: email domain extraction, consumer-domain check, corporate-email predicate,
  pitch duration formatting, progress calculation, teleprompter cue selection, byte
  formatting, masking, MIME extension mapping, storage-key ownership extraction, and
  supported recording MIME selection.

### 6.4 Design tokens

`packages/shared/design-tokens.cjs` is the single source of truth for colors, fonts, and
radii, consumed by both Tailwind configs.

Palette — **Executive Slate & Alabaster**:

- Slate `#0F172A` / `#1E293B`
- Alabaster `#F8FAFC` / `#FFFFFF`
- Indigo `#4F46E5`
- Emerald `#10B981`

Typography: **Plus Jakarta Sans** for headings, **Inter** for body. Web uses `next/font`;
mobile uses `@expo-google-fonts`, so both render without network access.

---

## 7. Storage and media pipeline (`packages/storage`)

### 7.1 R2 configuration

- Three buckets: `private-credentials`, `pitch-videos`, `company-logos`.
- Credentials: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
- Optional endpoint override and TTL overrides.
- Public logos base URL for the logo bucket only.
- Client uses `region: "auto"`, path-style addressing, and disables default CRC32
  checksums that would invalidate browser presigned PUTs.

### 7.2 Key construction

```
private-credentials/<candidate-uuid>/<uuid>.pdf
pitch-videos/<candidate-uuid>/<uuid>.webm
company-logos/<company-uuid>/<uuid>.png
```

- Owner ids must be UUIDs.
- Keys are unguessable and ownership-prefixed.
- Keys cannot contain `..` or start with `/`.
- The server derives the owner; it never trusts a browser-supplied key for uploads.

### 7.3 Presigning

- PUT URLs sign `Content-Type` and `Content-Length`, so a client cannot swap file type or
  inflate size after authorization.
- GET URLs are short-lived (5 minutes for certificates, 10 minutes for pitch videos).
- The storage package also exposes `headStorageObject`, `readStorageObject`, and
  `deleteStorageObject`.
- `headStorageObject` is used by finalize to confirm the browser actually uploaded the file.
- `readStorageObject` is used by OCR to fetch the private certificate server-side.

### 7.4 Upload/download authorization

`POST /api/storage/presign` is the only door to R2.

| Caller | Pitch video | Certificate | Company logo |
|---|---|---|---|
| Admin | Any | Any | Any |
| Candidate (owner) | Own | Own | — |
| Employer | Any **verified** candidate | **Never** — secure stream only | — |

Employer certificate downloads are rejected with `403 use_secure_viewer`. The audited
`/api/employer/certificates/[candidateId]/stream` endpoint is the only employer path to
certificate bytes.

Uploads additionally require:

- Candidate role for credentials/pitch videos, with a completed profile.
- Uploads blocked while the candidate is `pending` or `verified`.
- Employer role and an existing company for logos.
- Bucket-specific MIME type and size validation.

### 7.5 OCR

- `POST /api/verification/ocr` accepts a freshly uploaded certificate key or falls back to
  the stored key.
- PDFs are explicitly skipped with a clear message; an admin reviews them manually.
- Raster images are downloaded server-side and processed with tesseract.js.
- The worker caches `eng.traineddata` under `os.tmpdir()/utn-tesseract-cache`.
- Text is cleaned (line endings, trailing spaces, repeated blank lines) and capped at 20,000
  characters.
- Draft text is upserted into `candidate_media` so it survives until finalization.
- Errors return a 502 with a message that manual review is still possible.

### 7.6 Finalize

`POST /api/verification/finalize` re-validates everything before submission:

1. Caller is a candidate with a profile.
2. Status is not `pending` or `verified`.
3. Certificate and video keys belong to the caller's UUID prefix.
4. Both objects exist in R2.
5. Object sizes exactly match the submitted sizes.
6. Object content types match the submitted types (parameters stripped).
7. Upserts `candidate_media`.
8. Reads back the profile status; the trigger promotes `unverified`/`rejected` to `pending`.

This prevents a client from claiming an upload succeeded when the object is missing, empty,
wrong type, or owned by someone else.

---

## 8. Web application (`apps/web`)

### 8.1 Route map

#### Public

| Route | Purpose |
|---|---|
| `/` | Landing page with hero, value props, how-it-works, trust grid, marquee, CTA |
| `/auth/sign-in` | Email/password sign-in |
| `/auth/sign-up` | Role-selecting sign-up |
| `/auth/callback` | PKCE email-confirmation callback |

#### Session-guarded workspace (`(app)` layout)

| Route | Role | Purpose |
|---|---|---|
| `/dashboard` | any | Role-specific overview |
| `/candidate/profile` | candidate | Create/edit profile, Priority Pro card |
| `/candidate/verification` | candidate | Upload certificate, record pitch, submit, review history |
| `/candidate/messages` | candidate | Conversation inbox |
| `/candidate/messages/[companyId]` | candidate | Realtime thread, gated by unlock |
| `/employer/company` | employer | Create/edit company and logo consent |
| `/employer/candidates` | employer | Search/filter verified candidates, watch pitches, unlock |
| `/employer/candidates/[candidateId]` | employer | Unlocked detail: contact, degree, certificate, pitch, chat |
| `/employer/billing` | employer | Credit balance, packs, checkout status |
| `/admin/verification` | admin | Pending review queue |
| `/admin/verification/[candidateId]` | admin | Review detail, OCR text, certificate, pitch, decision |

#### API routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/provision` | Bearer | Idempotent post-signup provisioning |
| POST | `/api/storage/presign` | Bearer | Upload/download presigned URLs |
| POST | `/api/verification/ocr` | Bearer candidate | OCR a certificate |
| POST | `/api/verification/finalize` | Bearer candidate | Validate uploads and submit for review |
| POST | `/api/admin/verification` | Bearer admin | Record a decision + audit row |
| POST | `/api/employer/unlock` | Bearer employer | Spend a credit atomically |
| GET | `/api/employer/certificates/[candidateId]/stream` | Bearer employer | Audited zero-download certificate bytes (or `?format=base64`) |
| POST | `/api/employer/certificates/security-event` | Bearer employer | Record consent + anti-capture telemetry |
| POST | `/api/stripe/checkout` | Bearer | Create a Checkout session |
| POST | `/api/webhooks/stripe` | Stripe signature | Grant credits / Priority Pro |

All API routes use `runtime = "nodejs"` and `dynamic = "force-dynamic"`.

### 8.2 Authentication and session handling

- **Web** uses `@supabase/ssr` cookie sessions. Server Components read the session; client
  components share it through cookies.
- **Middleware** (`src/middleware.ts`) redirects unauthenticated users away from
  `/dashboard`, `/candidate`, `/employer`, and `/admin`, preserving a safe `next` path.
  It redirects authenticated users away from sign-in/sign-up.
- **`(app)/layout.tsx`** performs a second server-side session check and renders the app
  shell/nav.
- **`requireRole()`** guards each role workspace server-side and redirects mismatched roles
  to `/dashboard`.
- **API routes** use `requireApiCaller()`: a Bearer token is verified with Supabase Auth,
  then the caller's role is read from `profiles`. The service-role client is used only after
  this verification.
- **Sign-up** collects role, full name, company name (employer), and consent. It calls
  `supabase.auth.signUp` with metadata, then `POST /api/auth/provision` if a session exists.
- **Email confirmation** flows through `/auth/callback`, which exchanges the PKCE code,
  provisions the account, and redirects to a safe `next` path.
- **`safeNextPath`** only allows same-origin relative paths and rejects `/auth/*` targets.

### 8.3 Candidate flows

#### Profile

- Required: full name, experience, university, degree level, graduation year.
- Optional: phone, headline (140 chars), industry.
- Stored in `candidate_profiles`.
- Shows a Priority Pro card (upgrade or active state).

#### Verification studio

The web studio is a client component using `getUserMedia` and `MediaRecorder`.

1. **Certificate**: accepts PDF/JPG/PNG up to 10 MB. Requests a presigned PUT, uploads
   directly to R2 with the signed content type, then calls OCR.
2. **OCR feedback**: shows extracted text and confidence, or a skipped/manual-review message
   for PDFs and unreadable images.
3. **Pitch recording**:
   - Camera + microphone only; no gallery upload.
   - 1280×720, 30 fps, 1.2 Mbps, front-facing.
   - Chooses the first supported MIME type (WebM VP9/VP8, then MP4 H.264).
   - Live timer, teleprompter cues, 120-second automatic stop.
   - Submit requires at least 60 seconds.
   - Preview and discard before submission.
4. **Submission**: presigns the video, uploads the blob, then calls finalize with exact
   sizes/types/duration.
5. On success, shows submitted state and refreshes the page.

Once the status is `pending` or `verified`, the studio is replaced by a locked submission
view showing the profile, private media status, review history, and a rejection reason when
changes are requested.

#### Dashboard

- Profile completion and verification checklist.
- Current status badge, rejection alert, latest review.
- Priority Pro view count.
- Links to profile, verification, and messages.

#### Messages

- Inbox lists companies that have unlocked the candidate, with last-message previews.
- Threads use the shared realtime `ChatThread` component.
- Opening a thread for a non-unlocking company shows a locked state.

### 8.4 Employer flows

#### Company profile

- Create/edit company name and logo display consent.
- Corporate domain is derived from the verified email and is unique.
- Employers cannot self-verify (`is_verified` is protected by trigger).
- Logo upload support exists in the storage API; the company form currently focuses on name
  and consent.

#### Discovery

- Calls `get_verified_candidates_for_employer` with search/filter/pagination parameters.
- Filters: search text, industry, degree level, university, graduation year, max experience,
  Priority Pro only.
- Cards show masked name, headline, degree, university, graduation year, experience,
  Priority Pro badge, and pitch duration.
- Pitch videos can be loaded and watched for free via presigned GET.
- Unlock button calls `/api/employer/unlock`; success updates the card and balance.
- Pagination is server-side (24 per page, max 60).

#### Unlocked detail

- Contact email and phone.
- Degree/university/experience.
- Confidential certificate viewer (no download):
  - click-through confidentiality clause before the first view;
  - every-open warning plus a 60-minute re-acknowledgment gate (checked every 10 s);
  - PDF/image painted to `<canvas>` with a burned-in plus SVG forensic watermark;
  - right-click/selection/drag suppression, window-blur privacy shield, and
    PrintScreen/Ctrl+P/Ctrl+S/Ctrl+Shift+I kill-switch;
  - `@media print` hides the viewer.
- Pitch video player.
- Realtime chat.
- Records a `candidate_profile_views` row (best-effort) for Priority Pro analytics.

#### Billing

- Shows derived credit balance.
- Lists the three credit packs with credit counts and highlights.
- Checkout button calls `/api/stripe/checkout` and redirects to Stripe.
- Success/cancel query states are surfaced as alerts.
- Explains how credits work.

### 8.5 Admin flows

#### Queue

- Lists candidates with `verification_status = 'pending'`.
- Shows profile summary, submission time, and link to detail.
- Empty state when the queue is clear.

#### Review detail

- Profile claims side by side with the document.
- OCR extracted text.
- Short-lived certificate link (5 minutes).
- Pitch video link (10 minutes).
- Approve / request changes panel.
- Rejection reason is required and capped at 1,000 characters.
- Review history.
- Decision API writes an immutable audit row first, then updates the profile.

### 8.6 Landing page

- Hero with primary and secondary CTAs.
- "For graduates" and "For employers" value cards.
- Four-step how-it-works.
- Trust grid: 60–120s pitch, private credentials, atomic unlocks, realtime chat.
- "Trusted by" infinite logo marquee.
- Final CTA.

The marquee reads the `company_marquee` view. If no verified/consented companies exist, it
renders six neutral placeholder tiles. The animation is CSS-based and duplicates the list
for a seamless loop.

### 8.7 Realtime chat

- `ChatThread` loads messages for a `(company_id, candidate_id)` pair.
- Subscribes to `postgres_changes` INSERT events filtered by `company_id`, then ignores
  rows for other candidates.
- Inserts through the browser Supabase client, so RLS and the `enforce_message_unlock`
  trigger apply.
- Deduplicates the sender's own insert against the realtime event.
- Auto-scrolls to the newest message.
- Both web and mobile use the same table and rules.

### 8.8 API error convention

All API routes return JSON shaped like:

```json
{
  "error": "machine_code",
  "message": "Human-readable message.",
  "issues": []
}
```

Common status codes:

- `400` invalid JSON / malformed key
- `401` missing or invalid token
- `403` wrong role, missing company/profile, not authorized
- `404` candidate/pack not found
- `409` media locked / not pending / already verified
- `422` schema validation failed
- `500` unexpected server failure
- `502` OCR upstream failure
- `503` Supabase/R2/Stripe not configured

---

## 9. Mobile application (`apps/mobile`)

The mobile app is an Expo Router client with full feature parity for the planned screens.

### 9.1 Screens

| Route | Purpose |
|---|---|
| `/` | Public landing / entry |
| `/auth/sign-in` | Email/password sign-in |
| `/auth/sign-up` | Role-selecting sign-up with corporate-email gate |
| `/dashboard` | Role-specific overview |
| `/candidate/profile` | Profile form + Priority Pro upgrade |
| `/candidate/verification` | Verification studio + review history |
| `/candidate/messages` | Conversation inbox |
| `/candidate/messages/[companyId]` | Realtime thread |
| `/employer/company` | Company profile |
| `/employer/candidates` | Discovery, search, pitch playback, unlock |
| `/employer/certificates/[candidateId]` | Confidential certificate viewer (screen-capture locked) |
| `/employer/billing` | Credit balance + checkout |
| `/employer/chat/[candidateId]` | Realtime chat |

### 9.2 Mobile-specific implementation

- **Supabase client**: `@supabase/supabase-js` with AsyncStorage persistence, PKCE,
  `detectSessionInUrl: false`, and `expo-crypto` WebCrypto polyfill for Hermes.
- **API calls**: `lib/api.ts` attaches the current access token as a Bearer header and
  targets `EXPO_PUBLIC_API_URL`.
- **Verification studio**:
  - Certificate selection via `expo-document-picker`.
  - Upload via presigned URL using `expo-file-system`.
  - OCR through the web API.
  - Camera recording via `expo-camera` `CameraView` / `recordAsync`, front-facing,
    `maxDuration` 120 seconds, minimum 60 seconds before submission.
  - Pitch playback via `expo-av`.
- **Auth context** exposes session/user and drives route protection in the `(app)` layout.
- **Secure certificate viewer**:
  - `expo-screen-capture` `usePreventScreenCapture()` sets Android `FLAG_SECURE` and
    blocks iOS recordings for the lifetime of the screen.
  - `addScreenshotListener` closes the document, shows a violation alert, and posts
    `screenshot_attempt` to the security-event API.
  - The same confidentiality gate, every-open warning, 60-minute re-acknowledgment, and
    repeating forensic watermark as web.
  - Image certificates render from an in-memory base64 data URI; PDFs show a protected
    notice because React Native has no PDF canvas renderer.
- **NativeWind** styling uses the same design tokens as web.
- **Permissions**: `app.json` declares camera and microphone permissions.

### 9.3 Mobile parity status

| Feature | Web | Mobile |
|---|---|---|
| Sign-in / sign-up / corporate gate | Yes | Yes |
| Candidate profile | Yes | Yes |
| Certificate upload + OCR | Yes | Yes |
| Live pitch recording | Yes | Yes |
| Finalize + review history | Yes | Yes |
| Employer company profile | Yes | Yes |
| Candidate discovery + filters | Yes | Yes |
| Pitch playback | Yes | Yes |
| Unlock | Yes | Yes |
| Confidential certificate viewer | Yes | Yes |
| Billing / Stripe redirect | Yes | Yes |
| Priority Pro upgrade | Yes | Yes |
| Realtime chat (both sides) | Yes | Yes |
| Landing page / marquee | Yes | Entry screen only |
| Admin review | Yes | No (web only) |

Admin review is intentionally web-only; the admin role is an internal operations function.

---

## 10. Live backend state

### 10.1 Supabase connection

| Setting | Value |
|---|---|
| Project ref | `jecdhhihbtaocbfzlljt` |
| API URL | `https://jecdhhihbtaocbfzlljt.supabase.co` |
| Web env file | `apps/web/.env.local` |
| Mobile env file | `apps/mobile/.env` |
| Migrations applied | `0001_initial_schema.sql`, `0002_verification_reviews.sql`, `0003_degree_verification_compliance.sql` |
| Auth site URL | `http://localhost:3000` |
| Auth redirect URLs | `http://localhost:3000/auth/callback`, LAN callback |
| Email autoconfirm | `true` (testing only) |
| Public tables verified | 9 tables + `company_marquee` view |

### 10.2 Current data

Verified through the REST API with the service role:

| Table | Rows |
|---|---|
| `profiles` | 1 |
| `candidate_profiles` | 0 |
| `candidate_media` | 0 |
| `companies` | 0 |
| `credit_ledger` | 0 |
| `company_unlocked_candidates` | 0 |
| `messages` | 0 |
| `candidate_profile_views` | 0 |
| `verification_reviews` | 0 |
| `company_marquee` | 0 |

The only profile is:

| Email | Role | Note |
|---|---|---|
| `you@example.com` | `admin` | Originally signed up as candidate, promoted with the service role |

**Important:** `you@example.com` is a placeholder address, not a real inbox. It is fine for
local testing because email confirmation is currently disabled, but it should be replaced
with a real address before production.

### 10.3 Smoke tests performed

- Candidate sign-up through the browser succeeded and redirected to `/candidate/profile`.
- The `handle_new_user` trigger created the `profiles` row.
- Employer provisioning created the `profiles` + `companies` rows and granted 2 trial
  credits.
- Test users were cleaned up afterward.
- The service-role key was confirmed **absent** from the client bundle.
- The Supabase URL and anon key were confirmed present in the browser bundle after the env
  fix.
- The admin account was promoted and can reach `/admin/verification`.

### 10.4 Environment fix: "Supabase is not configured"

**Symptom:** browser flows threw
`Supabase is not configured. Add the public URL and anon key.` even though the values were
present in `apps/web/.env.local`.

**Root cause:** `apps/web/src/lib/env.ts` read public values dynamically:

```ts
process.env[key]
```

Next.js only inlines **statically referenced** `NEXT_PUBLIC_*` variables into browser
bundles. Dynamic lookups work on the server, which is why API routes and SSR were fine, but
returned `undefined` in the browser.

**Fix:** static references in `apps/web/src/lib/env.ts`:

```ts
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";
const publicStripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
```

Server-only secrets still use dynamic `read()` calls. After restarting the dev server:

- The Supabase project ref and anon key were found in the static browser chunks.
- A full service-role key scan of `apps/web/.next/static` found **no** match.
- A real browser sign-up succeeded with no console errors.

---

## 11. Configuration

### 11.1 Environment variables

#### App

| Variable | Used by | Current value |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Web metadata, Stripe redirects | `http://localhost:3000` |
| `EXPO_PUBLIC_API_URL` | Mobile API calls | `http://192.168.70.72:3000` |

#### Supabase

| Variable | Used by | Current value |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web browser/server | Live project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web browser/server | Live anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Web server only | Live service-role key |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Live project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile | Live anon key |

#### Cloudflare R2

| Variable | Current value |
|---|---|
| `R2_ACCOUNT_ID` | Placeholder |
| `R2_ACCESS_KEY_ID` | Placeholder |
| `R2_SECRET_ACCESS_KEY` | Placeholder |
| `R2_BUCKET_PRIVATE_CREDENTIALS` | `private-credentials` |
| `R2_BUCKET_PITCH_VIDEOS` | `pitch-videos` |
| `R2_BUCKET_COMPANY_LOGOS` | `company-logos` |
| `R2_PUBLIC_LOGOS_BASE_URL` | Empty |
| `R2_PRESIGN_UPLOAD_TTL_SECONDS` | Optional, default 600 |
| `R2_PRESIGN_DOWNLOAD_TTL_SECONDS` | Optional, default 300 |

#### Stripe

| Variable | Current value |
|---|---|
| `STRIPE_SECRET_KEY` | Placeholder |
| `STRIPE_WEBHOOK_SECRET` | Placeholder |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Placeholder |
| `STRIPE_PRICE_CREDITS_5` | Placeholder |
| `STRIPE_PRICE_CREDITS_15` | Placeholder |
| `STRIPE_PRICE_CREDITS_30` | Placeholder |
| `STRIPE_PRICE_CANDIDATE_PRO` | Placeholder |

### 11.2 What works without R2/Stripe

- Supabase Auth, sessions, middleware, role guards.
- Candidate profile creation/editing.
- Employer company creation (without logo upload).
- Dashboard views.
- Admin queue (empty until candidates submit).
- Chat schema and UI (until unlocks exist).
- Landing page with placeholder marquee.

### 11.3 What is blocked until R2 is configured

- Certificate upload and OCR.
- Pitch video upload, playback, and finalize.
- Company logo upload and public marquee logos.
- Admin certificate/pitch review.
- Full candidate verification submission.
- Employer pitch playback and secure certificate streaming.

### 11.4 What is blocked until Stripe is configured

- Credit-pack checkout.
- Priority Pro checkout.
- Webhook credit grants.
- Webhook Priority Pro activation.

---

## 12. Verification evidence

| Check | Result |
|---|---|
| `pnpm typecheck` across shared, storage, web, mobile | Pass |
| `pnpm -r --workspace-concurrency=1 typecheck` after Phase 5 | Pass |
| `pnpm --filter @utn/web typecheck` after env fix | Pass |
| `pnpm --filter @utn/web build` (Next.js production) | Pass |
| `pnpm --filter @utn/web build` after Phase 5 (secure viewer routes) | Pass |
| Expo Android export (`expo export --platform android`) | Pass (`Exported: dist`) |
| Migration `0004_employer_certificate_confidentiality.sql` | Authored; not yet pushed |
| Dev server boot | Ready on `:3000` |
| Landing page / sign-in HTTP 200 | Pass |
| Browser sign-up against live Supabase | Pass |
| Profile trigger on signup | Pass |
| Employer provisioning + company + 2 trial credits | Pass |
| Admin promotion via service role | Pass |
| Client bundle contains Supabase URL + anon key | Pass |
| Client bundle excludes full service-role key | Pass |
| Live schema objects | 9 tables + `company_marquee` view + `chk_registrar_consent` (validated) |
| PGlite migration + seed behavioral suite | 41/41 checks (includes migration `0003` registrar-consent enforcement) |
| tesseract.js OCR smoke test | 95% confidence (per earlier phase work) |

**Not verified in this environment:**

- Real R2 upload/download/OCR/finalize end to end.
- Real Stripe Checkout and webhook delivery.
- Camera recording on a physical device or headless browser.
- Local Supabase stack (`pnpm db:reset`) because Docker/Supabase CLI/`psql` are unavailable.
- Mobile runtime on a device/emulator beyond the Android export.

---

## 13. Security posture

### 13.1 Strengths

- **Defense in depth:** middleware, server layouts, API bearer checks, and database RLS all
  participate in authorization.
- **Service-role isolation:** the service-role key is server-only and never present in the
  browser bundle (verified by scanning static chunks).
- **Private media:** certificates and pitch videos are never public. Pitch videos use
  short-lived presigned URLs after server-side entitlement checks; employer certificate
  access is streamed server-side with no presigned URL and a mandatory audit row.
- **Confidentiality gate:** employer certificate access requires a versioned click-through
  consent (`profiles.employer_tos_accepted_at`), re-verified in the stream API.
- **Immutable access audit:** `document_access_logs` is append-only (INSERT own / SELECT
  admin, no UPDATE/DELETE policy, BEFORE UPDATE trigger raises).
- **Anti-capture:** canvas-only rendering, forensic watermarks, focus-loss shield, print
  kill-switch, `@media print` hiding, and OS-level screen-capture blocking on mobile.
- **Signed upload constraints:** content type and length are part of the PUT signature.
- **Ownership-prefixed keys:** storage keys must sit under the owner's UUID prefix.
- **Server-side masking:** candidate contact data is masked in the discovery RPC, not in the
  client.
- **Atomic spending:** advisory lock + unique ledger reference prevent double-spending.
- **Append-only audit:** verification decisions are immutable through the API.
- **Corporate-email gate:** enforced in the client schema, the API, and the database.
- **No self-verification / self-promotion:** triggers and RLS block both.
- **Webhook verification:** Stripe signatures are validated against the raw body.
- **Idempotent webhooks:** deterministic UUID from the Stripe session id plus the unique
  ledger index.
- **Safe redirects:** `safeNextPath` rejects absolute and `/auth/*` targets.
- **Marquee privacy:** the public view exposes only id, name, logo key, and creation time.

### 13.2 Risks and hardening items

| Risk | Impact | Recommendation |
|---|---|---|
| `mailer_autoconfirm = true` | Anyone can create an unverified email account | Turn off before production; add email verification |
| Placeholder admin email | Password reset/notifications cannot reach the admin | Replace `you@example.com` with a real address |
| Supabase PAT was pasted into the session | Token could be reused if not revoked | Revoke it at `https://supabase.com/dashboard/account/tokens` |
| No rate limiting | Signup, OCR, unlock, and checkout endpoints can be abused | Add per-IP/per-user limits (edge middleware or gateway) |
| No automated tests | Regressions in RLS/RPC logic can ship silently | Add DB integration tests and API tests |
| No email notifications | Users miss approvals, rejections, unlocks, messages | Add transactional email (Resend/Postmark/SES) |
| Orphaned R2 uploads | Abandoned uploads consume storage | Add lifecycle rules or a cleanup job |
| No malware/AV scan | Uploaded documents are trusted for admin viewing | Scan or sandbox documents before review |
| External-camera capture | OS/API controls cannot stop a phone photographing the screen | Deterrence is the forensic watermark + audit trail; pursue contractual remedies |
| No CSP/security headers | Reduced XSS defense in depth | Add CSP, HSTS, frame-ancestors, referrer policy |
| No audit log for admin role changes | Out-of-band promotion is invisible | Log role changes / use an admin action table |
| Admin tooling is SQL-only | Company verification and credit adjustments require SQL | Add admin UI for companies, credits, and users |
| No candidate unlock notification | Candidates may not know an employer is interested | Add in-app/email notification |
| Analytics limited to view count | Priority Pro value is thin | Add unique viewers, time series, conversion |
| Stripe has no customer portal/refunds | Billing operations are manual | Add portal and refund handling |
| Tesseract first-run download | Offline deployments fail OCR | Pre-seed the cache or vendor `eng.traineddata` |
| `.env.local` contains live secrets | Accidental sharing risk | Keep out of version control; rotate if leaked |
| No git repository | No history, rollback, or CI | Initialize git and add CI checks |

### 13.3 Admin bootstrap

Admin is intentionally not a public role. To create an admin:

```sql
update public.profiles
set role = 'admin'
where email = 'real-admin@your-domain.com';
```

Run this with the service role or in the Supabase SQL editor. Never expose it through the
sign-up form.

---

## 14. Known gaps and deferred work

### 14.1 Integration blockers

1. **Cloudflare R2** — create three buckets, an Object Read & Write API token, apply CORS,
   optionally attach a public domain to `company-logos`, and fill the env values.
2. **Stripe** — create four one-time prices, set the webhook to
   `/api/webhooks/stripe` for `checkout.session.completed`, and fill the env values.

### 14.2 Product gaps

- Admin company verification toggles and credit adjustments are SQL-only.
- No transactional email (approval, rejection, unlock, new message).
- No candidate-side unlock notification.
- No in-app notification center.
- Analytics limited to total profile views.
- No saved searches, shortlists, or employer notes.
- No candidate application/interest flow; chat is employer-initiated after unlock.
- No company logo editing UI on web (API support exists).
- No admin user management UI.
- No refunds, invoices, or Stripe customer portal.
- Mobile admin review is not implemented (intentional).
- Mobile landing is an entry screen, not the full marketing page.

### 14.3 Engineering gaps

- No unit, integration, or E2E tests in the repository.
- No CI pipeline.
- No git repository initialized.
- No rate limiting or abuse controls.
- No observability (structured logs, metrics, tracing, error reporting).
- No background jobs for cleanup or notifications.
- No backup/restore runbook for the cloud database.
- No load testing of discovery/chat.
- No accessibility audit beyond semantic markup and labels.
- No internationalization.

### 14.4 Documentation gaps

- `README.md` has been corrected to describe the schema and to reflect that all five
  phases are complete.
- The sign-in page still shows a "Local demo accounts" box that does not apply to the cloud
  project. It should be hidden unless an explicit demo flag is set.

---

## 15. Runbook and next steps

### 15.1 Apply migrations and run the web app now

```bash
cd "/home/bannda/Desktop/University Talent Network (UTN)"
pnpm install

# Apply the employer consent + immutable certificate audit migration.
npx --yes supabase@latest db push --remote=jecdhhihbtaocbfzlljt

pnpm dev:web
# http://localhost:3000
```

The dev server is already running against the live Supabase project.

### 15.2 Run the mobile app

```bash
cd "/home/bannda/Desktop/University Talent Network (UTN)"
pnpm dev:mobile
# Scan the QR code with Expo Go, or press "a" for Android.
```

`apps/mobile/.env` points the API at the LAN address `http://192.168.70.72:3000`. Update it
if your machine's IP changes.

### 15.3 Enable R2

1. Create buckets `private-credentials`, `pitch-videos`, `company-logos`.
2. Create an R2 API token with Object Read & Write for those buckets.
3. Apply CORS to all three buckets:

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

4. Optionally attach a public domain/r2.dev URL to `company-logos` and set
   `R2_PUBLIC_LOGOS_BASE_URL`.
5. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
6. Restart `pnpm dev:web`.

### 15.4 Enable Stripe

1. Create one-time prices for the three credit packs and Priority Pro.
2. Fill `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and the four price IDs.
3. Add a webhook endpoint for `checkout.session.completed` pointing at
   `https://your-domain/api/webhooks/stripe`.
4. Fill `STRIPE_WEBHOOK_SECRET`.
5. For local testing, use the Stripe CLI to forward events.
6. Restart `pnpm dev:web`.

### 15.5 Recommended next actions

1. **Replace the placeholder admin email** with a real address and re-promote the account.
2. **Revoke the pasted Supabase PAT** at
   `https://supabase.com/dashboard/account/tokens`.
3. **Turn off `mailer_autoconfirm`** before any production deployment.
4. **Hide the stale demo-account box** on sign-in unless
   `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true`.
5. **Initialize git** and commit the current state.
6. **Add tests** for RLS, RPCs, and API authorization.
7. **Add rate limiting** and security headers.
8. **Add transactional email** for the core lifecycle events.
9. **Add admin company/credit tooling** to remove SQL-only operations.
10. **Configure R2 and Stripe** to complete the end-to-end demo.

---

## 16. Appendix

### 16.1 Local demo accounts (seed only)

These exist only after `pnpm db:reset` against a local Supabase stack. They do **not** exist
in the cloud project.

| Account | Email | Password | Role |
|---|---|---|---|
| Admin | `admin@utn.dev` | `UtnAdmin123!` | admin |
| Northwind Labs | `hiring@northwindlabs.com` | `HireNorthwind123!` | employer, 6 credits, Amara unlocked |
| Quantum Forge | `talent@quantumforge.io` | `HireQuantum123!` | employer, verified |
| Stealth Ventures | `people@stealthventures.co` | `HireStealth123!` | employer, unverified |
| Amara Okafor | `amara.okafor@gmail.com` | `Candidate123!` | candidate, verified, Priority Pro |
| Liam Chen | `liam.chen@outlook.com` | `Candidate123!` | candidate, pending |
| Sofia Reyes | `sofia.reyes@proton.me` | `Candidate123!` | candidate, rejected |

Seed media keys are placeholders, so certificate/video playback returns 404 until real
objects are uploaded.

### 16.2 Storage API examples

**Upload request**

```json
{
  "intent": "upload",
  "bucket": "private-credentials",
  "contentType": "application/pdf",
  "contentLength": 524288,
  "fileName": "degree.pdf",
  "videoDurationSeconds": null
}
```

**Upload response**

```json
{
  "intent": "upload",
  "bucket": "private-credentials",
  "key": "private-credentials/<candidate-uuid>/<uuid>.pdf",
  "uploadUrl": "https://...",
  "expiresAt": "2026-01-01T00:10:00.000Z",
  "requiredHeaders": {
    "Content-Type": "application/pdf",
    "Content-Length": "524288"
  }
}
```

**Download request**

```json
{
  "intent": "download",
  "bucket": "private-credentials",
  "key": "private-credentials/<candidate-uuid>/<uuid>.pdf"
}
```

### 16.3 Credit ledger reasons

| Reason | Delta | Reference | Idempotency |
|---|---|---|---|
| `signup_trial_credits` | +2 | Company id | One grant per company |
| `candidate_unlock` | -1 | Candidate id | Unique per company/reason/reference |
| `stripe_credit_pack` | +N | Hash-derived UUID from Stripe session | Unique per session |

### 16.4 Key files

| Concern | File |
|---|---|
| Root scripts | `package.json`, `turbo.json`, `pnpm-workspace.yaml` |
| Schema | `supabase/migrations/0001_initial_schema.sql` |
| Audit trail | `supabase/migrations/0002_verification_reviews.sql` |
| Degree verification compliance | `supabase/migrations/0003_degree_verification_compliance.sql` |
| Seed | `supabase/seed.sql` |
| Shared contracts | `packages/shared/src/{constants,schemas,types,helpers}.ts` |
| Design tokens | `packages/shared/design-tokens.cjs` |
| R2 client | `packages/storage/src/{config,keys,presign}.ts` |
| Env access | `apps/web/src/lib/env.ts` |
| Auth guards | `apps/web/src/middleware.ts`, `src/lib/auth/session.ts`, `src/lib/api/auth.ts` |
| Provisioning | `apps/web/src/lib/auth/provision.ts`, `src/app/api/auth/provision/route.ts` |
| Storage API | `apps/web/src/app/api/storage/presign/route.ts` |
| Verification API | `apps/web/src/app/api/verification/{ocr,finalize}/route.ts` |
| Admin API | `apps/web/src/app/api/admin/verification/route.ts` |
| Unlock API | `apps/web/src/app/api/employer/unlock/route.ts` |
| Stripe | `apps/web/src/app/api/stripe/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts` |
| Web verification studio | `apps/web/src/app/(app)/candidate/verification/verification-studio.tsx` |
| Mobile verification studio | `apps/mobile/components/verification-studio.tsx` |
| Realtime chat | `apps/web/src/components/chat/chat-thread.tsx` |
| Marquee | `apps/web/src/components/landing/logo-marquee.tsx` |
| Live env | `apps/web/.env.local`, `apps/mobile/.env` |

### 16.5 Glossary

| Term | Meaning |
|---|---|
| Unlock | Spending 1 credit to reveal contact details, certificate, and chat |
| Priority Pro | Candidate paid placement and view analytics |
| Verification | Admin approval of degree certificate + live pitch |
| Masked candidate | Pre-unlock display name derived from a hash |
| Entitlement | A `company_unlocked_candidates` row |
| Ledger | Append-only `credit_ledger`; balance is derived |
| Finalize | Server-side validation of uploaded certificate/video before review |
| RLS | PostgreSQL Row Level Security |

---

**End of report.**
