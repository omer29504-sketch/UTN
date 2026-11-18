-- ============================================================================
-- University Talent Network — Phase 8: certificate-locked flag for employers
-- 0008_certificate_locked_flag.sql
--
-- Additive. Exposes an explicit `certificate_locked` boolean in the employer
-- discovery RPC so unpaid employers can gate the UI without inferring from a
-- null storage key. RLS/RPC masking is unchanged: the real key is still only
-- returned after an unlock.
-- ============================================================================

begin;

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
