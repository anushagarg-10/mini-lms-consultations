// Database security + business-rule tests. `npm run test:db`
//
// Applies the real migrations and seed to PGlite (Postgres compiled to WASM,
// so no Docker needed) on top of a minimal stub of Supabase's auth schema and
// API roles, then exercises RLS, column grants and triggers as each role.
// The stub mirrors what Supabase provides: anon/authenticated roles,
// auth.uid() from the JWT `sub`, and default ALL privileges on public tables
// (which the migrations must revoke).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? process.cwd();
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema extensions;
  -- stand-ins for pgcrypto (only used by the seed's password hashing)
  create function extensions.gen_salt(text) returns text language sql as $$ select 'salt' $$;
  create function extensions.crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  -- Mimic Supabase's default privileges on the public schema
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create table auth.users (
    instance_id uuid, id uuid primary key, aud text, role text, email text,
    encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb,
    raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, email_change text, email_change_token_new text, recovery_token text);
  create table auth.identities (
    id uuid, user_id uuid, provider_id text, identity_data jsonb, provider text,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
`);

const migDir = join(root, "supabase/migrations");
for (const f of readdirSync(migDir).sort()) {
  await db.exec(readFileSync(join(migDir, f), "utf8"));
  console.log("applied", f);
}
await db.exec(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
console.log("seeded\n");

const ADMIN = "11111111-1111-1111-1111-111111111111";
const S1 = "22222222-2222-2222-2222-222222222222";
const S2 = "33333333-3333-3333-3333-333333333333";

async function as(uid, sql, params = []) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

let pass = 0,
  fail = 0;
async function expectOk(name, fn, check = () => true) {
  try {
    const r = await fn();
    if (check(r)) {
      pass++;
      console.log("PASS", name);
    } else {
      fail++;
      console.log("FAIL", name, JSON.stringify(r.rows));
    }
  } catch (e) {
    fail++;
    console.log("FAIL", name, "threw:", e.code, e.message);
  }
}
async function expectErr(name, fn, code) {
  try {
    const r = await fn();
    fail++;
    console.log("FAIL", name, "no error", JSON.stringify(r.rows));
  } catch (e) {
    if (!code || e.code === code) {
      pass++;
      console.log("PASS", name, `(${e.code}: ${e.message})`);
    } else {
      fail++;
      console.log("FAIL", name, "wrong code", e.code, e.message);
    }
  }
}
const rows = (n) => (r) => r.rows.length === n;
const future = "now() + interval '20 days'";

// --- Roles / profiles
await expectOk(
  "seed: admin promoted, others student",
  () => db.query("select email, role from public.profiles order by email"),
  (r) => r.rows.map((x) => x.role).join() === "admin,student,student",
);
await expectOk(
  "student reads only own profile",
  () => as(S1, "select * from public.profiles"),
  rows(1),
);
await expectOk(
  "admin reads all profiles",
  () => as(ADMIN, "select * from public.profiles"),
  rows(3),
);
await expectErr(
  "student cannot promote self",
  () => as(S1, `update public.profiles set role='admin' where id='${S1}'`),
  "42501",
);
await expectErr(
  "student cannot insert a profile",
  () =>
    as(S1, `insert into public.profiles (id,email,role) values (gen_random_uuid(),'x','admin')`),
  "42501",
);
await expectOk(
  "is_admin() false for student",
  () => as(S1, "select public.is_admin() as a"),
  (r) => r.rows[0].a === false,
);
await expectOk(
  "is_admin() true for admin",
  () => as(ADMIN, "select public.is_admin() as a"),
  (r) => r.rows[0].a === true,
);
await expectErr("anon cannot call is_admin()", () => as(null, "select public.is_admin()"), "42501");
await expectErr(
  "trigger fn not callable via API",
  () => as(S1, "select public.handle_new_user()"),
  "42501",
);

// --- Read isolation
await expectOk(
  "student1 sees only own 3",
  () => as(S1, "select * from public.consultations"),
  rows(3),
);
await expectOk(
  "student2 sees only own 2",
  () => as(S2, "select * from public.consultations"),
  rows(2),
);
await expectOk("admin sees all 5", () => as(ADMIN, "select * from public.consultations"), rows(5));
await expectErr(
  "anon has no access",
  () => as(null, "select * from public.consultations"),
  "42501",
);

// --- Create
await expectOk(
  "student books for self (student_id defaults)",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('A','B','C', ${future}) returning student_id, status`,
    ),
  (r) => r.rows[0].student_id === S1 && r.rows[0].status === "scheduled",
);
await expectErr(
  "student cannot set student_id (book for someone else)",
  () =>
    as(
      S1,
      `insert into public.consultations (student_id,first_name,last_name,reason,scheduled_at) values ('${S2}','A','B','C', ${future})`,
    ),
  "42501",
);
await expectErr(
  "student cannot insert pre-cancelled/completed",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at,completed_at) values ('A','B','C', ${future}, now())`,
    ),
  "42501",
);
await expectErr(
  "cannot book in the past",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('A','B','C', now() - interval '1 hour')`,
    ),
  "23514",
);
await expectErr(
  "blank name rejected by CHECK",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('  ','B','C', ${future} + interval '1 hour')`,
    ),
  "23514",
);
await expectErr(
  "double booking same slot rejected",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('A','B','C', (select scheduled_at from public.consultations where reason='C' limit 1))`,
    ),
  "23505",
);

// --- Update: ownership and admin read-only
const s2Id = (
  await db.query(
    `select id from public.consultations where student_id='${S2}' and status='scheduled' limit 1`,
  )
).rows[0].id;
await expectOk(
  "student cannot update another student's row (0 rows)",
  () =>
    as(S1, `update public.consultations set status='cancelled' where id='${s2Id}' returning id`),
  rows(0),
);
await expectOk(
  "admin cannot update a student's row (read-only, 0 rows)",
  () =>
    as(ADMIN, `update public.consultations set status='cancelled' where id='${s2Id}' returning id`),
  rows(0),
);

// --- Admins are read-only: they never book or edit, even their own rows
await expectOk(
  "is_student() true for student, false for admin",
  async () => ({
    rows: [
      (await as(S1, "select public.is_student() as s")).rows[0].s,
      (await as(ADMIN, "select public.is_student() as s")).rows[0].s,
    ],
  }),
  (r) => r.rows[0] === true && r.rows[1] === false,
);
await expectErr(
  "admin cannot book a consultation",
  () =>
    as(
      ADMIN,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('A','B','admin booking', ${future})`,
    ),
  "42501",
);
// A row owned by the admin (e.g. booked before admins became read-only),
// inserted as the database owner to bypass RLS.
const adminRowId = (
  await db.query(
    `insert into public.consultations (student_id,first_name,last_name,reason,scheduled_at) values ('${ADMIN}','A','B','legacy admin row', ${future}) returning id`,
  )
).rows[0].id;
await expectOk(
  "admin cannot update even their own row (0 rows)",
  () =>
    as(
      ADMIN,
      `update public.consultations set status='cancelled' where id='${adminRowId}' returning id`,
    ),
  rows(0),
);
await db.query(`delete from public.consultations where id='${adminRowId}'`);

await expectErr("nobody can DELETE", () => as(S1, `delete from public.consultations`), "42501");
await expectErr(
  "student cannot write cancelled_at directly",
  () => as(S1, `update public.consultations set cancelled_at=now()`),
  "42501",
);
await expectErr(
  "student cannot change reason after booking",
  () => as(S1, `update public.consultations set reason='x'`),
  "42501",
);

// --- State machine
const id = (await db.query(`select id from public.consultations where reason='C'`)).rows[0].id;
await expectOk(
  "complete: backdated client timestamp replaced by server time",
  () =>
    as(
      S1,
      `update public.consultations set completed_at='2000-01-01' where id='${id}' returning completed_at`,
    ),
  (r) => new Date(r.rows[0].completed_at).getFullYear() > 2000,
);
await expectErr(
  "cannot reschedule while completed",
  () =>
    as(
      S1,
      `update public.consultations set scheduled_at=${future} + interval '2 days' where id='${id}'`,
    ),
  "23514",
);
await expectErr(
  "cannot cancel while completed",
  () => as(S1, `update public.consultations set status='cancelled' where id='${id}'`),
  "23514",
);
await expectOk(
  "mark incomplete",
  () =>
    as(
      S1,
      `update public.consultations set completed_at=null where id='${id}' returning completed_at`,
    ),
  (r) => r.rows[0].completed_at === null,
);
await expectErr(
  "cannot reschedule into the past",
  () =>
    as(
      S1,
      `update public.consultations set scheduled_at=now() - interval '1 day' where id='${id}'`,
    ),
  "23514",
);
await expectOk(
  "reschedule to future",
  () =>
    as(
      S1,
      `update public.consultations set scheduled_at=${future} + interval '2 days' where id='${id}' returning id`,
    ),
  rows(1),
);
await expectOk(
  "cancel sets cancelled_at",
  () =>
    as(
      S1,
      `update public.consultations set status='cancelled' where id='${id}' returning cancelled_at`,
    ),
  (r) => r.rows[0].cancelled_at !== null,
);
await expectErr(
  "cancelled is terminal (can't un-cancel)",
  () => as(S1, `update public.consultations set status='scheduled' where id='${id}'`),
  "23514",
);
await expectErr(
  "cancelled is terminal (can't complete)",
  () => as(S1, `update public.consultations set completed_at=now() where id='${id}'`),
  "23514",
);
await expectOk(
  "cancelled slot can be re-booked (partial unique index)",
  () =>
    as(
      S1,
      `insert into public.consultations (first_name,last_name,reason,scheduled_at) values ('A','B','rebook', (select scheduled_at from public.consultations where id='${id}')) returning id`,
    ),
  rows(1),
);

// --- Email sync trigger
await db.exec(`update auth.users set email='sam@example.com' where id='${S1}'`);
await expectOk(
  "profile email follows auth.users email",
  () => db.query(`select email from public.profiles where id='${S1}'`),
  (r) => r.rows[0].email === "sam@example.com",
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
