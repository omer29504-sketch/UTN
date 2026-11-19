-- ============================================================================
-- University Talent Network — Phase 10: UTN Core, Peer Community, Expiration
-- 0010_utn_core_community_and_expiration.sql
-- ============================================================================

begin;

-- ── 1. Profile readiness, grades & 6-month expiration ──────────────────────
alter table public.candidate_profiles
  add column if not exists academic_grade text,
  add column if not exists intake_readiness_level text
    check (intake_readiness_level is null or intake_readiness_level in ('foundational','intermediate','advanced')),
  add column if not exists intake_quiz_answers jsonb,
  add column if not exists profile_activated_at timestamptz,
  add column if not exists profile_expires_at timestamptz,
  add column if not exists renewal_cycle_count integer not null default 1;

comment on column public.candidate_profiles.profile_expires_at is
  '6-month active window end. Set to profile_activated_at + 6 months on admin approval.';

-- Auto-set expiry on approval: trigger
create or replace function public.set_profile_expiration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.verification_status = 'verified'
     and (old.verification_status is distinct from 'verified') then
    new.profile_activated_at := coalesce(new.profile_activated_at, now());
    new.profile_expires_at := new.profile_activated_at + interval '6 months';
    new.renewal_cycle_count := coalesce(old.renewal_cycle_count, 0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_verified_set_expiration on public.candidate_profiles;
create trigger on_profile_verified_set_expiration
  before update on public.candidate_profiles
  for each row execute function public.set_profile_expiration();

-- is_profile_active helper
create or replace function public.is_profile_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.candidate_profiles cp
    where cp.user_id = p_user_id
      and cp.verification_status = 'verified'
      and cp.profile_expires_at is not null
      and cp.profile_expires_at > now()
  );
$$;

-- ── 2. UTN Core question history ───────────────────────────────────────────
create table if not exists public.utn_core_question_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidate_profiles(user_id) on delete cascade,
  renewal_cycle integer not null default 1,
  question_hash text not null,
  question_text text not null,
  competency_dimension text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_utn_core_history_candidate_hash
  on public.utn_core_question_history (candidate_id, question_hash);
create index if not exists ix_utn_core_history_hash
  on public.utn_core_question_history (question_hash);
create index if not exists ix_utn_core_history_candidate
  on public.utn_core_question_history (candidate_id);

-- ── 3. Peer community daily view tracking ───────────────────────────────────
create table if not exists public.candidate_peer_views (
  id uuid primary key default gen_random_uuid(),
  viewer_candidate_id uuid not null references public.candidate_profiles(user_id) on delete cascade,
  target_candidate_id uuid not null references public.candidate_profiles(user_id) on delete cascade,
  viewed_question_index integer not null check (viewed_question_index between 1 and 4),
  viewed_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (viewer_candidate_id, target_candidate_id, viewed_date)
);

create index if not exists ix_peer_views_viewer_date
  on public.candidate_peer_views (viewer_candidate_id, viewed_date);

-- RPC: get_or_record_peer_clip_access
create or replace function public.get_or_record_peer_clip_access(
  p_viewer_id uuid,
  p_target_id uuid,
  p_question_index integer
)
returns table (
  clip_start_seconds integer,
  clip_end_seconds integer,
  question_text text,
  display_label text,
  major_specialization text,
  views_used_today integer,
  views_remaining_today integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_viewer_active boolean;
  v_target_active boolean;
  v_views_today integer;
  v_existing_index integer;
  v_questions jsonb;
  v_q jsonb;
  v_start int;
  v_end int;
  v_text text;
  v_label text;
  v_major text;
begin
  -- viewer must be verified + active
  select public.is_profile_active(p_viewer_id) into v_viewer_active;
  if not v_viewer_active then
    raise exception 'viewer_not_active' using errcode = '42501';
  end if;
  select public.is_profile_active(p_target_id) into v_target_active;
  if not v_target_active then
    raise exception 'target_not_active' using errcode = '42501';
  end if;
  if p_viewer_id = p_target_id then
    raise exception 'self_view_not_allowed' using errcode = '42501';
  end if;
  if p_question_index < 1 or p_question_index > 4 then
    raise exception 'invalid_question_index' using errcode = '22023';
  end if;

  -- count distinct peers viewed today
  select count(distinct target_candidate_id)
  into v_views_today
  from public.candidate_peer_views
  where viewer_candidate_id = p_viewer_id
    and viewed_date = current_date;

  -- check if already viewed this target today
  select viewed_question_index into v_existing_index
  from public.candidate_peer_views
  where viewer_candidate_id = p_viewer_id
    and target_candidate_id = p_target_id
    and viewed_date = current_date;

  if v_existing_index is not null then
    -- already viewed; return same clip, no new view counted
    null;
  else
    if v_views_today >= 2 then
      raise exception 'daily_limit_reached' using errcode = '42501';
    end if;
    insert into public.candidate_peer_views (viewer_candidate_id, target_candidate_id, viewed_question_index)
    values (p_viewer_id, p_target_id, p_question_index)
    on conflict (viewer_candidate_id, target_candidate_id, viewed_date) do nothing;
    v_views_today := v_views_today + 1;
  end if;

  -- fetch target's questions
  select m.video_session_questions into v_questions
  from public.candidate_media m
  where m.candidate_id = p_target_id;

  if v_questions is null or jsonb_array_length(v_questions) < p_question_index then
    raise exception 'no_questions' using errcode = 'P0002';
  end if;

  v_q := v_questions -> (p_question_index - 1);
  v_start := (v_q ->> 'start_offset_seconds')::int;
  v_end := least(v_start + 60, (v_q ->> 'end_offset_seconds')::int);
  v_text := v_q ->> 'question_text';

  -- exclude questions already assigned to viewer
  -- (viewer's own questions checked client-side; DB just returns target's)

  -- display label: First Name + Last Initial
  select cp.full_name into v_label from public.candidate_profiles cp where cp.user_id = p_target_id;
  -- mask: keep first name + last initial
  -- simple: split on space
  v_major := (select major_specialization from public.candidate_profiles where user_id = p_target_id);

  return query select
    v_start as clip_start_seconds,
    v_end as clip_end_seconds,
    v_text as question_text,
    (split_part(v_label, ' ', 1) || ' ' || left(split_part(v_label, ' ', 2), 1) || '.') as display_label,
    v_major as major_specialization,
    v_views_today as views_used_today,
    (2 - v_views_today) as views_remaining_today;
end;
$$;

-- ── 4. Update employer RPC to filter active profiles ────────────────────────
-- Add profile_expires_at filter to get_verified_candidates_for_employer
-- (recreate with active check)
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
  profile_expires_at timestamptz,
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

  select p.role into v_role from public.profiles p where p.id = auth.uid();
  if v_role is null then raise exception 'profile_missing' using errcode = '42501'; end if;

  if v_role = 'admin' then v_company_id := null;
  elsif v_role = 'employer' then
    select c.id into v_company_id from public.companies c where c.owner_id = auth.uid() limit 1;
    if v_company_id is null then raise exception 'company_profile_missing' using errcode = 'P0002'; end if;
  else raise exception 'employer_access_required' using errcode = '42501';
  end if;

  return query
  select
    cp.user_id as candidate_id,
    case when v_role = 'admin' or u.candidate_id is not null then cp.full_name
         else 'Verified Candidate #' || lpad((mod(hashtext(cp.user_id::text)::bigint + 2147483648, 10000))::text, 4, '0') end as display_name,
    cp.headline, cp.industry, cp.university_name, cp.major_specialization, cp.degree_level,
    cp.graduation_year, cp.experience_years, cp.is_featured,
    m.video_r2_key, m.video_duration_seconds, m.video_session_questions,
    (v_role = 'admin' or u.candidate_id is not null) as is_unlocked,
    not (v_role = 'admin' or u.candidate_id is not null) as certificate_locked,
    case when v_role = 'admin' or u.candidate_id is not null then cp.full_name end as full_name,
    case when v_role = 'admin' or u.candidate_id is not null then p.email end as email,
    case when v_role = 'admin' or u.candidate_id is not null then cp.phone end as phone,
    case when v_role = 'admin' or u.candidate_id is not null then m.certificate_r2_key end as certificate_r2_key,
    case when v_role = 'admin' or u.candidate_id is not null then m.cv_r2_key end as cv_r2_key,
    cp.profile_expires_at,
    count(*) over () as total_count
  from public.candidate_profiles cp
  join public.profiles p on p.id = cp.user_id
  left join public.candidate_media m on m.candidate_id = cp.user_id
  left join public.company_unlocked_candidates u on u.company_id = v_company_id and u.candidate_id = cp.user_id
  where cp.verification_status = 'verified'
    and (cp.profile_expires_at is null or cp.profile_expires_at > now())
    and (p_search is null or btrim(p_search) = '' or coalesce(cp.headline,'') ilike '%'||btrim(p_search)||'%' or cp.university_name ilike '%'||btrim(p_search)||'%' or coalesce(cp.industry,'') ilike '%'||btrim(p_search)||'%')
    and (p_industry is null or cp.industry = p_industry)
    and (p_degree_level is null or cp.degree_level = p_degree_level)
    and (p_university is null or btrim(p_university) = '' or cp.university_name ilike '%'||btrim(p_university)||'%')
    and (p_graduation_year is null or cp.graduation_year = p_graduation_year)
    and (p_max_experience_years is null or cp.experience_years <= p_max_experience_years)
    and (p_only_featured is not true or cp.is_featured)
  order by cp.is_featured desc, cp.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.get_verified_candidates_for_employer(text,text,text,text,integer,integer,boolean,integer,integer) from public, anon;
grant execute on function public.get_verified_candidates_for_employer(text,text,text,text,integer,integer,boolean,integer,integer) to authenticated, service_role;

-- Grants for new RPCs
revoke all on function public.is_profile_active(uuid) from public, anon;
grant execute on function public.is_profile_active(uuid) to authenticated, service_role;

revoke all on function public.get_or_record_peer_clip_access(uuid,uuid,integer) from public, anon;
grant execute on function public.get_or_record_peer_clip_access(uuid,uuid,integer) to authenticated, service_role;

commit;
