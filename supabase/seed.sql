-- =============================================================================
-- Local development seed data. Runs on `supabase db reset` (never in prod).
--
--   admin@example.com    / Demo-VmbwANdcZj-Lms   (role: admin)
--   student@example.com  / Demo-VmbwANdcZj-Lms   (role: student)
--   student2@example.com / Demo-VmbwANdcZj-Lms   (role: student)
-- =============================================================================

create or replace function pg_temp.seed_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt('Demo-VmbwANdcZj-Lms', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

select pg_temp.seed_user('11111111-1111-1111-1111-111111111111', 'admin@example.com');
select pg_temp.seed_user('22222222-2222-2222-2222-222222222222', 'student@example.com');
select pg_temp.seed_user('33333333-3333-3333-3333-333333333333', 'student2@example.com');

-- Profiles were created by the on_auth_user_created trigger as students.
-- Promoting to admin is an operator action, done here as the database owner.
update public.profiles set role = 'admin' where email = 'admin@example.com';

insert into public.consultations (student_id, first_name, last_name, reason, scheduled_at) values
  ('22222222-2222-2222-2222-222222222222', 'Sam',   'Nguyen', 'Help with Methods Unit 3 calculus revision', date_trunc('hour', now()) + interval '2 days 10 hours'),
  ('22222222-2222-2222-2222-222222222222', 'Sam',   'Nguyen', 'Essay feedback for English SAC',              date_trunc('hour', now()) + interval '5 days 14 hours'),
  ('22222222-2222-2222-2222-222222222222', 'Sam',   'Nguyen', 'Study plan for exam period',                  date_trunc('hour', now()) + interval '9 days 16 hours'),
  ('33333333-3333-3333-3333-333333333333', 'Priya', 'Shah',   'Chemistry equilibrium questions',             date_trunc('hour', now()) + interval '3 days 11 hours'),
  ('33333333-3333-3333-3333-333333333333', 'Priya', 'Shah',   'Physics practice exam review',                date_trunc('hour', now()) + interval '6 days 15 hours');

-- Show the different states in the UI.
update public.consultations set completed_at = now()
  where reason = 'Study plan for exam period';
update public.consultations set status = 'cancelled'
  where reason = 'Physics practice exam review';
