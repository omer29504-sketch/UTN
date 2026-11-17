# University Talent Network (UTN)

**Verified talent. Real potential.**

A two-sided recruitment platform where university graduates prove their credentials once,
and employers discover them through a short, unedited video pitch. Contact details,
certificates, and chat stay locked until an employer spends an unlock credit.

This repository is a **pnpm + Turborepo monorepo** with a Next.js 15 web app, an Expo
mobile app, Supabase (Postgres/Auth/Realtime/RLS), Cloudflare R2 object storage, and
Stripe billing.

---

## Phase status

| Phase | Scope                                                                                                                                                           | Status                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **1** | Monorepo, shared domain package, R2 storage package, complete Supabase schema + seed, secured `/api/storage/presign`, design-system foundation preview          | **Complete**                          |
| **2** | Auth flows, candidate verification (document upload + 60–120s live pitch), tesseract.js OCR, admin review, mobile verification studio                           | **Complete**                          |
| 3     | Employer onboarding, credit ledger, Stripe Checkout/webhooks, candidate discovery/unlock                                                                        | **Complete**                          |
| 4     | Landing page, unlimited logo marquee, Priority Pro analytics, realtime chat UI                                                                                  | **Complete**                          |
| 5     | Employer confidentiality consent, immutable document audit log, zero-download certificate streaming, anti-capture web canvas viewer, mobile screen-capture lock | **Complete** (apply migration `0004`) |

Phase 2 ships authentication, candidate onboarding and verification, admin review, and
the employer company profile. Phases 3–4 add employer discovery, credits, Stripe, the logo
marquee, Priority Pro analytics, and realtime chat. Phase 5 replaces employer certificate
downloads with an audited, watermarked, in-memory viewer on web and mobile.

---

## Repository layout

```
.
├── apps/
│   ├── web/                  Next.js 15 App Router (TypeScript, Tailwind, Lucide)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (app)/                         # Session-guarded role workspaces
│   │       │   │   ├── candidate/{profile,verification}/
│   │       │   │   ├── employer/company/
│   │       │   │   └── admin/verification/
│   │       │   ├── (auth)/{sign-in,sign-up}/
│   │       │   ├── api/
│   │       │   │   ├── admin/verification/route.ts
│   │       │   │   ├── auth/provision/route.ts
│   │       │   │   ├── employer/certificates/{[candidateId]/stream,security-event}/route.ts
│   │       │   │   ├── storage/presign/route.ts
│   │       │   │   └── verification/{finalize,ocr}/route.ts
│   │       │   ├── auth/callback/route.ts
│   │       │   ├── legal/employer-confidentiality/page.tsx
│   │       │   └── page.tsx                       # Phase 2 landing page
│   │       └── lib/
│   │           ├── api/                           # Bearer-token fetch helpers
│   │           ├── auth/                          # Session + role guards
│   │           ├── env.ts
│   │           └── supabase/{admin,auth,client,server}.ts
│   └── mobile/               Expo SDK 54 + Expo Router + NativeWind
│       ├── app/
│       │   ├── (auth)/{sign-in,sign-up}.tsx
│       │   ├── (app)/
│       │   │   ├── dashboard.tsx
│       │   │   ├── candidate/{profile,verification}.tsx
│       │   │   └── employer/{company,candidates,certificates/[candidateId]}.tsx
│       │   └── index.tsx                          # Phase 2 landing
│       ├── components/       # Shared UI, verification studio, app header
│       ├── lib/              # Supabase client, auth context, bearer API, uploads
│       └── app.json          # Camera/microphone permission plugins
├── packages/
│   ├── shared/               Zod schemas, domain types, constants, helpers, design tokens
│   │   ├── design-tokens.cjs # Single source of truth for colours/fonts/radii
│   │   └── src/
│   └── storage/              Cloudflare R2 (S3-compatible) client + presigning
├── supabase/
│   ├── config.toml           Local stack (Storage disabled — R2 owns files)
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_verification_reviews.sql
│   │   ├── 0003_degree_verification_compliance.sql
│   │   └── 0004_employer_certificate_confidentiality.sql
│   └── seed.sql              Local-only demo data with fixed UUIDs
├── scripts/
│   └── sync-pdfjs-worker.mjs # Copies the pdf.js worker into apps/web/public/pdfjs
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

Shared and storage packages export TypeScript source directly; Next transpiles them via
`transpilePackages`. There is no separate build step for the packages.

---

## Prerequisites

- Node.js **20.9+** (verified on Node 24)
- pnpm **9.15.4** via `corepack enable`
- Docker Desktop (for the local Supabase stack)
- A Cloudflare account with R2 enabled
- A Stripe account in test mode

---

## Quick start

```bash
corepack enable
pnpm install

cp .env.example apps/web/.env.local
# Fill in Supabase + R2 + Stripe values.

pnpm typecheck
pnpm --filter @utn/web build

pnpm dev:web
```

### Local Supabase

```bash
pnpm db:start       # supabase start (Docker required)
pnpm db:reset       # applies migrations + seed.sql
pnpm db:stop
```

`supabase/config.toml` disables built-in Storage because all binaries live in R2.
Copy the local API URL and anon/service-role keys printed by `supabase start` into
`apps/web/.env.local`. `pnpm db:reset` applies every migration in
`supabase/migrations/` and then the seed.

> Demo passwords are **local only**. Never reuse them in a deployed environment.

| Account          | Email                       | Password            | Role                                           |
| ---------------- | --------------------------- | ------------------- | ---------------------------------------------- |
| Admin            | `admin@utn.dev`             | `UtnAdmin123!`      | admin                                          |
| Northwind Labs   | `hiring@northwindlabs.com`  | `HireNorthwind123!` | employer (verified, 6 credits, Amara unlocked) |
| Quantum Forge    | `talent@quantumforge.io`    | `HireQuantum123!`   | employer (verified)                            |
| Stealth Ventures | `people@stealthventures.co` | `HireStealth123!`   | employer (unverified)                          |
| Amara Okafor     | `amara.okafor@gmail.com`    | `Candidate123!`     | candidate (verified, Priority Pro)             |
| Liam Chen        | `liam.chen@outlook.com`     | `Candidate123!`     | candidate (pending)                            |
| Sofia Reyes      | `sofia.reyes@proton.me`     | `Candidate123!`     | candidate (rejected, resubmission demo)        |

Seed media keys are placeholders, so certificate/video playback returns 404 until you
upload real objects through the app.

---

## Environment

All variables are documented in [`.env.example`](./.env.example). Highlights:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_PRIVATE_CREDENTIALS`, `R2_BUCKET_PITCH_VIDEOS`, `R2_BUCKET_COMPANY_LOGOS`
- `R2_PUBLIC_LOGOS_BASE_URL` (optional, public read domain for logos only)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_CREDITS_5`, `STRIPE_PRICE_CREDITS_15`, `STRIPE_PRICE_CREDITS_30`, `STRIPE_PRICE_CANDIDATE_PRO`

Environment reads are lazy and fail closed at request time, so `next build` works on a
machine without secrets.

---

## Cloudflare R2 setup

Create **three private buckets**:

1. `private-credentials` — university documents (PDF/JPG/PNG, ≤10 MB)
2. `pitch-videos` — live pitch recordings (WebM/MP4/MOV, ≤50 MB)
3. `company-logos` — logos (PNG/JPG/WebP/SVG, ≤2 MB)

Create an R2 API token with **Object Read & Write** for those buckets and put its
credentials in `.env.local`.

### Bucket CORS

Direct browser uploads require CORS on the bucket. Allow your web origin and the
`PUT`/`GET` headers that are signed by the presigner:

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

Apply this to all three buckets (mobile uses the same signed URLs).

### Public logos

`company-logos` can be exposed through an R2 custom domain or the r2.dev subdomain.
Set `R2_PUBLIC_LOGOS_BASE_URL` to that origin. Do **not** make the credentials or
pitch-video buckets public.

---

## Phase 2 flows

### Authentication

- **Web** uses `@supabase/ssr` cookie sessions for server-rendered pages, plus bearer
  tokens from `authFetch` for API routes. Route groups enforce session and role:
  `app/(auth)` redirects signed-in users, `app/(app)` redirects signed-out users, and
  `requireRole()` guards candidate/employer/admin pages server-side.
- **Mobile** uses `@supabase/supabase-js` with AsyncStorage persistence, PKCE, and an
  expo-crypto WebCrypto polyfill for Hermes. API calls send the access token as a
  bearer header.
- Account rows are provisioned idempotently by `provisionAccount`: `/api/auth/provision`
  handles immediate-session signups, and `/auth/callback` handles email-confirmation
  signups. Employer signups are rejected on consumer domains (gmail, yahoo, hotmail,
  outlook, icloud, and the full blocked list in `packages/shared/src/constants.ts`).

### Candidate verification

1. Candidate completes `/candidate/profile` (degree, university, graduation year,
   experience, optional industry/phone).
2. Candidate uploads a private certificate (PDF/JPG/PNG, ≤10 MB) to R2 through
   `/api/storage/presign`.
3. OCR runs server-side on raster images via tesseract.js. PDFs are explicitly skipped
   for manual review. Draft OCR results are upserted into `candidate_media` so the text
   survives until finalization.
4. Candidate records a live pitch from the camera only:
   - **Web** uses `navigator.mediaDevices.getUserMedia` + `MediaRecorder`.
   - **Mobile** uses `expo-camera` (`CameraView` / `recordAsync`, front-facing).
   - Submit unlocks at exactly 60 seconds; recording stops automatically at 120
     seconds. Gallery uploads are not offered.
5. `/api/verification/finalize` re-checks R2 object existence, exact size, content type,
   and owner-prefixed keys before writing `candidate_media` and moving the profile to
   `pending`.

### Admin review

- `/admin/verification` lists candidates awaiting a decision;
  `/admin/verification/[candidateId]` shows the profile, OCR text, a short-lived
  certificate link, and a short-lived pitch-video link.
- `POST /api/admin/verification` verifies the admin role, writes an append-only
  `verification_reviews` row first, then updates `candidate_profiles`. The audit row is
  removed if the profile update fails.
- Candidates see their full decision history on the verification page.

### Employer company profile

`/employer/company` creates or edits the company name and logo consent. The corporate
domain is derived from the verified email and is unique, so trial credits cannot be
farmed. Phase 2 does not expose candidate discovery or spending yet.

### Secure employer certificate viewer

Employers never receive a certificate file, presigned URL, or direct R2 link. Migration
`0004` adds `profiles.employer_tos_accepted_at` / `employer_tos_version` and the
append-only `document_access_logs` table.

1. **Click-through consent.** Before the first certificate, the employer must read the
   `EMPLOYER_CONFIDENTIALITY_CLAUSE` from `@utn/shared` and tick the mandatory
   acknowledgment. Acceptance is written to `profiles` and logged as `tos_accepted`.
2. **Zero-download stream.** `GET /api/employer/certificates/[candidateId]/stream`
   re-checks role, consent, unlock entitlement, and the certificate key, then reads the
   private R2 object server-side. It returns bytes with `no-store`/`no-cache` headers and
   writes a `certificate_viewed` audit row (IP, user agent, watermark signature). Mobile
   requests the same audited payload with `?format=base64`.
3. **In-memory rendering.** The web viewer paints PDFs (pdf.js) or images onto an HTML5
   `<canvas>`; no `<img src>`, blob URL, or `<a download>` exists in the DOM.
4. **Forensic watermark.** A diagonal watermark is burned into canvas pixels and mirrored
   as a `pointer-events-none` SVG overlay: employer name, email, short id, and UTC time,
   refreshed every minute.
5. **Anti-capture.** Right-click, selection, and drag are suppressed. Window blur and tab
   hiding cover the canvas with a privacy shield and log `focus_loss_blur`.
   `PrintScreen`, `Ctrl/Cmd+P`, `Ctrl/Cmd+S`, and `Ctrl/Cmd+Shift+I` blank the canvas and
   log `print_or_devtools_attempt`. `@media print` hides the viewer entirely.
6. **One-hour re-acknowledgment.** Every open shows the warning modal, and a 10-second
   interval re-locks the viewer after `CERTIFICATE_ACK_TTL_MS` (60 minutes). Confirming
   again logs `hourly_reack_completed`.
7. **Mobile lock.** The Expo screen mounts `usePreventScreenCapture()` (Android
   `FLAG_SECURE`, iOS recording protection), listens for screenshots, closes the
   document, warns the user, and logs `screenshot_attempt`. The same consent gate,
   one-hour gate, and watermark overlay apply.

The canonical legal copy is also published at `/legal/employer-confidentiality`.

---

## Storage API

`POST /api/storage/presign` is the only door to R2. It requires a Supabase bearer
token and derives every ownership decision server-side. Employer requests for
`private-credentials` are rejected with `403 use_secure_viewer`; certificates must go
through the audited stream above.

### Upload

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

Response:

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

The client **must** send `requiredHeaders` exactly; `Content-Type` and
`Content-Length` are part of the signature, so a browser cannot swap the file type or
inflate the upload size.

### Download

```json
{
  "intent": "download",
  "bucket": "private-credentials",
  "key": "private-credentials/<candidate-uuid>/<uuid>.pdf"
}
```

Authorization rules:

| Caller          | Pitch video                | Certificate                  | Company logo |
| --------------- | -------------------------- | ---------------------------- | ------------ |
| Admin           | Any                        | Any                          | Any          |
| Owner candidate | Own                        | Own                          | —            |
| Employer        | Any **verified** candidate | Only **unlocked** candidates | —            |

Certificate GET URLs expire after **5 minutes**; pitch-video GET URLs after **10
minutes**; upload PUT URLs after **10 minutes**. These are configurable through
`R2_PRESIGN_*_TTL_SECONDS`.

---

## Data model and business rules

Nine tables, all with RLS enabled, plus one public projection view:

- `profiles` — one row per auth user, role is `candidate | employer | admin`
- `candidate_profiles` — degree, university, verification state, Priority Pro flag
- `candidate_media` — private certificate key, pitch-video key, duration, OCR text
- `verification_reviews` — append-only admin decision audit trail (Phase 2)
- `companies` — one per employer, unique corporate domain, verification and logo consent
- `credit_ledger` — append-only; **balances are always derived**
- `company_unlocked_candidates` — paid entitlement rows
- `messages` — unlocked chat, realtime publication enabled
- `candidate_profile_views` — Priority Pro analytics
- `company_marquee` — anonymous-safe view for the landing-page logo marquee

Enforced in Postgres, not just the UI:

- **Verification transitions** are admin-managed. A candidate may only move
  `unverified/rejected → pending`, and only when both media assets exist with a
  60–120s video.
- **Media uploads lock** while a profile is `pending` or `verified`.
- **Self-verification and role escalation** are blocked by triggers and RLS.
- **Employer emails** on blocked consumer domains cannot create employer profiles.
  The company domain must match the owner's verified email domain.
- **Trial credits**: each new company receives exactly 2 credits (unique domain
  prevents farming).
- **Unlocks** are atomic: a per-company advisory lock plus a unique ledger reference
  prevent double-spending the last credit.
- **Contact data and certificate keys** are only returned by
  `get_verified_candidates_for_employer()` after an unlock. Names are masked as
  `Verified Candidate ####` before unlock.
- **Chat** requires an unlock, enforced by both RLS and a trigger.
- **Storage keys** must sit under the owner's UUID prefix and cannot contain `..`.
- **Verification decisions are append-only**: candidates can read their own review rows;
  only admins can insert; nobody can update or delete through the API grants
  (the service-role cleanup path deletes only a failed decision insert).

### Key RPCs

- `unlock_candidate(company_id, candidate_id)` → spends one credit, creates the
  entitlement, and is idempotent.
- `get_verified_candidates_for_employer(...)` → search/filter verified candidates with
  server-side masking.
- `get_my_credit_balance()` → derived balance for the signed-in employer.

---

## Scripts

| Command                        | Description                                |
| ------------------------------ | ------------------------------------------ |
| `pnpm dev:web`                 | Next.js dev server on `:3000`              |
| `pnpm build`                   | Turbo build (Next production build)        |
| `pnpm typecheck`               | TypeScript across all workspaces           |
| `pnpm format` / `format:check` | Prettier                                   |
| `pnpm db:start` / `db:stop`    | Local Supabase stack                       |
| `pnpm db:reset`                | Re-apply migrations and seed               |
| `pnpm db:push`                 | Push migrations to a linked remote project |

---

## Design system

Tokens live in `packages/shared/design-tokens.cjs` and are consumed by both Tailwind
configs. The palette is **Executive Slate & Alabaster**:

- Slate `#0F172A` / `#1E293B` for structure and text
- Alabaster `#F8FAFC` / `#FFFFFF` for surfaces
- Indigo `#4F46E5` for actions and links
- Emerald `#10B981` for verified marks and success states

Typography: **Plus Jakarta Sans** for headings, **Inter** for body copy. Both clients
load the fonts through bundled packages (`next/font` on web, `@expo-google-fonts` on
mobile), so previews render without network access.

---

## Security notes

- The Supabase **service-role key is server-only**. It is never imported into a
  client component; `apps/web/src/lib/supabase/admin.ts` is guarded by `server-only`
  semantics and used only by the presign route.
- RLS is enabled on every table. The service role bypasses RLS by design and is used
  only after explicit authorization checks in the API route.
- Presigned URLs are bearer capabilities: keep TTLs short and never log them.
- Stripe webhooks must verify signatures and use the ledger's unique
  `(company_id, reason, reference_id)` index for idempotency (Phase 3).
- The marquee view exposes only company id, name, logo key, and creation time.

---

## Verification and known limitations

Verified in this environment:

- `pnpm typecheck` across shared, storage, web, and mobile
- `pnpm --filter @utn/web build` (Next.js 15 production build)
- Expo Android export (`expo export --platform android`)
- PGlite suite applying **all three** migrations + seed twice, with **41/41**
  behavioral checks covering RLS, verification transitions, the review audit trail,
  registrar-consent enforcement, credits, masking, unlocks, the corporate-email gate,
  and chat
- tesseract.js OCR smoke test on a generated degree image (95% confidence)

Environment limitations:

- The cloud Supabase project `jecdhhihbtaocbfzlljt` is linked and all three migrations are
  applied. Candidate signup (profile trigger), employer provisioning (company + 2 trial
  credits), and the `chk_registrar_consent` constraint have been smoke-tested.
  Docker/Supabase CLI and `psql` remain unavailable here, so the local `pnpm db:reset`
  path is untested in this environment.
- No R2 credentials or live bucket exist locally, so finalize/OCR cannot be exercised
  end to end against R2.
- Real browser and mobile camera recording cannot be run headlessly. The camera-only
  flow, permission strings, 60s gate, and 120s cap are implemented and typechecked.
- Seed media keys are placeholders; certificate/video playback returns 404 until real
  uploads exist.
- The first OCR run downloads `eng.traineddata` through tesseract.js and caches it. In an
  offline deployment, pre-seed the cache directory (`utn-tesseract-cache` under the OS
  temp directory) or configure a reachable cache path.
- `supabase/config.toml` sets `enable_confirmations = false` for a frictionless local
  demo; production must enable email confirmation.

Phase 4 (complete) adds the landing page with an infinite corporate logo marquee,
Priority Pro profile-view analytics, and Supabase Realtime direct chat for unlocked
profiles. All planned phases are now complete.
