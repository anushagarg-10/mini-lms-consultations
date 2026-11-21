import { NextResponse } from "next/server";
import { handle, parseJsonBody, requireUser } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createConsultationSchema } from "@/lib/consultations/schemas";
import { createConsultation, listOwnConsultations } from "@/lib/consultations/service";

/** GET /api/consultations: the signed-in user's own consultations. */
export const GET = handle(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const consultations = await listOwnConsultations(supabase, user.id);
  return NextResponse.json({ data: consultations });
});

/** POST /api/consultations: book a new consultation for the signed-in user. */
export const POST = handle(async (request) => {
  await requireUser();
  const input = await parseJsonBody(request, createConsultationSchema);
  const supabase = await createClient();
  const consultation = await createConsultation(supabase, input);
  return NextResponse.json(
    { data: consultation },
    { status: 201, headers: { Location: `/api/consultations/${consultation.id}` } },
  );
});
