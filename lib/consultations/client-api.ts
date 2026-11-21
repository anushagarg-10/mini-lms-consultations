import type { Consultation, CreateConsultationInput, UpdateConsultationInput } from "./schemas";

/** Typed browser-side wrapper around the /api/consultations endpoints. */

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const fieldErrors = body?.error?.details?.fieldErrors;
    const firstFieldError = fieldErrors
      ? (Object.values(fieldErrors).flat()[0] as string | undefined)
      : undefined;
    throw new ApiRequestError(
      res.status,
      firstFieldError ?? body?.error?.message ?? "Something went wrong",
      fieldErrors,
    );
  }
  return body.data as T;
}

export const consultationsApi = {
  create: (input: CreateConsultationInput) =>
    request<Consultation>("/api/consultations", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  update: (id: string, input: UpdateConsultationInput) =>
    request<Consultation>(`/api/consultations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

/** "2026-11-21T14:30" (local time, for <input type="datetime-local">) */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local datetime-local value -> UTC ISO string for the API. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}
