import { NextResponse } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { adminListQuerySchema } from "@/lib/consultations/schemas";
import { listAllConsultations } from "@/lib/consultations/service";

/**
 * GET /api/admin/consultations?page=1&pageSize=20&status=scheduled
 * Every consultation in the system, newest first. Admin only.
 *
 * The role check here gives a clean 403; RLS would return an empty list to a
 * non-admin anyway, so a bug in this check can't leak data.
 */
export const GET = handle(async (request) => {
  await requireUser(["admin"]);
  const query = adminListQuerySchema.parse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const supabase = await createClient();
  const { items, total } = await listAllConsultations(supabase, query);
  return NextResponse.json({
    data: items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  });
});
