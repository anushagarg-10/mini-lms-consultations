-- =============================================================================
-- Profiles and roles
-- -----------------------------------------------------------------------------
-- Every auth user gets exactly one row in public.profiles, created by a trigger
-- on auth.users. The user's role lives here (NOT in user_metadata, which the
-- user can edit themselves via supabase.auth.updateUser()).
--
-- Authenticated users can read their own profile but cannot write to the table
-- at all, so nobody can promote themselves. Roles are changed by an operator
-- with the service role / database owner (see README and supabase/seed.sql).
-- =============================================================================

create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  role        public.app_role not null default 'student',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Holds the application role used for RBAC.';
comment on column public.profiles.role is 'Application role. Only writable by privileged database roles, never by end users.';

create index profiles_role_idx on public.profiles (role);

-- -----------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Create a profile whenever a user signs up. Everyone starts as a student.
-- SECURITY DEFINER because the signing-up user has no INSERT grant on profiles.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the denormalised email in sync if the user changes it.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Role helper used by RLS policies.
-- SECURITY DEFINER so it can read profiles without recursing through the
-- profiles RLS policies. STABLE so Postgres can cache it; policies wrap it in
-- a sub-select so it is evaluated once per statement, not once per row.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Trigger functions must never be callable directly through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges + RLS
-- Supabase grants ALL on new public tables to anon/authenticated by default,
-- so we revoke and grant back only what is needed (least privilege).
-- -----------------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));
