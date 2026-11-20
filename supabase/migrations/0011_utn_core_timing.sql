-- ============================================================================
-- University Talent Network — Phase 11: UTN Core timing (7s display + 25s answer)
-- 0011_utn_core_timing.sql
-- ============================================================================

begin;

-- Update duration constraint on candidate_media
alter table public.candidate_media
  drop constraint if exists candidate_media_duration_check;

alter table public.candidate_media
  add constraint candidate_media_duration_check
  check (video_duration_seconds is null or (video_duration_seconds >= 60 and video_duration_seconds <= 133));

-- Refresh guard: update duration bounds
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

    select cp.verification_status into v_status
    from public.candidate_profiles cp
    where cp.user_id = new.candidate_id;

    if v_status in ('pending', 'verified') then
      raise exception 'media_locked_during_review' using errcode = '42501';
    end if;
  end if;

  if new.certificate_r2_key is not null
     and new.video_r2_key is not null
     and new.video_duration_seconds between 60 and 133
     and new.video_session_questions is not null
     and public.is_valid_video_session_questions(new.video_session_questions) then
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

-- Refresh sync_candidate_submission
create or replace function public.sync_candidate_submission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.certificate_r2_key is not null
     and new.video_r2_key is not null
     and new.video_duration_seconds between 60 and 133
     and new.video_session_questions is not null
     and public.is_valid_video_session_questions(new.video_session_questions) then
    update public.candidate_profiles
    set verification_status = 'pending', rejection_reason = null
    where user_id = new.candidate_id
      and verification_status in ('unverified', 'rejected');
  end if;
  return new;
end;
$$;

-- Refresh protect_candidate_fields (duration bounds)
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
       and (new.rejection_reason is null or new.rejection_reason is not distinct from old.rejection_reason) then
      select exists (
        select 1 from public.candidate_media m
        where m.candidate_id = old.user_id
          and m.certificate_r2_key is not null
          and m.video_r2_key is not null
          and m.video_duration_seconds between 60 and 133
          and m.video_session_questions is not null
          and public.is_valid_video_session_questions(m.video_session_questions)
      ) into v_has_complete_media;
      if v_has_complete_media then return new; end if;
    end if;
    raise exception 'verification_status_is_admin_managed' using errcode = '42501';
  end if;

  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'rejection_reason_is_admin_managed' using errcode = '42501';
  end if;

  return new;
end;
$$;

commit;
