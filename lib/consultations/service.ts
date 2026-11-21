import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type {
  AdminConsultation,
  AdminListQuery,
  Consultation,
  CreateConsultationInput,
  UpdateConsultationInput,
} from "./schemas";

/**
 * Data access for consultations. Used by both route handlers (/api) and
 * Server Components, so reads and writes share one implementation.
 *
 * Every function takes the request-scoped Supabase client, so all queries
 * run as the signed-in user under RLS. Functions throw AppError with an
 * HTTP-friendly status; the API layer turns it into a JSON response and
 * pages fall back to the nearest error boundary.
 */

const COLUMNS =
  "id, student_id, first_name, last_name, reason, scheduled_at, status, completed_at, cancelled_at, created_at, updated_at";

type ConsultationRow = Tables<"consultations">;

function toConsultation(row: ConsultationRow): Consultation {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    reason: row.reason,
    scheduledAt: row.scheduled_at,
    status: row.status,
    completed: row.completed_at !== null,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Translate Postgres errors into user-safe AppErrors. Expected rule
 * violations become 4xx with a clear message; anything else is logged here
 * (the one place that sees the raw database error, for both API routes and
 * pages) and becomes a generic 500.
 */
function fromPostgrestError(error: PostgrestError): AppError {
  switch (error.code) {
    case "23505": // unique_violation: consultations_no_double_booking_idx
      return new AppError(409, "conflict", "You already have a consultation booked at that time.");
    case "23514": // check_violation: raised by our triggers / CHECK constraints
      // Trigger messages are written for end users; CHECK constraint names are not.
      return new AppError(
        422,
        "rule_violation",
        error.message.includes("violates check constraint")
          ? "That change isn't allowed for this consultation."
          : error.message,
      );
    case "42501": // insufficient_privilege / RLS rejection
      return new AppError(403, "forbidden", "You don't have permission to do that.");
    case "PGRST116": // .single() found no row: missing, or hidden by RLS
      return new AppError(404, "not_found", "Consultation not found.");
    default:
      logger.error("unexpected database error", {
        pgCode: error.code,
        pgMessage: error.message,
        pgHint: error.hint,
      });
      return new AppError(500, "internal", "Something went wrong. Please try again.", {
        cause: error,
      });
  }
}

/**
 * The signed-in user's own consultations.
 * Filters on student_id explicitly: RLS lets admins read every row, and an
 * admin's own dashboard should still only show their own bookings.
 */
export async function listOwnConsultations(
  supabase: ServerSupabaseClient,
  userId: string,
): Promise<Consultation[]> {
  const { data, error } = await supabase
    .from("consultations")
    .select(COLUMNS)
    .eq("student_id", userId)
    .order("scheduled_at", { ascending: true })
    .limit(500); // Bound the payload; add pagination if students ever book this many.

  if (error) throw fromPostgrestError(error);
  return data.map(toConsultation);
}

export async function createConsultation(
  supabase: ServerSupabaseClient,
  input: CreateConsultationInput,
): Promise<Consultation> {
  // student_id is NOT sent: the column defaults to auth.uid() and RLS checks
  // it, so a client can't book on someone else's behalf.
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      reason: input.reason,
      scheduled_at: input.scheduledAt,
    })
    .select(COLUMNS)
    .single();

  if (error) throw fromPostgrestError(error);
  return toConsultation(data);
}

export async function updateConsultation(
  supabase: ServerSupabaseClient,
  userId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  const patch: Partial<Pick<ConsultationRow, "scheduled_at" | "status" | "completed_at">> = {};
  if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
  if (input.status !== undefined) patch.status = input.status;
  // The DB trigger replaces this with server time; we only signal intent.
  if (input.completed !== undefined)
    patch.completed_at = input.completed ? new Date().toISOString() : null;

  // Scoped to the caller's own rows. Other users' rows are invisible (404),
  // which avoids leaking whether an id exists.
  const { data, error } = await supabase
    .from("consultations")
    .update(patch)
    .eq("id", id)
    .eq("student_id", userId)
    .select(COLUMNS)
    .single();

  if (error) throw fromPostgrestError(error);
  return toConsultation(data);
}

/** Every consultation in the system. RLS only returns rows to admins. */
export async function listAllConsultations(
  supabase: ServerSupabaseClient,
  query: AdminListQuery,
): Promise<{ items: AdminConsultation[]; total: number }> {
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let request = supabase
    .from("consultations")
    .select(`${COLUMNS}, student:profiles!consultations_student_id_fkey(email)`, {
      count: "exact",
    })
    .order("scheduled_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, to);

  if (query.status) request = request.eq("status", query.status);

  const { data, error, count } = await request;
  if (error) throw fromPostgrestError(error);

  return {
    total: count ?? 0,
    items: data.map(({ student, ...row }) => ({
      ...toConsultation(row),
      studentId: row.student_id,
      studentEmail: student?.email ?? null,
    })),
  };
}
