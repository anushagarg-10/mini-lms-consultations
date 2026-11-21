import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Helpers for the API tests.
 *
 * Sessions are created the same way the browser gets them: we sign in through
 * @supabase/ssr with an in-memory cookie jar, then send those exact cookies to
 * the app. No mocking, so the tests cover the proxy, route handlers, service
 * layer and the database rules together.
 */

export const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (e.g. in .env.local).",
  );
}

/** The seeded demo password, read from supabase/seed.sql so it can't drift. */
export const SEED_PASSWORD = (() => {
  const seed = readFileSync("supabase/seed.sql", "utf8");
  const match = seed.match(/crypt\('([^']+)'/);
  if (!match) throw new Error("Couldn't find the seeded password in supabase/seed.sql");
  return match[1];
})();

/** Sign in and return the Cookie header a browser would send. */
export async function signIn(email: string, password: string): Promise<string> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** Create a brand-new student (sign-ups are always students) and sign them in. */
export async function newStudent(): Promise<{ email: string; cookie: string }> {
  const email = `api-test-${crypto.randomUUID()}@example.com`;
  const password = `Test-${crypto.randomUUID()}`;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(`Sign-up failed: ${error.message}`);
  return { email, cookie: await signIn(email, password) };
}

export type ApiResponse = {
  status: number;
  headers: Headers;
  body: {
    // Response payloads vary per route; tests assert on the fields they need.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pagination?: any;
    error?: { code: string; message: string; details?: unknown };
    raw?: string;
  };
};

/** Call the app. JSON bodies by default; pass `rawBody` to send anything else. */
export async function api(
  method: string,
  path: string,
  options: {
    cookie?: string;
    json?: unknown;
    rawBody?: string;
    contentType?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.cookie) headers.cookie = options.cookie;
  let body: string | undefined;
  if (options.json !== undefined) {
    headers["content-type"] = options.contentType ?? "application/json";
    body = JSON.stringify(options.json);
  } else if (options.rawBody !== undefined) {
    headers["content-type"] = options.contentType ?? "application/json";
    body = options.rawBody;
  }

  const res = await fetch(`${BASE_URL}${path}`, { method, headers, body, redirect: "manual" });
  const text = await res.text();
  let parsed: ApiResponse["body"] = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

/** An ISO timestamp `days` from now, offset by `minutes` to keep slots unique. */
export function future(days: number, minutes = 0): string {
  return new Date(Date.now() + days * 86_400_000 + minutes * 60_000).toISOString();
}

export const booking = (scheduledAt: string, overrides: Record<string, unknown> = {}) => ({
  firstName: "Api",
  lastName: "Test",
  reason: "Automated API test booking",
  scheduledAt,
  ...overrides,
});
