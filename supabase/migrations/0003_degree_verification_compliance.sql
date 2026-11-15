-- ============================================================================
-- University Talent Network — Phase 3: degree verification compliance
-- 0003_degree_verification_compliance.sql
--
-- Additive migration. Adds the candidate-provided verification reference
-- (university verification URL or certificate serial) and the registrar
-- consent audit fields. Consent is mandatory before a submission can move
-- past 'unverified', so the database enforces the same rule as the clients.
-- ============================================================================

begin;

alter table public.candidate_profiles
  add column if not exists certificate_verification_ref text,
  add column if not exists registrar_consent_given boolean not null default false,
  add column if not exists registrar_consent_at timestamptz;

comment on column public.candidate_profiles.certificate_verification_ref is
  'Optional university verification URL or certificate serial supplied by the candidate.';

comment on column public.candidate_profiles.registrar_consent_given is
  'True when the candidate authorized UTN to contact their university registrar or official verification portal.';

comment on column public.candidate_profiles.registrar_consent_at is
  'Timestamp recorded when the candidate granted registrar verification consent.';

-- A submission may only leave 'unverified' when registrar consent is on file.
-- Rejected profiles also require consent because a resubmission is still a
-- degree-verification request.
--
-- Added NOT VALID so rows created before this migration (which never recorded
-- consent) do not block the deploy. The constraint is still enforced for every
-- insert and update. We validate it immediately when no legacy rows violate it.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_registrar_consent'
      and conrelid = 'public.candidate_profiles'::regclass
  ) then
    alter table public.candidate_profiles
      add constraint chk_registrar_consent
      check (verification_status = 'unverified' or registrar_consent_given)
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from public.candidate_profiles
    where verification_status <> 'unverified'
      and not registrar_consent_given
  ) then
    alter table public.candidate_profiles
      validate constraint chk_registrar_consent;
  end if;
end;
$$;

comment on constraint chk_registrar_consent on public.candidate_profiles is
  'Non-unverified verification statuses require registrar_consent_given = true.';

-- Candidates write these fields through the finalize API (service role) during
-- onboarding. RLS already scopes updates to the candidate or an admin; these
-- grants keep parity with the default Supabase table privileges.
grant select, insert, update on public.candidate_profiles to authenticated;

commit;
