# Mini LMS: Student Consultations

A small LMS where students book and manage consultations and admins see every consultation in the system.

**Stack:** Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, `supabase-js`, `@supabase/ssr`) · shadcn/ui + Tailwind · Zod · react-day-picker

Built on the official `with-supabase` starter.

---

## Features

| Area | What it does |
| --- | --- |
| Auth | Sign up, log in, log out, forgot/reset password (Supabase Auth, cookie sessions via `@supabase/ssr`) |
| Student dashboard | Lists the student's own consultations in Upcoming / Past / Cancelled tabs |
| Book | Form with first name, last name, reason, date and time |
| Complete / incomplete | Checkbox on each consultation |
| Reschedule | Pick a new future date and time |
| Cancel | Confirm dialog; cancellation is kept as history, not deleted |
| Admin view | `/admin`: read-only, paginated, filterable table of every consultation with the student's account email |
| UI | shadcn/ui throughout: calendar + 30 minute time-slot picker (past days and slots disabled), colour-coded status badges, summary cards, loading skeletons, light/dark themes, responsive down to phone width |

---

## Setup

### Prerequisites

* Node.js 20+
* Docker (Docker Desktop, OrbStack or Colima), needed by the Supabase CLI to run Supabase locally

The Supabase CLI is a dev dependency, so there's nothing to install globally.

### Run locally

```bash
npm install
npm run db:start            # starts local Supabase, applies migrations and seed
npx supabase status         # copy "API URL" and "Publishable key"
cp .env.example .env.local  # paste them in
npm run dev                 # http://localhost:3000
```

### Seeded accounts

| Email | Password | Role |
| --- | --- | --- |
| `admin@example.com` | `password123` | admin |
| `student@example.com` | `password123` | student (3 consultations) |
| `student2@example.com` | `password123` | student (2 consultations) |

New sign-ups are always students. Email confirmation is off locally (`supabase/config.toml`), so you are signed in straight after signing up. Any emails (password reset) land in Mailpit at http://127.0.0.1:54324.

### Making someone an admin

Roles can't be changed from the app or the public API (by design, see Security). Run this as the database owner, from Supabase Studio's SQL editor (http://127.0.0.1:54323) or `psql`:

```sql
update public.profiles set role = 'admin' where email = 'someone@example.com';
```

### Using a hosted Supabase project instead

```bash
npx supabase link --project-ref <ref>
npx supabase db push        # applies supabase/migrations (not the seed)
```

Then put the project URL and publishable key in `.env.local`, and add `http://localhost:3000/**` to Auth > URL Configuration > Redirect URLs.

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run test:db` | Runs the database security tests (35 checks). Uses PGlite, so **no Docker needed** |
| `npm run db:reset` | Recreate the local DB from migrations + seed |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` from the local schema |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks |

---

## Architecture

```
Browser ──(fetch JSON)──▶ /api/* Route Handlers ──▶ lib/consultations/service.ts ──▶ Supabase (Postgres + RLS)
   ▲                                                         ▲
   └──── Server Components (dashboard, admin) ───────────────┘   reads use the same service directly
```

```
app/
  (app)/layout.tsx              Signed-in shell; redirects if no session; shows Admin link by role
  (app)/dashboard/page.tsx      Student dashboard (Server Component)
  (app)/admin/page.tsx          Admin table (Server Component, 404 for non-admins)
  api/consultations/route.ts        GET own list, POST create
  api/consultations/[id]/route.ts   PATCH reschedule | complete | cancel
  api/admin/consultations/route.ts  GET all (admin), paginated
  auth/*                        Starter auth pages (open redirect fixed in auth/confirm)
lib/
  auth.ts                       getCurrentUser(): verified identity + role, cached per request
  api.ts                        handle() error mapping, requireUser(roles), parseJsonBody()
  consultations/schemas.ts      Zod contracts shared by API and forms, DTO types
  consultations/service.ts      All consultation queries; maps Postgres errors to HTTP statuses
  consultations/client-api.ts   Typed fetch wrapper used by client components
  supabase/                     Typed server, browser and proxy clients
proxy.ts                        Session refresh + redirect signed-out users (Next 16's middleware)
supabase/
  migrations/                   Schema, roles, RLS, triggers
  seed.sql                      Local users and sample data
  tests/rls.test.mjs            Database tests
```

### API

All responses are JSON. Errors share one shape: `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Who | Body / query | Success |
| --- | --- | --- | --- | --- |
| GET | `/api/consultations` | signed in | | `200 { data: Consultation[] }` |
| POST | `/api/consultations` | signed in | `{ firstName, lastName, reason, scheduledAt }` | `201 { data }` + `Location` |
| PATCH | `/api/consultations/:id` | owner | exactly one of `{ scheduledAt }`, `{ completed: boolean }`, `{ status: "cancelled" }` | `200 { data }` |
| GET | `/api/admin/consultations` | admin | `?page=&pageSize=(≤100)&status=scheduled\|cancelled` | `200 { data, pagination }` |

Status codes: `400` validation, `401` not signed in, `403` wrong role, `404` not found or not yours, `409` double booking, `415` non-JSON body, `422` business rule (e.g. rescheduling a cancelled consultation).

`scheduledAt` is an ISO 8601 timestamp with an offset. The browser converts the user's local `datetime-local` value to UTC, and dates are displayed back in the viewer's timezone.

### Data model

```
auth.users 1──1 public.profiles (id, email, role: student|admin)
                     1
                     │
                     * public.consultations
                         id, student_id → profiles
                         first_name, last_name, reason, scheduled_at
                         status: scheduled|cancelled, cancelled_at
                         completed_at (NULL = incomplete)
                         created_at, updated_at
```

Indexes: `(student_id, scheduled_at)` for the dashboard, `(scheduled_at desc, id)` for the admin list, and a partial unique index on `(student_id, scheduled_at) where status = 'scheduled'` to stop double booking.

---

## Key decisions and justifications

### 1. Roles live in `public.profiles`, enforced with RLS

* A trigger on `auth.users` creates a `profiles` row for every sign-up with `role = 'student'`.
* The role is **not** taken from `user_metadata`: users can edit their own metadata with `supabase.auth.updateUser()`, so trusting it would let anyone become admin.
* Authenticated users have `SELECT` only on `profiles` (no insert or update grant), so self-promotion is impossible even through PostgREST directly. Admins are created by an operator (see above).
* `public.is_admin()` is a `SECURITY DEFINER`, `STABLE` helper used in policies. Policies call it as `(select public.is_admin())` so Postgres evaluates it once per statement rather than per row, which keeps the admin list fast as the table grows.
* The role is read per request (cached with React `cache()`), so promotions and demotions take effect immediately. The alternative, a Custom Access Token Hook that puts the role in the JWT, saves one indexed primary-key lookup but leaves stale roles in tokens until they refresh. For a role that gates every admin read, I chose freshness. The hook is a reasonable optimisation at much larger scale.
* A single `role` column fits the two roles in scope. If roles multiply (tutor, parent, etc.) or need permissions, I'd move to `user_roles` + `role_permissions` tables; `is_admin()` is the only place that would need to change in SQL.

### 2. The database is the security boundary, the API is the interface

The publishable key is public by design, so any signed-in user can call the Supabase REST API directly and skip the Next.js routes. All the important rules are therefore enforced in Postgres, and the API layer repeats them only to give good error messages:

| Layer | Enforces |
| --- | --- |
| **Grants** (column-level) | Students can insert only `first_name, last_name, reason, scheduled_at` and update only `scheduled_at, status, completed_at`. No `DELETE` for anyone. Supabase's default `GRANT ALL` to `anon`/`authenticated` is revoked first |
| **RLS** | Students see and change only their own rows. Admins can read all rows but have **no** write policy, so "read-only admin" is enforced by the database, not just by the UI |
| **Triggers** | Booking and rescheduling must be in the future; cancel is terminal; a completed consultation can't be rescheduled or cancelled; `completed_at` and `cancelled_at` are always server time; `student_id` can't change |
| **Constraints** | Field lengths, status/timestamp consistency, no double booking |

The route handlers and Server Components use the request-scoped Supabase client (the user's JWT), never the service-role key. A bug in an API handler can't therefore expose another student's data; the worst case is a less friendly error. The `test:db` suite exercises each of these rules as each role.

### 3. Route handlers for writes, Server Components for the first read

As requested, all mutations go through REST route handlers (no Server Actions). Pages read their initial data on the server through the **same** `service.ts` functions the `GET` endpoints use, which avoids an extra HTTP round trip and a loading spinner, while keeping one implementation of each query. After a mutation the client calls `router.refresh()` to re-render with fresh server data, so there's no client cache to keep in sync.

### 4. Cancel is a soft state change, not a DELETE

Cancelling sets `status = 'cancelled'` and `cancelled_at`. That keeps the history for admins (and for reporting), lets the same slot be re-booked thanks to the partial unique index, and means there is no destructive operation exposed to students at all.

### 5. One change per PATCH

`PATCH /api/consultations/:id` accepts exactly one of `scheduledAt`, `completed` or `status`. Each request maps to one user intent, gets one clear error, and keeps the state machine easy to reason about.

### 6. Other security measures

* `getClaims()` verifies the JWT signature for identity (rather than trusting `getSession()`).
* Admin page returns 404 to non-admins; admin API returns 403. RLS returns nothing to non-admins regardless.
* Other students' consultations return 404, not 403, so ids can't be probed.
* CSRF: auth cookies are `SameSite=Lax`, and mutation endpoints require `Content-Type: application/json`, which a cross-site form can't send without a CORS preflight.
* Fixed an open redirect in the starter's `/auth/confirm` (`?next=//evil.example`).
* Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
* Zod validation with length limits on every input; unexpected database errors are logged server-side and returned as a generic message.

---

## Assumptions

* **First and last name are stored per consultation**, as listed in the brief, not taken from the account. This also allows a parent, for example, to book under the student's name.
* **"Complete" is a student-controlled flag**, like ticking off a to-do, and can be toggled at any time, including before the consultation date.
* A completed consultation must be marked incomplete before it can be rescheduled or cancelled.
* Cancellation is final. To change your mind you book again.
* Bookings must be in the future and within 365 days. No business hours, durations or tutor availability are modelled; the brief doesn't mention tutors.
* A student can't hold two active bookings at the exact same time.
* Admins are also users and can book consultations of their own; their dashboard shows only their own bookings (the query filters on `student_id`, since RLS would otherwise return every row to an admin).
* Times are stored as `timestamptz` (UTC) and shown in the viewer's local timezone.

---

## What I'd do next with more time

* Rate limiting on auth and booking endpoints (e.g. Upstash or an edge middleware).
* A strict nonce-based Content Security Policy.
* Integration tests for the route handlers (Vitest against `supabase start`) and a Playwright happy-path test; run `test:db` and these in CI.
* Optimistic UI updates (e.g. TanStack Query) instead of `router.refresh()` after each change.
* Pagination and search on the student dashboard; search by student on the admin view.
* Tutors and availability slots, with an exclusion constraint to prevent overlapping bookings.
* An audit log table written by trigger, so admins can see who changed what and when.
* Move role checks to the JWT via a Custom Access Token Hook if role lookups ever show up in profiling.
