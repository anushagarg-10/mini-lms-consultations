import { NextResponse } from "next/server";
import { handle, parseJsonBody, requireUser } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import {
  consultationIdSchema,
  updateConsultationSchema,
  type UpdateConsultationInput,
} from "@/lib/consultations/schemas";
import { updateConsultation } from "@/lib/consultations/service";

type Context = { params: Promise<{ id: string }> };

/** Name the single change a PATCH body asks for, for logs. */
function describeChange(input: UpdateConsultationInput): string {
  if (input.scheduledAt !== undefined) return "rescheduled";
  if (input.status === "cancelled") return "cancelled";
  return input.completed ? "marked_complete" : "marked_incomplete";
}

/**
 * PATCH /api/consultations/:id: change one thing about your own consultation.
 *   { "scheduledAt": "2026-12-01T10:00:00+11:00" }  reschedule
 *   { "completed": true | false }                   mark complete / incomplete
 *   { "status": "cancelled" }                       cancel (terminal)
 *
 * Cancelling is a state change rather than a DELETE so the record (and the
 * admin's view of it) is preserved.
 */
export const PATCH = handle<Context>(async (request, { params }, log) => {
  const user = await requireUser();
  const id = consultationIdSchema.parse((await params).id);
  const input = await parseJsonBody(request, updateConsultationSchema);
  const supabase = await createClient();
  const consultation = await updateConsultation(supabase, user.id, id, input);

  log.info("consultation updated", {
    userId: user.id,
    consultationId: id,
    change: describeChange(input),
  });

  return NextResponse.json({ data: consultation });
});
