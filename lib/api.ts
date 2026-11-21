import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { getCurrentUser, type AppRole, type SessionUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger, type Logger } from "@/lib/logger";

/**
 * Small helpers that keep every route handler consistent:
 *   - one JSON error shape: { error: { code, message, details? } }
 *   - one request log line per call, tagged with a request id
 *   - one way to authenticate / authorise
 *   - one way to parse and validate bodies
 */

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

const REQUEST_ID_HEADER = "x-request-id";

/** Reuse an upstream request id (load balancer, client) if it looks sane. */
function requestIdFrom(request: NextRequest): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  return incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
}

/** Map anything thrown by a handler to a JSON response. */
function toErrorResponse(err: unknown, log: Logger): Response {
  if (err instanceof AppError) {
    // The source (e.g. the service layer) already logged the details.
    if (err.isServerError) log.error("request failed", { code: err.code });
    return jsonError(err.status, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return jsonError(400, "validation_error", "Invalid request", err.flatten());
  }
  // Not thrown on purpose: a bug. Log everything, tell the user nothing internal.
  log.error("unhandled error", { err });
  return jsonError(500, "internal", "Something went wrong. Please try again.");
}

type Handler<Ctx> = (request: NextRequest, ctx: Ctx, log: Logger) => Promise<Response>;

/**
 * Wrap a route handler:
 *  - gives it a request-scoped logger (third argument)
 *  - converts AppError / ZodError / unknown errors into JSON responses
 *  - logs one summary line (method, path, status, duration) per request
 *  - returns the request id in the `x-request-id` header so a user-reported
 *    error can be matched to its log line
 */
export function handle<Ctx>(fn: Handler<Ctx>) {
  return async (request: NextRequest, ctx: Ctx): Promise<Response> => {
    const requestId = requestIdFrom(request);
    const log = logger.child({ requestId });
    const started = performance.now();

    let response: Response;
    try {
      response = await fn(request, ctx, log);
    } catch (err) {
      response = toErrorResponse(err, log);
    }

    const status = response.status;
    log[status >= 500 ? "error" : status >= 400 ? "warn" : "info"]("request", {
      method: request.method,
      path: request.nextUrl.pathname,
      status,
      durationMs: Math.round(performance.now() - started),
    });

    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  };
}

/** 401 unless signed in; 403 unless the user has one of `roles` (if given). */
export async function requireUser(roles?: AppRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError(401, "unauthorized", "You need to sign in.");
  if (roles && !roles.includes(user.role)) {
    throw new AppError(403, "forbidden", "You don't have permission to do that.");
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
    throw new AppError(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON");
  }
  return schema.parse(body);
}
