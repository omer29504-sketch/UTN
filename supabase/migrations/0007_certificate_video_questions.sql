-- ============================================================================
-- University Talent Network — Phase 7: 4-question certificate-driven video
-- assessment
-- 0007_certificate_video_questions.sql
--
-- Additive migration. Adds the major/specialization field, the generated
-- 4-question assessment payload with recorded chapter timestamps, and keeps
-- the existing verification guards/RLS intact. Candidates only become
-- discoverable after an admin approves both the certificate and the
-- 4-question session.
-- ============================================================================

begin;

-- ── 1. University details: major / specialization ──────────────────────────
alter table public.candidate_profiles
  add column if not exists major_specialization text;

comment on column public.candidate_profiles.major_specialization is
  'Candidate major or specialization within their degree (drives the assessment questions).';

-- ── 2. Media metadata: 4-question assessment chapters ──────────────────────
alter table public.candidate_media
  add column if not exists video_session_questions jsonb,
  add column if not exists video_total_duration_seconds integer not null default 120,
  add column if not exists questions_generated_at timestamptz;

comment on column public.candidate_media.video_session_questions is
  'Generated 4-question assessment with exact chapter start/end offsets inside the single recorded video file.';

comment on column public.candidate_media.video_total_duration_seconds is
  'Total duration budget of the 4-question assessment (default 120 seconds).';

-- ── 3. Shape validation for the question payload ────────────────────────────
create or replace function public.is_valid_video_session_questions(p jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p is not null
    and jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) = 4
    and not exists (
      select 1
      from jsonb_array_elements(p) with ordinality as e(item, ord)
      where coalesce((e.item->>'index')::int, 0) <> e.ord::int
         or coalesce(e.item->>'question_text', '') = ''
         or coalesce((e.item->>'allocated_seconds')::int, 0) <= 0
         or (e.item->>'start_offset_seconds')::numeric < 0
         or (e.item->>'end_offset_seconds')::numeric <= (e.item->>'start_offset_seconds')::numeric
    )
    and coalesce((
      select sum((e.item->>'allocated_seconds')::int)
      from jsonb_array_elements(p) as e(item)
    ), 0) = 120
    and (p->0->>'start_offset_seconds')::numeric = 0
    and not exists (
      select 1
      from generate_series(2, 4) as i
      where (p->(i - 1)->>'start_offset_seconds')::numeric
            is distinct from (p->(i - 2)->>'end_offset_seconds')::numeric
    )
    and (p->3->>'end_offset_seconds')::numeric <= 120
  ;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'candidate_media_video_questions_shape'
      and conrelid = 'public.candidate_media'::regclass
  ) then
    alter table public.candidate_media
      add constraint candidate_media_video_questions_shape
      check (
        video_session_questions is null
        or public.is_valid_video_session_questions(video_session_questions)
      );
  end if;
end;
$$;

-- ── 4. Refresh guard_candidate_media: questions are part of a submission ────
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
     and new.video_duration_seconds between 60 and 120
     and new.video_session_questions is not null
     and public.is_valid_video_session_questions(new.video_session_questions) then
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

-- ── 5. Refresh sync_candidate_submission: questions required for promotion ──
create or replace function public.sync_candidate_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.certificate_r2_key is not null
     and new.video_r2_key is not null
     and new.video_duration_seconds between 60 and 120
     and new.video_session_questions is not null
     and public.is_valid_video_session_questions(new.video_session_questions) then
    update public.candidate_profiles
    set verification_status = 'pending',
        rejection_reason = null
    where user_id = new.candidate_id
      and verification_status in ('unverified', 'rejected');
  end if;

  return new;
end;
$$;

-- ── 6. Refresh protect_candidate_fields: media must include questions ───────
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

  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.is_featured is distinct from old.is_featured then
    raise exception 'featured_status_is_admin_managed' using errcode = '42501';
  end if;

  if new.verification_status is distinct from old.verification_status then
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
          and m.video_session_questions is not null
          and public.is_valid_video_session_questions(m.video_session_questions)
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

-- ── 7. Employer discovery RPC: expose major + assessment chapters ───────────
drop function if exists public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
);

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
  major_specialization text,
  degree_level text,
  graduation_year integer,
  experience_years integer,
  is_featured boolean,
  video_r2_key text,
  video_duration_seconds integer,
  video_session_questions jsonb,
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
    cp.major_specialization,
    cp.degree_level,
    cp.graduation_year,
    cp.experience_years,
    cp.is_featured,
    m.video_r2_key,
    m.video_duration_seconds,
    m.video_session_questions,
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

-- ── 8. Grants ────────────────────────────────────────────────────────────────
revoke all on function public.is_valid_video_session_questions(jsonb) from public, anon;
grant execute on function public.is_valid_video_session_questions(jsonb) to authenticated, service_role;

revoke all on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) from public, anon;
grant execute on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) to authenticated, service_role;

commit;
