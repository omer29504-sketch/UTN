-- ============================================================================
-- University Talent Network — initial schema
-- 0001_initial_schema.sql
--
-- Idempotent, transaction-safe migration for a Supabase Postgres project.
-- Principles:
--   * Every public table has RLS enabled.
--   * Balances are derived from an immutable credit ledger, never stored.
--   * Candidate contact data is only readable through an unlock-aware RPC.
--   * Verification transitions and corporate-domain checks are enforced in DB.
-- ============================================================================

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── Enums ───────────────────────────────────────────────────────────────────

do $$
begin
  create type public.user_role as enum ('candidate', 'employer', 'admin');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
exception
  when duplicate_object then null;
end;
$$;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.user_role not null default 'candidate',
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Role is assigned at signup (candidate/employer) or by an admin.';

create table if not exists public.candidate_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  headline text,
  industry text,
  university_name text not null,
  degree_level text not null,
  graduation_year integer not null check (graduation_year between 1950 and 2100),
  experience_years integer not null default 0 check (experience_years between 0 and 60),
  phone text,
  verification_status public.verification_status not null default 'unverified',
  rejection_reason text,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.candidate_profiles.is_featured is
  'Priority Pro pin. Admin/Stripe-managed; candidates cannot self-promote.';

create table if not exists public.candidate_media (
  candidate_id uuid primary key references public.candidate_profiles (user_id) on delete cascade,
  certificate_r2_key text,
  video_r2_key text,
  video_duration_seconds integer,
  ocr_extracted_text text,
  submitted_at timestamptz,
  constraint candidate_media_duration_check check (
    video_duration_seconds is null
    or (video_duration_seconds >= 60 and video_duration_seconds <= 120)
  )
);

comment on constraint candidate_media_duration_check on public.candidate_media is
  'Live pitch must be at least 60 seconds and no more than 120 seconds.';

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  company_name text not null,
  corporate_domain text not null unique,
  logo_r2_key text,
  is_verified boolean not null default false,
  display_logo_consent boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.companies is
  'One company per employer owner. Corporate domain is unique to prevent trial-credit farming.';

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.credit_ledger is
  'Append-only ledger. Balance = SUM(delta); there is deliberately no balance column.';

create table if not exists public.company_unlocked_candidates (
  company_id uuid not null references public.companies (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (company_id, candidate_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.candidate_profile_views (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  viewer_company_id uuid not null references public.companies (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

comment on table public.candidate_profile_views is
  'Supports Priority Pro analytics. Rows are written by verified employers.';

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists candidate_profiles_status_idx
  on public.candidate_profiles (verification_status);

create index if not exists candidate_profiles_discovery_idx
  on public.candidate_profiles (verification_status, is_featured desc, updated_at desc);

create index if not exists candidate_profiles_filters_idx
  on public.candidate_profiles (industry, degree_level, university_name, graduation_year);

create index if not exists candidate_profiles_experience_idx
  on public.candidate_profiles (experience_years);

create index if not exists credit_ledger_company_idx
  on public.credit_ledger (company_id, created_at desc);

-- Guarantees Stripe webhook / signup grants are applied at most once.
create unique index if not exists credit_ledger_reference_unique
  on public.credit_ledger (company_id, reason, reference_id)
  where reference_id is not null;

create index if not exists unlocked_candidates_candidate_idx
  on public.company_unlocked_candidates (candidate_id);

create index if not exists messages_conversation_idx
  on public.messages (company_id, candidate_id, created_at);

create index if not exists messages_sender_idx
  on public.messages (sender_id);

create index if not exists profile_views_candidate_idx
  on public.candidate_profile_views (candidate_id, viewed_at desc);

-- ── Security helpers ────────────────────────────────────────────────────────

create or replace function public.is_blocked_consumer_domain(p_domain text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select lower(btrim(coalesce(p_domain, ''))) = any (
    array[
      'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
      'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
      'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
      'gmx.com', 'mail.com', 'zoho.com'
    ]::text[]
  );
$$;

create or replace function public.is_consumer_email(p_email text)
returns boolean
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select public.is_blocked_consumer_domain(split_part(lower(btrim(coalesce(p_email, ''))), '@', 2));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.companies c
  where c.owner_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_company_owner(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = p_company_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.has_unlocked(p_company_id uuid, p_candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.company_unlocked_candidates u
    where u.company_id = p_company_id
      and u.candidate_id = p_candidate_id
  );
$$;

create or replace function public.company_credit_balance(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(l.delta), 0)::integer
  from public.credit_ledger l
  where l.company_id = p_company_id;
$$;

create or replace function public.get_my_credit_balance()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(l.delta), 0)::integer
  from public.credit_ledger l
  where l.company_id = public.current_company_id();
$$;

-- ── Trigger functions ───────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_profile_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_email text;
begin
  v_email := lower(btrim(coalesce(new.email, '')));
  if v_email = '' then
    raise exception 'email_required' using errcode = '23502';
  end if;

  v_role := case
    when coalesce(new.raw_user_meta_data ->> 'role', '') = 'employer' then 'employer'::public.user_role
    else 'candidate'::public.user_role
  end;

  -- Admins are provisioned deliberately (seed / SQL), never through public signup.
  if v_role = 'employer' and public.is_blocked_consumer_domain(split_part(v_email, '@', 2)) then
    raise exception 'corporate_email_required' using errcode = '23514';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, v_email, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Signup normally creates the row through handle_new_user(). If a client ever
  -- inserts its own row (e.g. retry after a failed trigger), it must not be able
  -- to mint an admin or skip the corporate-email gate.
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      if new.role = 'admin' then
        raise exception 'only_admins_can_create_admin_profiles' using errcode = '42501';
      end if;

      if new.role = 'employer'
         and public.is_blocked_consumer_domain(split_part(new.email, '@', 2)) then
        raise exception 'corporate_email_required' using errcode = '23514';
      end if;
    end if;

    return new;
  end if;

  if new.id <> old.id then
    raise exception 'profile_id_immutable' using errcode = '23514';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only_admins_can_change_roles' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_candidate_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_complete_media boolean;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_admin() then
      if new.verification_status <> 'unverified'
         or new.is_featured
         or new.rejection_reason is not null then
        raise exception 'initial_verification_fields_must_be_default' using errcode = '42501';
      end if;
    end if;

    return new;
  end if;

  if new.user_id <> old.user_id then
    raise exception 'candidate_user_id_immutable' using errcode = '23514';
  end if;

  -- Service-role context (auth.uid() is null) and admins may review freely.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.is_featured is distinct from old.is_featured then
    raise exception 'featured_status_is_admin_managed' using errcode = '42501';
  end if;

  if new.verification_status is distinct from old.verification_status then
    -- The only self-service transition allowed is rejected/unverified → pending,
    -- and only after both verification assets exist. Everything else is admin.
    if new.verification_status = 'pending'
       and old.verification_status in ('unverified', 'rejected')
       and (
         new.rejection_reason is null
         or new.rejection_reason is not distinct from old.rejection_reason
       ) then
      select exists (
        select 1
        from public.candidate_media m
        where m.candidate_id = old.user_id
          and m.certificate_r2_key is not null
          and m.video_r2_key is not null
          and m.video_duration_seconds between 60 and 120
      ) into v_has_complete_media;

      if v_has_complete_media then
        return new;
      end if;
    end if;

    raise exception 'verification_status_is_admin_managed' using errcode = '42501';
  end if;

  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'rejection_reason_is_admin_managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_candidate_media()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.verification_status;
begin
  if new.certificate_r2_key is not null then
    if position('..' in new.certificate_r2_key) > 0
       or new.certificate_r2_key not like 'private-credentials/' || new.candidate_id::text || '/%' then
      raise exception 'invalid_certificate_storage_key' using errcode = '23514';
    end if;
  end if;

  if new.video_r2_key is not null then
    if position('..' in new.video_r2_key) > 0
       or new.video_r2_key not like 'pitch-videos/' || new.candidate_id::text || '/%' then
      raise exception 'invalid_video_storage_key' using errcode = '23514';
    end if;
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if new.candidate_id <> auth.uid() then
      raise exception 'candidate_media_owner_mismatch' using errcode = '42501';
    end if;

    select cp.verification_status
    into v_status
    from public.candidate_profiles cp
    where cp.user_id = new.candidate_id;

    if v_status in ('pending', 'verified') then
      raise exception 'media_locked_during_review' using errcode = '42501';
    end if;
  end if;

  if new.certificate_r2_key is not null
     and new.video_r2_key is not null
     and new.video_duration_seconds between 60 and 120 then
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

create or replace function public.sync_candidate_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.certificate_r2_key is not null
     and new.video_r2_key is not null
     and new.video_duration_seconds between 60 and 120 then
    update public.candidate_profiles
    set verification_status = 'pending',
        rejection_reason = null
    where user_id = new.candidate_id
      and verification_status in ('unverified', 'rejected');
  end if;

  return new;
end;
$$;

create or replace function public.validate_company_domain()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_email text;
  v_owner_domain text;
begin
  new.corporate_domain := lower(btrim(new.corporate_domain));

  if new.corporate_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    raise exception 'invalid_corporate_domain' using errcode = '23514';
  end if;

  if public.is_blocked_consumer_domain(new.corporate_domain) then
    raise exception 'corporate_email_required' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.owner_id
      and p.role = 'employer'
  ) then
    raise exception 'employer_profile_required' using errcode = '23514';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    select lower(btrim(p.email))
    into v_owner_email
    from public.profiles p
    where p.id = new.owner_id;

    v_owner_domain := split_part(coalesce(v_owner_email, ''), '@', 2);

    if v_owner_domain = '' or v_owner_domain <> new.corporate_domain then
      raise exception 'email_domain_must_match_company_domain' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.protect_company_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.owner_id <> auth.uid() then
        raise exception 'company_owner_must_be_current_user' using errcode = '42501';
      end if;

      if new.is_verified then
        raise exception 'company_verification_is_admin_managed' using errcode = '42501';
      end if;
    elsif new.owner_id is distinct from old.owner_id
       or new.corporate_domain is distinct from old.corporate_domain
       or new.is_verified is distinct from old.is_verified then
      raise exception 'company_verification_fields_are_admin_managed' using errcode = '42501';
    end if;
  end if;

  if new.logo_r2_key is not null then
    if position('..' in new.logo_r2_key) > 0
       or new.logo_r2_key not like 'company-logos/' || new.id::text || '/%' then
      raise exception 'invalid_company_logo_storage_key' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.grant_signup_credits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.credit_ledger (company_id, delta, reason, reference_id)
  values (new.id, 2, 'signup_trial_credits', new.id)
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.enforce_message_unlock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.company_unlocked_candidates u
    where u.company_id = new.company_id
      and u.candidate_id = new.candidate_id
  ) then
    raise exception 'candidate_not_unlocked' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.sender_id
      and (
        p.id = new.candidate_id
        or p.id = (
          select c.owner_id
          from public.companies c
          where c.id = new.company_id
        )
      )
  ) then
    raise exception 'sender_is_not_a_conversation_participant' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ── Triggers ────────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_normalize_email on public.profiles;
create trigger profiles_normalize_email
  before insert or update of email on public.profiles
  for each row execute function public.normalize_profile_email();

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

drop trigger if exists candidate_profiles_updated_at on public.candidate_profiles;
create trigger candidate_profiles_updated_at
  before update on public.candidate_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists candidate_profiles_protect_fields on public.candidate_profiles;
create trigger candidate_profiles_protect_fields
  before insert or update on public.candidate_profiles
  for each row execute function public.protect_candidate_fields();

drop trigger if exists candidate_media_guard on public.candidate_media;
create trigger candidate_media_guard
  before insert or update on public.candidate_media
  for each row execute function public.guard_candidate_media();

drop trigger if exists candidate_media_sync_submission on public.candidate_media;
create trigger candidate_media_sync_submission
  after insert or update on public.candidate_media
  for each row execute function public.sync_candidate_submission();

drop trigger if exists companies_validate_domain on public.companies;
create trigger companies_validate_domain
  before insert or update of corporate_domain, owner_id on public.companies
  for each row execute function public.validate_company_domain();

drop trigger if exists companies_protect_fields on public.companies;
create trigger companies_protect_fields
  before insert or update on public.companies
  for each row execute function public.protect_company_fields();

drop trigger if exists companies_grant_signup_credits on public.companies;
create trigger companies_grant_signup_credits
  after insert on public.companies
  for each row execute function public.grant_signup_credits();

drop trigger if exists messages_enforce_unlock on public.messages;
create trigger messages_enforce_unlock
  before insert on public.messages
  for each row execute function public.enforce_message_unlock();

-- ── Atomic unlock RPC ───────────────────────────────────────────────────────

create or replace function public.unlock_candidate(
  p_company_id uuid,
  p_candidate_id uuid
)
returns table (
  success boolean,
  already_unlocked boolean,
  credit_balance integer,
  message text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select c.owner_id
  into v_owner_id
  from public.companies c
  where c.id = p_company_id;

  if v_owner_id is null then
    return query select false, false, null::integer, 'company_not_found'::text;
    return;
  end if;

  if v_owner_id <> auth.uid() and not public.is_admin() then
    raise exception 'not_company_owner' using errcode = '42501';
  end if;

  -- Serialize unlocks per company so two concurrent requests cannot both spend
  -- the final credit.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));

  if exists (
    select 1
    from public.company_unlocked_candidates u
    where u.company_id = p_company_id
      and u.candidate_id = p_candidate_id
  ) then
    v_balance := public.company_credit_balance(p_company_id);
    return query select true, true, v_balance, 'already_unlocked'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.candidate_profiles cp
    where cp.user_id = p_candidate_id
      and cp.verification_status = 'verified'
  ) then
    v_balance := public.company_credit_balance(p_company_id);
    return query select false, false, v_balance, 'candidate_not_verified'::text;
    return;
  end if;

  v_balance := public.company_credit_balance(p_company_id);
  if v_balance < 1 then
    return query select false, false, v_balance, 'insufficient_credits'::text;
    return;
  end if;

  insert into public.credit_ledger (company_id, delta, reason, reference_id)
  values (p_company_id, -1, 'candidate_unlock', p_candidate_id);

  insert into public.company_unlocked_candidates (company_id, candidate_id)
  values (p_company_id, p_candidate_id)
  on conflict do nothing;

  v_balance := public.company_credit_balance(p_company_id);
  return query select true, false, v_balance, 'unlocked'::text;

exception
  when unique_violation then
    -- Idempotent re-entry (e.g. a retried request after a network timeout).
    insert into public.company_unlocked_candidates (company_id, candidate_id)
    values (p_company_id, p_candidate_id)
    on conflict do nothing;

    v_balance := public.company_credit_balance(p_company_id);
    return query select true, true, v_balance, 'already_unlocked'::text;
end;
$$;

-- ── Employer discovery RPC (masking lives here, not in the client) ──────────

create or replace function public.get_verified_candidates_for_employer(
  p_search text default null,
  p_industry text default null,
  p_degree_level text default null,
  p_university text default null,
  p_graduation_year integer default null,
  p_max_experience_years integer default null,
  p_only_featured boolean default false,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  candidate_id uuid,
  display_name text,
  headline text,
  industry text,
  university_name text,
  degree_level text,
  graduation_year integer,
  experience_years integer,
  is_featured boolean,
  video_r2_key text,
  video_duration_seconds integer,
  is_unlocked boolean,
  full_name text,
  email text,
  phone text,
  certificate_r2_key text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role public.user_role;
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = auth.uid();

  if v_role is null then
    raise exception 'profile_missing' using errcode = '42501';
  end if;

  if v_role = 'admin' then
    v_company_id := null;
  elsif v_role = 'employer' then
    select c.id
    into v_company_id
    from public.companies c
    where c.owner_id = auth.uid()
    limit 1;

    if v_company_id is null then
      raise exception 'company_profile_missing' using errcode = 'P0002';
    end if;
  else
    raise exception 'employer_access_required' using errcode = '42501';
  end if;

  return query
  select
    cp.user_id as candidate_id,
    case
      when v_role = 'admin' or u.candidate_id is not null then cp.full_name
      else 'Verified Candidate #' || lpad(
        (mod(hashtext(cp.user_id::text)::bigint + 2147483648, 10000))::text,
        4,
        '0'
      )
    end as display_name,
    cp.headline,
    cp.industry,
    cp.university_name,
    cp.degree_level,
    cp.graduation_year,
    cp.experience_years,
    cp.is_featured,
    m.video_r2_key,
    m.video_duration_seconds,
    (v_role = 'admin' or u.candidate_id is not null) as is_unlocked,
    case when v_role = 'admin' or u.candidate_id is not null then cp.full_name end as full_name,
    case when v_role = 'admin' or u.candidate_id is not null then p.email end as email,
    case when v_role = 'admin' or u.candidate_id is not null then cp.phone end as phone,
    case when v_role = 'admin' or u.candidate_id is not null then m.certificate_r2_key end as certificate_r2_key,
    count(*) over () as total_count
  from public.candidate_profiles cp
  join public.profiles p on p.id = cp.user_id
  left join public.candidate_media m on m.candidate_id = cp.user_id
  left join public.company_unlocked_candidates u
    on u.company_id = v_company_id
   and u.candidate_id = cp.user_id
  where cp.verification_status = 'verified'
    and (
      p_search is null
      or btrim(p_search) = ''
      or coalesce(cp.headline, '') ilike '%' || btrim(p_search) || '%'
      or cp.university_name ilike '%' || btrim(p_search) || '%'
      or coalesce(cp.industry, '') ilike '%' || btrim(p_search) || '%'
    )
    and (p_industry is null or cp.industry = p_industry)
    and (p_degree_level is null or cp.degree_level = p_degree_level)
    and (p_university is null or btrim(p_university) = '' or cp.university_name ilike '%' || btrim(p_university) || '%')
    and (p_graduation_year is null or cp.graduation_year = p_graduation_year)
    and (p_max_experience_years is null or cp.experience_years <= p_max_experience_years)
    and (p_only_featured is not true or cp.is_featured)
  order by cp.is_featured desc, cp.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- ── Public marquee view (safe columns only; no RLS leakage) ─────────────────

create or replace view public.company_marquee
with (security_invoker = false) as
select
  c.id,
  c.company_name,
  c.logo_r2_key,
  c.created_at
from public.companies c
where c.is_verified = true
  and c.display_logo_consent = true
order by c.created_at asc;

comment on view public.company_marquee is
  'Anonymous-safe employer marquee projection. Contains no contact, domain, or owner data.';

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.candidate_media enable row level security;
alter table public.companies enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.company_unlocked_candidates enable row level security;
alter table public.messages enable row level security;
alter table public.candidate_profile_views enable row level security;

-- profiles
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles for insert to authenticated
  with check (id = auth.uid() and role <> 'admin');

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- candidate_profiles
drop policy if exists candidate_profiles_select_own_or_admin on public.candidate_profiles;
create policy candidate_profiles_select_own_or_admin
  on public.candidate_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists candidate_profiles_insert_self on public.candidate_profiles;
create policy candidate_profiles_insert_self
  on public.candidate_profiles for insert to authenticated
  with check (user_id = auth.uid() and public.current_user_role() = 'candidate');

drop policy if exists candidate_profiles_update_own_or_admin on public.candidate_profiles;
create policy candidate_profiles_update_own_or_admin
  on public.candidate_profiles for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- candidate_media: employers never read this table directly; the RPC exposes
-- only the video key and the presign API checks entitlements.
drop policy if exists candidate_media_select_own_or_admin on public.candidate_media;
create policy candidate_media_select_own_or_admin
  on public.candidate_media for select to authenticated
  using (candidate_id = auth.uid() or public.is_admin());

drop policy if exists candidate_media_insert_self on public.candidate_media;
create policy candidate_media_insert_self
  on public.candidate_media for insert to authenticated
  with check (candidate_id = auth.uid() and public.current_user_role() = 'candidate');

drop policy if exists candidate_media_update_own_or_admin on public.candidate_media;
create policy candidate_media_update_own_or_admin
  on public.candidate_media for update to authenticated
  using (candidate_id = auth.uid() or public.is_admin())
  with check (candidate_id = auth.uid() or public.is_admin());

-- companies
drop policy if exists companies_select_owner_or_admin on public.companies;
create policy companies_select_owner_or_admin
  on public.companies for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists companies_insert_employer_self on public.companies;
create policy companies_insert_employer_self
  on public.companies for insert to authenticated
  with check (owner_id = auth.uid() and public.current_user_role() = 'employer');

drop policy if exists companies_update_owner_or_admin on public.companies;
create policy companies_update_owner_or_admin
  on public.companies for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists companies_delete_admin on public.companies;
create policy companies_delete_admin
  on public.companies for delete to authenticated
  using (public.is_admin());

-- credit_ledger: append-only, admins/service-role only for writes.
drop policy if exists credit_ledger_select_owner_or_admin on public.credit_ledger;
create policy credit_ledger_select_owner_or_admin
  on public.credit_ledger for select to authenticated
  using (public.is_company_owner(company_id) or public.is_admin());

drop policy if exists credit_ledger_insert_admin on public.credit_ledger;
create policy credit_ledger_insert_admin
  on public.credit_ledger for insert to authenticated
  with check (public.is_admin());

-- company_unlocked_candidates
drop policy if exists unlocked_select_participant_or_admin on public.company_unlocked_candidates;
create policy unlocked_select_participant_or_admin
  on public.company_unlocked_candidates for select to authenticated
  using (
    candidate_id = auth.uid()
    or public.is_company_owner(company_id)
    or public.is_admin()
  );

drop policy if exists unlocked_insert_admin on public.company_unlocked_candidates;
create policy unlocked_insert_admin
  on public.company_unlocked_candidates for insert to authenticated
  with check (public.is_admin());

drop policy if exists unlocked_delete_admin on public.company_unlocked_candidates;
create policy unlocked_delete_admin
  on public.company_unlocked_candidates for delete to authenticated
  using (public.is_admin());

-- messages: strict participants + unlock gate (also enforced by trigger).
drop policy if exists messages_select_participant_or_admin on public.messages;
create policy messages_select_participant_or_admin
  on public.messages for select to authenticated
  using (
    candidate_id = auth.uid()
    or public.is_company_owner(company_id)
    or public.is_admin()
  );

drop policy if exists messages_insert_unlocked_participant on public.messages;
create policy messages_insert_unlocked_participant
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.has_unlocked(company_id, candidate_id)
    and (candidate_id = auth.uid() or public.is_company_owner(company_id))
  );

-- candidate_profile_views
drop policy if exists profile_views_select_own_or_admin on public.candidate_profile_views;
create policy profile_views_select_own_or_admin
  on public.candidate_profile_views for select to authenticated
  using (candidate_id = auth.uid() or public.is_admin());

drop policy if exists profile_views_insert_verified_employer on public.candidate_profile_views;
create policy profile_views_insert_verified_employer
  on public.candidate_profile_views for insert to authenticated
  with check (
    viewer_company_id = public.current_company_id()
    and exists (
      select 1
      from public.candidate_profiles cp
      where cp.user_id = candidate_id
        and cp.verification_status = 'verified'
    )
  );

-- ── Realtime for unlocked chat ──────────────────────────────────────────────

alter table public.messages replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ── Grants (defense in depth; RLS still applies) ────────────────────────────

revoke all on public.company_marquee from public;
grant select on public.company_marquee to anon, authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.current_user_role() from public;
revoke all on function public.current_company_id() from public;
revoke all on function public.is_company_owner(uuid) from public;
revoke all on function public.has_unlocked(uuid, uuid) from public;
revoke all on function public.company_credit_balance(uuid) from public;
revoke all on function public.get_my_credit_balance() from public;
revoke all on function public.unlock_candidate(uuid, uuid) from public;
revoke all on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_company_owner(uuid) to authenticated;
grant execute on function public.has_unlocked(uuid, uuid) to authenticated;
grant execute on function public.get_my_credit_balance() to authenticated;
grant execute on function public.unlock_candidate(uuid, uuid) to authenticated;
grant execute on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) to authenticated;

commit;
