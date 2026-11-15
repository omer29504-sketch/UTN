-- ============================================================================
-- University Talent Network — Phase 4: employer certificate confidentiality
-- 0004_employer_certificate_confidentiality.sql
--
-- Additive migration. Introduces:
--   1. Employer click-through consent tracking for the Confidentiality and
--      Credential Security Clause (per-employer, versioned).
--   2. An append-only forensic audit log for every access to a private
--      candidate credential, written by the secure streaming API.
--
-- Design notes:
--   * Consent lives on public.profiles because employers are profiles with
--     role = 'employer'; there is no separate employer_profiles table.
--   * document_access_logs is append-only: RLS exposes INSERT to the owning
--     employer and SELECT to admins, and an UPDATE trigger raises. Rows are
--     removed only by an account-deletion cascade (auth.users -> employer_id),
--     which is required for data-erasure requests.
--   * candidate_id is intentionally not a foreign key: audit evidence must
--     survive candidate-profile deletion.
-- ============================================================================

begin;

-- ── 1. Employer confidentiality consent tracking ────────────────────────────

alter table public.profiles
  add column if not exists employer_tos_accepted_at timestamptz,
  add column if not exists employer_tos_version text;

comment on column public.profiles.employer_tos_accepted_at is
  'Timestamp of the employer click-through acceptance of the Confidentiality and Credential Security Clause. NULL means the employer has never accepted and must be gated from all candidate certificates.';

comment on column public.profiles.employer_tos_version is
  'Version string of the accepted clause (see EMPLOYER_TOS_VERSION in @utn/shared). Bumped when the legal copy changes.';

-- A recorded acceptance must always carry the version that was accepted.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_employer_tos_version'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint chk_employer_tos_version
      check (employer_tos_accepted_at is null or employer_tos_version is not null);
  end if;
end;
$$;

comment on constraint chk_employer_tos_version on public.profiles is
  'employer_tos_version is mandatory once employer_tos_accepted_at is recorded.';

-- ── 2. Immutable document security audit log ────────────────────────────────

create table if not exists public.document_access_logs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references auth.users (id) on delete cascade,
  candidate_id uuid not null,
  event_type text not null,
  ip_address text,
  user_agent text,
  watermark_signature text,
  created_at timestamptz not null default now(),
  constraint document_access_logs_event_type_check check (
    event_type in (
      'tos_accepted',
      'certificate_viewed',
      'hourly_reack_completed',
      'focus_loss_blur',
      'screenshot_attempt',
      'print_or_devtools_attempt'
    )
  )
);

comment on table public.document_access_logs is
  'Append-only forensic audit trail of employer access to confidential candidate credentials. Never updated or deleted by the application.';

comment on column public.document_access_logs.candidate_id is
  'Candidate user id. Deliberately not a foreign key so audit evidence survives candidate deletion.';

comment on column public.document_access_logs.watermark_signature is
  'The forensic watermark rendered over the document for this access (employer, email, short id, UTC timestamp).';

comment on column public.document_access_logs.ip_address is
  'Originating IP captured from x-forwarded-for / x-real-ip at the edge.';

create index if not exists document_access_logs_employer_idx
  on public.document_access_logs (employer_id, created_at desc);

create index if not exists document_access_logs_candidate_idx
  on public.document_access_logs (candidate_id, created_at desc);

create index if not exists document_access_logs_event_idx
  on public.document_access_logs (event_type, created_at desc);

-- Updates are impossible for every role, including service role.
create or replace function public.prevent_document_access_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'document_access_logs_is_append_only' using errcode = '42501';
end;
$$;

drop trigger if exists document_access_logs_no_update on public.document_access_logs;
create trigger document_access_logs_no_update
  before update on public.document_access_logs
  for each row execute function public.prevent_document_access_log_mutation();

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.document_access_logs enable row level security;

-- Employers may append their own telemetry. No UPDATE/DELETE policies exist,
-- so authenticated clients can never rewrite history.
drop policy if exists document_access_logs_insert_own on public.document_access_logs;
create policy document_access_logs_insert_own
  on public.document_access_logs for insert to authenticated
  with check (
    employer_id = auth.uid()
    and public.current_user_role() = 'employer'
  );

-- Admins can audit the full trail.
drop policy if exists document_access_logs_select_admin on public.document_access_logs;
create policy document_access_logs_select_admin
  on public.document_access_logs for select to authenticated
  using (public.is_admin());

-- Defense in depth: no table-wide privileges beyond append/read.
revoke all on public.document_access_logs from public;
revoke all on public.document_access_logs from anon;
grant select, insert on public.document_access_logs to authenticated;

commit;
