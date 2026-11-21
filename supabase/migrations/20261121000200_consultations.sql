-- =============================================================================
-- Consultations
-- -----------------------------------------------------------------------------
-- The database is the source of truth for every rule below. The publishable
-- (anon) key is public, so any signed-in user could call PostgREST directly
-- and skip the Next.js API. Privileges, RLS and triggers therefore enforce:
--   * ownership       (students only ever see / change their own rows)
--   * column scope    (only the columns a student may legitimately change)
--   * state machine   (cancel is terminal, completed rows can't be moved, ...)
--   * timestamps      (completed_at / cancelled_at are server time, never client)
-- The API layer repeats the validation to give users friendly errors, but it
-- is not what keeps the data safe.
-- =============================================================================

create type public.consultation_status as enum ('scheduled', 'cancelled');

create table public.consultations (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  reason        text not null,
  scheduled_at  timestamptz not null,
  status        public.consultation_status not null default 'scheduled',
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint consultations_first_name_len check (char_length(btrim(first_name)) between 1 and 100),
  constraint consultations_last_name_len  check (char_length(btrim(last_name))  between 1 and 100),
  constraint consultations_reason_len     check (char_length(btrim(reason))     between 1 and 1000),
  -- cancelled_at is set if and only if the consultation is cancelled
  constraint consultations_cancelled_at_matches_status
    check ((status = 'cancelled') = (cancelled_at is not null)),
  -- a consultation can't be both cancelled and completed
  constraint consultations_not_cancelled_and_completed
    check (not (status = 'cancelled' and completed_at is not null))
);

comment on table public.consultations is 'A consultation booked by a student.';
comment on column public.consultations.status is 'scheduled | cancelled. Cancellation is a soft, terminal state so history is kept for admins.';
comment on column public.consultations.completed_at is 'NULL = incomplete. Set to server time when a student marks it complete.';

-- Student dashboard: "my consultations ordered by time"
create index consultations_student_scheduled_idx
  on public.consultations (student_id, scheduled_at);

-- Admin view: "all consultations ordered by time", paginated
create index consultations_scheduled_idx
  on public.consultations (scheduled_at desc, id);

-- A student can't hold two active bookings in the same slot.
create unique index consultations_no_double_booking_idx
  on public.consultations (student_id, scheduled_at)
  where status = 'scheduled';

create trigger consultations_set_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Business rules on INSERT
-- -----------------------------------------------------------------------------
create or replace function public.consultations_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scheduled_at <= now() then
    raise exception 'Consultations must be booked in the future'
      using errcode = 'check_violation';
  end if;

  -- New bookings always start as scheduled and incomplete, whatever was sent.
  new.status       := 'scheduled';
  new.completed_at := null;
  new.cancelled_at := null;
  return new;
end;
$$;

create trigger consultations_before_insert
  before insert on public.consultations
  for each row execute function public.consultations_before_insert();

-- -----------------------------------------------------------------------------
-- State machine on UPDATE
--   scheduled --(cancel)--> cancelled   (terminal)
--   completed_at: NULL <-> now()        (only while scheduled)
--   scheduled_at: may change only while scheduled, not completed, and to a
--                 future time
-- -----------------------------------------------------------------------------
create or replace function public.consultations_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Identity and ownership are immutable.
  if new.id is distinct from old.id
     or new.student_id is distinct from old.student_id
     or new.created_at is distinct from old.created_at then
    raise exception 'id, student_id and created_at cannot be changed'
      using errcode = 'check_violation';
  end if;

  if old.status = 'cancelled' then
    raise exception 'Cancelled consultations cannot be modified'
      using errcode = 'check_violation';
  end if;

  -- Reschedule
  if new.scheduled_at is distinct from old.scheduled_at then
    if old.completed_at is not null then
      raise exception 'Completed consultations cannot be rescheduled. Mark it incomplete first.'
        using errcode = 'check_violation';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'Consultations can only be rescheduled to a future time'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Cancel
  if new.status = 'cancelled' then
    if old.completed_at is not null or new.completed_at is not null then
      raise exception 'Completed consultations cannot be cancelled'
        using errcode = 'check_violation';
    end if;
    new.cancelled_at := now();
  else
    new.cancelled_at := null;
  end if;

  -- Complete / incomplete: the timestamp is always server time.
  if new.completed_at is not null and old.completed_at is null then
    new.completed_at := now();
  elsif new.completed_at is not null then
    new.completed_at := old.completed_at;
  end if;

  return new;
end;
$$;

create trigger consultations_before_update
  before update on public.consultations
  for each row execute function public.consultations_before_update();

revoke all on function public.consultations_before_insert() from public, anon, authenticated;
revoke all on function public.consultations_before_update() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges: column-level grants limit WHAT a student may write;
-- RLS below limits WHICH ROWS. No DELETE: cancelling is a soft state change.
-- -----------------------------------------------------------------------------
revoke all on public.consultations from anon, authenticated;
grant select on public.consultations to authenticated;
grant insert (first_name, last_name, reason, scheduled_at) on public.consultations to authenticated;
grant update (scheduled_at, status, completed_at) on public.consultations to authenticated;

alter table public.consultations enable row level security;

create policy "Students can read their own consultations"
  on public.consultations for select
  to authenticated
  using (student_id = (select auth.uid()));

create policy "Admins can read all consultations"
  on public.consultations for select
  to authenticated
  using ((select public.is_admin()));

create policy "Students can book consultations for themselves"
  on public.consultations for insert
  to authenticated
  with check (student_id = (select auth.uid()));

create policy "Students can update their own consultations"
  on public.consultations for update
  to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- Deliberately no admin INSERT/UPDATE/DELETE policy: the admin view is read-only.
