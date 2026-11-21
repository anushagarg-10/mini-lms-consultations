/**
 * The one error type the app throws on purpose.
 *
 * Services throw it with an HTTP-friendly status and a user-safe message; the
 * API layer (lib/api.ts) turns it into a JSON response, and pages let Next's
 * error boundary handle it. Anything that is NOT an AppError is treated as an
 * unexpected bug: logged in full and shown to the user as a generic message.
 */
export class AppError extends Error {
  public readonly details?: unknown;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.details = options?.details;
  }

  /** 5xx errors are our fault and should be investigated. */
  get isServerError(): boolean {
    return this.status >= 500;
  }
}
