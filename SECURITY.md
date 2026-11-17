# Security

This document describes how University Talent Network is hardened, what must be
configured outside the repository, and how to respond to an incident. It is
written for maintainers, not marketing.

## Reporting a vulnerability

Email **security@your-domain.example** with a description and reproduction
steps. Please do not open a public issue. We aim to acknowledge within two
business days.

---

## 1. Controls implemented in this repository

| Area          | Control                                                                      | Where                                                               |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Authorization | Bearer-token verification + role lookup on every API route                   | `apps/web/src/lib/api/auth.ts`                                      |
| Authorization | RLS on every public table, role-escalation triggers                          | `supabase/migrations/0001_initial_schema.sql`                       |
| Authorization | Candidate cannot self-verify; admin-only status changes                      | `protect_candidate_fields()`                                        |
| Rate limiting | Per-IP pre-auth budget + per-user route budgets, Upstash or in-memory        | `apps/web/src/lib/security/rate-limit.ts`                           |
| Request size  | 64 KiB cap on JSON API bodies; 512 KiB on Stripe webhooks                    | `apps/web/src/lib/api/auth.ts`, `api/webhooks/stripe/route.ts`      |
| CSRF          | Origin/Host validation on state-changing requests                            | `apps/web/src/lib/security/origin.ts`                               |
| Headers       | CSP, HSTS, nosniff, frame-ancestors, Permissions-Policy, COOP/CORP           | `apps/web/next.config.ts`                                           |
| Uploads       | Signed Content-Type/Content-Length, owner-prefixed keys, magic-byte sniffing | `packages/storage/src/presign.ts`, `packages/shared/src/helpers.ts` |
| Uploads       | SVG removed from the public logo allowlist (script-carrying format)          | `packages/shared/src/constants.ts`                                  |
| Certificates  | Zero-download stream, watermark, fail-closed audit write                     | `api/employer/certificates/[candidateId]/stream/route.ts`           |
| Payments      | Stripe signature verification + idempotent credit ledger                     | `api/webhooks/stripe/route.ts`                                      |
| OCR           | Per-user quota, per-instance concurrency cap, byte + magic-byte checks       | `api/verification/ocr/route.ts`                                     |
| Database      | `anon`/`PUBLIC` EXECUTE revoked on RPCs, fixed `search_path`                 | `supabase/migrations/0005_security_hardening.sql`                   |
| Supply chain  | Dependency audit, secret scan, weekly Dependabot updates                     | `.github/workflows/security.yml`, `.github/dependabot.yml`          |
| Logging       | Structured JSON security events with field redaction                         | `apps/web/src/lib/security/log.ts`                                  |

### Known limitations

- **CSP still allows inline scripts.** Next.js injects a bootstrap script. Moving
  to a nonce-based policy requires forcing the statically rendered routes to
  render dynamically; do it when the marketing surface stabilises.
- **In-memory rate limiting is per instance.** Set `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` for a global limit. Without them the effective
  limit is `limit × instance count`.
- **DRM is deterrence, not prevention.** A determined viewer can screenshot.
  The audit trail (`document_access_logs`) is the enforcement mechanism.
- **Content sniffing covers PDF/JPEG/PNG/WebP/MP4/WebM/QuickTime.** It rejects
  mislabeled files but is not an antivirus engine.
- **Dependency advisories are reported, not all patched.** `pnpm audit --prod`
  currently flags PostCSS (build-time), Zod 3 (memory exhaustion on oversized
  constrained collections — mitigated by the 64 KiB body cap), and Expo CLI
  build tooling. Dependabot is configured to open the upgrade PRs; Zod 4 is a
  major bump and needs its own regression pass.

---

## 2. Required configuration outside the repository

These cannot be set in code. Treat them as part of the release checklist.

### Supabase

1. **Authentication → Providers → Email:** require email confirmation.
2. **Authentication → Passwords:** enable leaked-password protection; minimum
   length 12; require a mix of character classes.
3. **Authentication → Rate limits:** keep the built-in limits enabled and lower
   the signup/OTP limits for production.
4. **Authentication → Attack protection:** enable CAPTCHA (Turnstile/hCaptcha)
   for sign-up and sign-in.
5. **MFA:** enable TOTP. Require it for every `admin` account and strongly
   prompt employers. Admin accounts without MFA are the highest-risk path to a
   full data breach because the service-role key sits behind them.
6. **Sessions:** keep refresh-token rotation on; set a bounded JWT expiry;
   revoke sessions on password change.
7. **Database → SSL enforcement:** on.
8. **Database → Network restrictions:** allowlist IPv4 ranges that need direct
   Postgres access (migrations/CI). The app uses PostgREST and does not.
9. **Database → Backups:** enable PITR; run a restore drill quarterly.
10. **Advisors:** clear every Security Advisor finding (RLS disabled, mutable
    `search_path`, exposed schemas) after each migration.
11. **Log drains:** ship Postgres and Auth logs to your log platform.

### Cloudflare R2

1. `private-credentials` and `pitch-videos` are **private** buckets. No public
   access, no custom domain, no `r2.dev` URL.
2. Only `company-logos` may have a public domain (`R2_PUBLIC_LOGOS_BASE_URL`).
3. Enable **object versioning** on the private buckets.
4. Enable **Object Lock** (governance mode) on `private-credentials` so audit
   evidence cannot be silently overwritten.
5. Create a scoped API token limited to the three buckets, not an account-wide
   token. Rotate every 90 days.

### Stripe

1. Enable Radar rules for card testing and mismatched country/billing data.
2. Restrict the webhook endpoint to `checkout.session.completed`.
3. Rotate the webhook secret on team changes; update
   `STRIPE_WEBHOOK_SECRET` in the same deploy.
4. Use separate Stripe accounts (or at least separate keys) for test and live.

### Hosting / edge

1. Put Cloudflare (or the platform firewall) in front of the app.
2. Enable managed WAF rules, Bot Fight Mode, and DDoS protection.
3. Add rate-limit rules for `/api/*` and `/auth/*` at the edge as a second
   layer.
4. Keep production secrets out of preview deployments. Preview branches must
   never point at the production Supabase project.
5. Enforce HTTPS and keep HSTS preload enabled.

---

## 3. Secrets

| Secret                      | Used by                  | Rotation                |
| --------------------------- | ------------------------ | ----------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | API routes, provisioning | 90 days or on suspicion |
| `R2_SECRET_ACCESS_KEY`      | Storage package          | 90 days                 |
| `STRIPE_SECRET_KEY`         | Checkout + webhook       | 90 days                 |
| `STRIPE_WEBHOOK_SECRET`     | Webhook verification     | on endpoint change      |
| `UPSTASH_REDIS_REST_TOKEN`  | Rate limiter             | 90 days                 |

Rules:

- Never expose a server secret through a `NEXT_PUBLIC_*` variable.
- Never log a token, cookie, or full request body.
- Use a secret manager (Doppler/1Password/Vercel env) rather than `.env` files
  on developer machines for production values.
- If `SUPABASE_SERVICE_ROLE_KEY` leaks: rotate immediately, review
  `document_access_logs`, `credit_ledger`, and `profiles.role` for anomalies,
  and force a global sign-out.

---

## 4. Monitoring and alerting

The app emits one JSON line per security event (`"level":"security"`). Configure
alerts on:

| Event                             | Meaning                                 |
| --------------------------------- | --------------------------------------- |
| `api_cross_origin_blocked`        | Possible CSRF probing                   |
| `api_ip_rate_limited`             | Flood or credential stuffing            |
| `api_user_rate_limited`           | Abusive authenticated account           |
| `api_invalid_token`               | Token guessing / expired clients        |
| `stripe_webhook_rate_limited`     | Forged webhook flood                    |
| `document_access_logs` anomalies  | Bulk certificate access by one employer |
| Stripe `invalid_signature` errors | Webhook forgery attempts                |
| 5xx rate on `/api/*`              | Outage or exploit attempt               |

Also alert on: credit ledger rows created without a matching Stripe session,
role changes in `profiles`, and new `admin` rows.

---

## 5. Incident response

1. **Contain:** revoke the affected credential, disable the account, and, if the
   database is involved, rotate the service-role key and force sign-out.
2. **Preserve:** export relevant `document_access_logs`, Postgres logs, and edge
   logs before cleanup.
3. **Assess:** determine which tables/objects were reachable. RLS limits most
   lateral movement; the service-role key does not.
4. **Notify:** affected users and, where required, the supervisory authority
   within 72 hours (GDPR Art. 33).
5. **Remediate:** patch, add a regression test or alert, and document the
   timeline.
6. **Review:** blameless post-mortem within five business days.

---

## 6. Data protection and retention

- Candidate certificates, pitch videos, and OCR text are personal data. Keep
  the retention window short and documented.
- Account deletion cascades through `auth.users`; `document_access_logs`
  intentionally survives as audit evidence and must be covered by the privacy
  notice.
- Do not run face recognition or biometric analysis on pitch videos without
  explicit consent and a DPIA.
- Keep DPAs on file for Supabase, Stripe, Cloudflare, and your hosting provider.

---

## 7. Roadmap

- Nonce-based CSP.
- Mandatory MFA gate in middleware for `/admin`.
- Magic-byte validation on the finalize path (currently OCR + viewer only).
- Malware scanning for uploaded PDFs.
- Annual penetration test and a tabletop incident-response exercise.
- SOC 2 Type I scoping once enterprise customers require it.
