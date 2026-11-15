-- ============================================================================
-- University Talent Network — local development seed
-- ============================================================================
-- LOCAL DEVELOPMENT ONLY.
--
-- Demo accounts (password in parentheses):
--   admin@utn.dev              (UtnAdmin123!)     admin
--   hiring@northwindlabs.com   (HireNorthwind123!) employer / Northwind Labs
--   talent@quantumforge.io     (HireQuantum123!)   employer / Quantum Forge
--   people@stealthventures.co  (HireStealth123!)   employer / Stealth Ventures
--   amara.okafor@gmail.com     (Candidate123!)     verified candidate
--   liam.chen@outlook.com      (Candidate123!)     pending candidate
--   sofia.reyes@proton.me      (Candidate123!)     rejected candidate
--
-- Media keys are placeholders. Upload real files through the app to preview
-- certificates/videos end to end.
-- ============================================================================

begin;

-- ── Auth users ──────────────────────────────────────────────────────────────
-- Fixed UUIDs keep this seed idempotent across `supabase db reset` runs.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000001',
    'authenticated', 'authenticated', 'admin@utn.dev',
    extensions.crypt('UtnAdmin123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"admin","full_name":"UTN Admin"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000002',
    'authenticated', 'authenticated', 'hiring@northwindlabs.com',
    extensions.crypt('HireNorthwind123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"employer","full_name":"Nadia Cole"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000003',
    'authenticated', 'authenticated', 'talent@quantumforge.io',
    extensions.crypt('HireQuantum123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"employer","full_name":"Marcus Wei"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000004',
    'authenticated', 'authenticated', 'people@stealthventures.co',
    extensions.crypt('HireStealth123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"employer","full_name":"Priya Shah"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000010',
    'authenticated', 'authenticated', 'amara.okafor@gmail.com',
    extensions.crypt('Candidate123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"candidate","full_name":"Amara Okafor"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000011',
    'authenticated', 'authenticated', 'liam.chen@outlook.com',
    extensions.crypt('Candidate123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"candidate","full_name":"Liam Chen"}'::jsonb,
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-a000-000000000012',
    'authenticated', 'authenticated', 'sofia.reyes@proton.me',
    extensions.crypt('Candidate123!', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"candidate","full_name":"Sofia Reyes"}'::jsonb,
    '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-a000-000000000001',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000001', 'email', 'admin@utn.dev', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002',
   '00000000-0000-4000-a000-000000000002',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000002', 'email', 'hiring@northwindlabs.com', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000003',
   '00000000-0000-4000-a000-000000000003',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000003', 'email', 'talent@quantumforge.io', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000004',
   '00000000-0000-4000-a000-000000000004',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000004', 'email', 'people@stealthventures.co', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000010', '00000000-0000-4000-a000-000000000010',
   '00000000-0000-4000-a000-000000000010',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000010', 'email', 'amara.okafor@gmail.com', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000011',
   '00000000-0000-4000-a000-000000000011',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000011', 'email', 'liam.chen@outlook.com', 'email_verified', true),
   'email', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000012',
   '00000000-0000-4000-a000-000000000012',
   jsonb_build_object('sub', '00000000-0000-4000-a000-000000000012', 'email', 'sofia.reyes@proton.me', 'email_verified', true),
   'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;

-- The auth trigger creates profiles as candidate. Upsert the intended roles.
insert into public.profiles (id, email, role)
values
  ('00000000-0000-4000-a000-000000000001', 'admin@utn.dev', 'admin'),
  ('00000000-0000-4000-a000-000000000002', 'hiring@northwindlabs.com', 'employer'),
  ('00000000-0000-4000-a000-000000000003', 'talent@quantumforge.io', 'employer'),
  ('00000000-0000-4000-a000-000000000004', 'people@stealthventures.co', 'employer'),
  ('00000000-0000-4000-a000-000000000010', 'amara.okafor@gmail.com', 'candidate'),
  ('00000000-0000-4000-a000-000000000011', 'liam.chen@outlook.com', 'candidate'),
  ('00000000-0000-4000-a000-000000000012', 'sofia.reyes@proton.me', 'candidate')
on conflict (id) do update
  set email = excluded.email,
      role = excluded.role;

-- ── Candidate profiles ──────────────────────────────────────────────────────

insert into public.candidate_profiles (
  user_id, full_name, headline, industry, university_name, degree_level,
  graduation_year, experience_years, phone, verification_status, rejection_reason,
  is_featured, certificate_verification_ref, registrar_consent_given,
  registrar_consent_at
)
values
  (
    '00000000-0000-4000-a000-000000000010',
    'Amara Okafor',
    'Graduate software engineer building accessible fintech tools',
    'Technology',
    'University of Cape Town',
    'Bachelor''s Degree',
    2024, 1, '+27 82 555 0142', 'verified', null, true,
    'UCT-2024-004217', true, now() - interval '9 days'
  ),
  (
    '00000000-0000-4000-a000-000000000011',
    'Liam Chen',
    'Data science graduate · ML research and experimentation',
    'Technology',
    'University of Toronto',
    'Master''s Degree',
    2025, 0, '+1 416 555 0188', 'pending', null, false,
    'https://verify.utoronto.ca/cert/884920', true, now() - interval '3 days'
  ),
  (
    '00000000-0000-4000-a000-000000000012',
    'Sofia Reyes',
    'Brand strategist with agency and in-house experience',
    'Marketing',
    'Universidad de los Andes',
    'Bachelor''s Degree',
    2023, 2, '+57 310 555 0120', 'rejected',
    'The uploaded certificate is cropped and the degree title is not visible. Please re-upload a full-page scan.',
    false, 'UANDES-2023-77120', true, now() - interval '13 days'
  )
on conflict (user_id) do update
  set full_name = excluded.full_name,
      headline = excluded.headline,
      industry = excluded.industry,
      university_name = excluded.university_name,
      degree_level = excluded.degree_level,
      graduation_year = excluded.graduation_year,
      experience_years = excluded.experience_years,
      phone = excluded.phone,
      verification_status = excluded.verification_status,
      rejection_reason = excluded.rejection_reason,
      is_featured = excluded.is_featured,
      certificate_verification_ref = excluded.certificate_verification_ref,
      registrar_consent_given = excluded.registrar_consent_given,
      registrar_consent_at = excluded.registrar_consent_at;

-- ── Candidate verification media ────────────────────────────────────────────

insert into public.candidate_media (
  candidate_id, certificate_r2_key, video_r2_key, video_duration_seconds,
  ocr_extracted_text, submitted_at
)
values
  (
    '00000000-0000-4000-a000-000000000010',
    'private-credentials/00000000-0000-4000-a000-000000000010/seed-degree.pdf',
    'pitch-videos/00000000-0000-4000-a000-000000000010/seed-pitch.webm',
    72,
    'UNIVERSITY OF CAPE TOWN — Bachelor of Science in Computer Science — Amara N. Okafor — Conferred 12 December 2024 — Vice-Chancellor signature present.',
    now() - interval '8 days'
  ),
  (
    '00000000-0000-4000-a000-000000000011',
    'private-credentials/00000000-0000-4000-a000-000000000011/seed-degree.pdf',
    'pitch-videos/00000000-0000-4000-a000-000000000011/seed-pitch.webm',
    84,
    'UNIVERSITY OF TORONTO — Master of Science in Applied Computing — Liam Chen — Degree awarded June 2025.',
    now() - interval '2 days'
  ),
  (
    '00000000-0000-4000-a000-000000000012',
    'private-credentials/00000000-0000-4000-a000-000000000012/seed-degree.pdf',
    'pitch-videos/00000000-0000-4000-a000-000000000012/seed-pitch.webm',
    66,
    'UNIVERSIDAD DE LOS ANDES — Administración de Empresas — Sofia Reyes — 2023.',
    now() - interval '12 days'
  )
on conflict (candidate_id) do update
  set certificate_r2_key = excluded.certificate_r2_key,
      video_r2_key = excluded.video_r2_key,
      video_duration_seconds = excluded.video_duration_seconds,
      ocr_extracted_text = excluded.ocr_extracted_text,
      submitted_at = excluded.submitted_at;

-- The media sync trigger promotes rejected/unverified candidates to pending when
-- both assets exist. Restore Sofia's demo rejection state after that insert.
update public.candidate_profiles
set verification_status = 'rejected',
    rejection_reason = 'The uploaded certificate is cropped and the degree title is not visible. Please re-upload a full-page scan.'
where user_id = '00000000-0000-4000-a000-000000000012';

-- ── Verification review history ─────────────────────────────────────────────

insert into public.verification_reviews (
  id, candidate_id, reviewer_id, reviewer_email, decision,
  rejection_reason, created_at
)
values
  (
    '70000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000001',
    'admin@utn.dev',
    'verified',
    null,
    now() - interval '8 days'
  ),
  (
    '70000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000012',
    '00000000-0000-4000-a000-000000000001',
    'admin@utn.dev',
    'rejected',
    'The uploaded certificate is cropped and the degree title is not visible. Please re-upload a full-page scan.',
    now() - interval '12 days'
  )
on conflict (id) do nothing;

-- ── Companies ───────────────────────────────────────────────────────────────
-- The AFTER INSERT trigger grants 2 trial credits to each company.

insert into public.companies (
  id, owner_id, company_name, corporate_domain, logo_r2_key, is_verified,
  display_logo_consent
)
values
  (
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000002',
    'Northwind Labs', 'northwindlabs.com', null, true, true
  ),
  (
    '10000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003',
    'Quantum Forge', 'quantumforge.io', null, true, true
  ),
  (
    '10000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000004',
    'Stealth Ventures', 'stealthventures.co', null, false, false
  )
on conflict (id) do nothing;

-- A purchased pack for Northwind Labs (idempotent via ledger reference).
insert into public.credit_ledger (id, company_id, delta, reason, reference_id)
values (
  '50000000-0000-4000-a000-000000000001',
  '10000000-0000-4000-a000-000000000001',
  5,
  'credit_pack_purchase',
  '30000000-0000-4000-a000-000000000001'
)
on conflict do nothing;

-- Northwind has unlocked Amara: −1 credit, one entitlement row.
insert into public.credit_ledger (id, company_id, delta, reason, reference_id)
values (
  '50000000-0000-4000-a000-000000000002',
  '10000000-0000-4000-a000-000000000001',
  -1,
  'candidate_unlock',
  '00000000-0000-4000-a000-000000000010'
)
on conflict do nothing;

insert into public.company_unlocked_candidates (company_id, candidate_id, unlocked_at)
values (
  '10000000-0000-4000-a000-000000000001',
  '00000000-0000-4000-a000-000000000010',
  now() - interval '6 days'
)
on conflict do nothing;

-- ── Unlocked conversation ───────────────────────────────────────────────────

insert into public.messages (id, company_id, candidate_id, sender_id, body, created_at)
values
  (
    '40000000-0000-4000-a000-000000000001',
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000002',
    'Hi Amara — your pitch stood out, especially the accessibility work. Would you be open to a 20-minute intro call this week?',
    now() - interval '5 days'
  ),
  (
    '40000000-0000-4000-a000-000000000002',
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000010',
    'Thank you, Nadia. I would love that. Thursday afternoon works well for me.',
    now() - interval '4 days 22 hours'
  ),
  (
    '40000000-0000-4000-a000-000000000003',
    '10000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000010',
    '00000000-0000-4000-a000-000000000002',
    'Perfect — I have sent a calendar invite for 15:00 SAST. Looking forward to it.',
    now() - interval '4 days 20 hours'
  )
on conflict (id) do nothing;

-- ── Priority Pro analytics sample ───────────────────────────────────────────

insert into public.candidate_profile_views (id, candidate_id, viewer_company_id, viewed_at)
values
  (
    '60000000-0000-4000-a000-000000000001',
    '00000000-0000-4000-a000-000000000010',
    '10000000-0000-4000-a000-000000000001',
    now() - interval '6 days'
  ),
  (
    '60000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000010',
    '10000000-0000-4000-a000-000000000002',
    now() - interval '3 days'
  ),
  (
    '60000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000010',
    '10000000-0000-4000-a000-000000000001',
    now() - interval '1 day'
  )
on conflict (id) do nothing;

commit;
