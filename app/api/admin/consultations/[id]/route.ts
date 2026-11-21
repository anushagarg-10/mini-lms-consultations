import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { consultationIdSchema } from "@/lib/consultations/schemas";
import { getConsultationForAdmin } from "@/lib/consultations/service";

type Context = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/consultations/:id: one consultation with the student's
 * account email and their other consultations. Admin only, read-only.
 */
export const GET = handle<Context>(async (_request, { params }) => {
  await requireUser(["admin"]);
  const id = consultationIdSchema.parse((await params).id);
  const supabase = await createClient();
  const consultation = await getConsultationForAdmin(supabase, id);
  if (!consultation) throw new AppError(404, "not_found", "Consultation not found.");
  return NextResponse.json({ data: consultation });
});
