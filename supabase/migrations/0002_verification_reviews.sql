-- ============================================================================
-- University Talent Network — Phase 2: verification review audit trail
-- 0002_verification_reviews.sql
--
-- Additive migration. Verification decisions remain on candidate_profiles; this
-- table records who reviewed a submission, when, and why so candidates and
-- admins can see the history.
-- ============================================================================

begin;

create table if not exists public.verification_reviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null
    references public.candidate_profiles (user_id) on delete cascade,
  reviewer_id uuid
    references public.profiles (id) on delete set null,
  reviewer_email text not null,
  decision public.verification_status not null
    check (decision in ('verified', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now()
);

comment on table public.verification_reviews is
  'Immutable audit trail for admin verification decisions. Decisions live on candidate_profiles; this preserves history.';

comment on column public.verification_reviews.reviewer_email is
  'Snapshot of the reviewer email so the trail survives reviewer account deletion.';

create index if not exists verification_reviews_candidate_idx
  on public.verification_reviews (candidate_id, created_at desc);

create index if not exists verification_reviews_decision_idx
  on public.verification_reviews (decision, created_at desc);

alter table public.verification_reviews enable row level security;

-- Candidates can read their own review history; admins can read everything.
drop policy if exists verification_reviews_select_candidate_or_admin
  on public.verification_reviews;
create policy verification_reviews_select_candidate_or_admin
  on public.verification_reviews for select to authenticated
  using (candidate_id = auth.uid() or public.is_admin());

-- Direct admin inserts are permitted; the review API writes through the service
-- role after verifying the caller is an admin. Rows are intentionally immutable.
drop policy if exists verification_reviews_insert_admin
  on public.verification_reviews;
create policy verification_reviews_insert_admin
  on public.verification_reviews for insert to authenticated
  with check (public.is_admin() and reviewer_id = auth.uid());

revoke all on public.verification_reviews from anon;
grant select, insert on public.verification_reviews to authenticated;

commit;
