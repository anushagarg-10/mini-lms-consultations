import { z } from "zod";

/**
 * Request/response contracts for the consultations API.
 * Shared by the route handlers (authoritative validation) and the client
 * forms (instant feedback). The database re-checks the important rules.
 */

export const MAX_BOOKING_DAYS_AHEAD = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

const name = (label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be 100 characters or fewer`);

/** ISO 8601 timestamp with an explicit offset, in the future, within a year. */
export const futureDateTime = z
  .string({ required_error: "Date and time is required" })
  .datetime({ offset: true, message: "Must be an ISO 8601 date-time with a timezone" })
  .refine((v) => Date.parse(v) > Date.now(), "Must be in the future")
  .refine(
    (v) => Date.parse(v) < Date.now() + MAX_BOOKING_DAYS_AHEAD * DAY_MS,
    `Must be within ${MAX_BOOKING_DAYS_AHEAD} days`,
  );

export const createConsultationSchema = z
  .object({
    firstName: name("First name"),
    lastName: name("Last name"),
    reason: z
      .string({ required_error: "Reason is required" })
      .trim()
      .min(1, "Reason is required")
      .max(1000, "Reason must be 1000 characters or fewer"),
    scheduledAt: futureDateTime,
  })
  .strict();

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

/**
 * PATCH body. Exactly one change per request so each request maps to one
 * clear user intent (reschedule, toggle completion, or cancel) and one clear
 * error message.
 */
export const updateConsultationSchema = z
  .object({
    scheduledAt: futureDateTime.optional(),
    completed: z.boolean().optional(),
    status: z.literal("cancelled").optional(),
  })
  .strict()
  .refine(
    (body) => Object.values(body).filter((v) => v !== undefined).length === 1,
    "Provide exactly one of: scheduledAt, completed, status",
  );

export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;

export const consultationIdSchema = z.string().uuid("Invalid consultation id");

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["scheduled", "cancelled"]).optional(),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

/** Shape returned to clients (camelCase, no internal columns). */
export type Consultation = {
  id: string;
  firstName: string;
  lastName: string;
  reason: string;
  scheduledAt: string;
  status: "scheduled" | "cancelled";
  completed: boolean;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminConsultation = Consultation & {
  studentId: string;
  studentEmail: string | null;
};
