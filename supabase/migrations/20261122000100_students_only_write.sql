-- =============================================================================
-- Only students book and manage consultations
-- -----------------------------------------------------------------------------
-- The brief gives each role one job: students book and manage their own
-- consultations; admins see every consultation, read-only. Previously any
-- signed-in user (admins included) could book for themselves. This migration
-- makes the write policies require the `student` role, so an admin is
-- read-only at the database level even when calling the API directly.
-- =============================================================================

-- Role helper, mirroring is_admin(): SECURITY DEFINER so it can read profiles
-- without recursing through RLS; STABLE so policies can evaluate it once per
-- statement via a sub-select.
create or replace function public.is_student()
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
      and role = 'student'
  );
$$;

revoke all on function public.is_student() from public, anon;
grant execute on function public.is_student() to authenticated;

-- Replace the write policies with student-only versions.
drop policy "Students can book consultations for themselves" on public.consultations;
drop policy "Students can update their own consultations" on public.consultations;

create policy "Students can book consultations for themselves"
  on public.consultations for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and (select public.is_student())
  );

create policy "Students can update their own consultations"
  on public.consultations for update
  to authenticated
  using (
    student_id = (select auth.uid())
    and (select public.is_student())
  )
  with check (
    student_id = (select auth.uid())
    and (select public.is_student())
  );
