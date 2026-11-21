import { NextResponse } from "next/server";
import { handle, parseJsonBody, requireUser } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createConsultationSchema } from "@/lib/consultations/schemas";
import { createConsultation, listOwnConsultations } from "@/lib/consultations/service";

/** GET /api/consultations: the signed-in user's own consultations. */
export const GET = handle(async () => {
  const user = await requireUser(["student"]);
  const supabase = await createClient();
  const consultations = await listOwnConsultations(supabase, user.id);
  return NextResponse.json({ data: consultations });
});

/** POST /api/consultations: book a new consultation for the signed-in user. */
export const POST = handle(async (request, _ctx, log) => {
  const user = await requireUser(["student"]);
  const input = await parseJsonBody(request, createConsultationSchema);
  const supabase = await createClient();
  const consultation = await createConsultation(supabase, input);

  log.info("consultation booked", {
    userId: user.id,
    consultationId: consultation.id,
    scheduledAt: consultation.scheduledAt,
  });

  return NextResponse.json(
    { data: consultation },
    { status: 201, headers: { Location: `/api/consultations/${consultation.id}` } },
  );
});
