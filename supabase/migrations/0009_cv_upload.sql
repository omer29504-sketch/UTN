-- ============================================================================
-- University Talent Network — Phase 9: separate PDF CV upload
-- 0009_cv_upload.sql
--
-- Additive. A candidate's CV is a distinct private document from their degree
-- certificate. It is optional (not a submission gate) but, when present, it
-- must live under the private-credentials prefix and is gated behind the same
-- 1-credit employer unlock + watermarked stream as the certificate.
-- ============================================================================

begin;

-- ── 1. Add cv_r2_key column ────────────────────────────────────────────────
alter table public.candidate_media
  add column if not exists cv_r2_key text;

comment on column public.candidate_media.cv_r2_key is
  'Optional PDF CV uploaded by the candidate (private-credentials prefix).';

-- ── 2. Refresh guard: validate cv key prefix too ─────────────────────────────
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

  if new.cv_r2_key is not null then
    if position('..' in new.cv_r2_key) > 0
       or new.cv_r2_key not like 'private-credentials/' || new.candidate_id::text || '/%' then
      raise exception 'invalid_cv_storage_key' using errcode = '23514';
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

-- ── 3. Employer discovery RPC: expose cv_r2_key (masked until unlock) ───────
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
  certificate_locked boolean,
  full_name text,
  email text,
  phone text,
  certificate_r2_key text,
  cv_r2_key text,
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
    not (v_role = 'admin' or u.candidate_id is not null) as certificate_locked,
    case when v_role = 'admin' or u.candidate_id is not null then cp.full_name end as full_name,
    case when v_role = 'admin' or u.candidate_id is not null then p.email end as email,
    case when v_role = 'admin' or u.candidate_id is not null then cp.phone end as phone,
    case when v_role = 'admin' or u.candidate_id is not null then m.certificate_r2_key end as certificate_r2_key,
    case when v_role = 'admin' or u.candidate_id is not null then m.cv_r2_key end as cv_r2_key,
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

revoke all on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) from public, anon;
grant execute on function public.get_verified_candidates_for_employer(
  text, text, text, text, integer, integer, boolean, integer, integer
) to authenticated, service_role;

commit;
