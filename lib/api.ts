import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getCurrentUser, type AppRole, type SessionUser } from "@/lib/auth";
import { ServiceError } from "@/lib/consultations/service";

/**
 * Small helpers that keep every route handler consistent:
 *   - one JSON error shape: { error: { code, message, details? } }
 *   - one way to authenticate / authorise
 *   - one way to parse and validate bodies
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/** Wrap a handler so thrown ApiError / ServiceError / ZodError become JSON. */
export function handle<Ctx>(fn: (request: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      if (err instanceof ApiError) return jsonError(err.status, err.code, err.message, err.details);
      if (err instanceof ServiceError)
        return jsonError(err.status, err.code ?? "error", err.message);
      if (err instanceof ZodError) {
        return jsonError(400, "validation_error", "Invalid request", err.flatten());
      }
      console.error("Unhandled API error", err);
      return jsonError(500, "internal", "Something went wrong. Please try again.");
    }
  };
}

/** 401 unless signed in; 403 unless the user has one of `roles` (if given). */
export async function requireUser(roles?: AppRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "unauthorized", "You need to sign in.");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "forbidden", "You don't have permission to do that.");
  }
  return user;
}

/**
 * Parse a JSON body against a schema.
 * Requiring Content-Type: application/json also blocks simple cross-site
 * form posts (CSRF): a browser can't send that header cross-origin without a
 * CORS preflight, which we don't allow. SameSite=Lax auth cookies are the
 * other half of the CSRF defence.
 */
export async function parseJsonBody<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON");
  }
  return schema.parse(body);
}
