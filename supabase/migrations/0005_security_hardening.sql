-- ============================================================================
-- University Talent Network — Phase 5: security hardening
-- 0005_security_hardening.sql
--
-- Additive migration. Closes two Postgres defaults that are easy to overlook:
--
--   1. Every new function is executable by PUBLIC (which includes `anon`).
--      That makes credit/discovery RPCs reachable by unauthenticated callers
--      through PostgREST, even though RLS protects the tables underneath.
--   2. Trigger functions without an explicit `search_path` are vulnerable to
--      shadowing when a caller can create objects in an earlier schema.
--
-- Nothing here changes behaviour for signed-in users: the same functions are
-- re-granted to `authenticated` and `service_role`.
-- ============================================================================

begin;

-- ── 1. Callable RPCs: signed-in users and the service role only ─────────────
do $$
declare
  fn text;
  callable text[] := array[
    'public.is_blocked_consumer_domain(text)',
    'public.is_consumer_email(text)',
    'public.is_admin()',
    'public.current_user_role()',
    'public.current_company_id()',
    'public.is_company_owner(uuid)',
    'public.has_unlocked(uuid,uuid)',
    'public.company_credit_balance(uuid)',
    'public.get_my_credit_balance()',
    'public.unlock_candidate(uuid,uuid)',
    'public.get_verified_candidates_for_employer(text,text,text,text,integer,integer,boolean,integer,integer)'
  ];
begin
  foreach fn in array callable loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- ── 2. Trigger functions: not directly callable, fixed search_path ──────────
-- Trigger functions return `trigger` and cannot be invoked over RPC. Removing
-- PUBLIC/anon EXECUTE shrinks the surface; triggers themselves are unaffected
-- because privilege checks happen at CREATE TRIGGER time, not fire time.
do $$
declare
  fn text;
  trigger_fns text[] := array[
    'public.set_updated_at()',
    'public.normalize_profile_email()',
    'public.handle_new_user()',
    'public.protect_profile_role()',
    'public.protect_candidate_fields()',
    'public.guard_candidate_media()',
    'public.sync_candidate_submission()',
    'public.validate_company_domain()',
    'public.protect_company_fields()',
    'public.grant_signup_credits()',
    'public.enforce_message_unlock()',
    'public.prevent_document_access_log_mutation()'
  ];
begin
  foreach fn in array trigger_fns loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('alter function %s set search_path = public, pg_temp', fn);
  end loop;
end;
$$;

comment on function public.unlock_candidate(uuid, uuid) is
  'Atomic credit-backed unlock. Executable by authenticated and service_role only; anon EXECUTE was revoked in 0005.';

commit;
