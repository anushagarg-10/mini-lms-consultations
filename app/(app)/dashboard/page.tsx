import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listOwnConsultations } from "@/lib/consultations/service";
import { BookConsultationDialog } from "@/components/consultations/book-consultation-dialog";
import { ConsultationList, groupConsultations } from "@/components/consultations/consultation-list";
import { DashboardStats } from "@/components/consultations/dashboard-stats";

export const metadata: Metadata = { title: "My consultations" };

/**
 * Initial data is read on the server through the same service the
 * GET /api/consultations route uses (no extra HTTP hop). All writes go
 * through the /api routes, after which the client calls router.refresh().
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const consultations = await listOwnConsultations(supabase, user.id);
  // eslint-disable-next-line react-hooks/purity -- request-time snapshot for grouping
  const groups = groupConsultations(consultations, Date.now());

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My consultations</h1>
          <p className="text-sm text-muted-foreground">
            Book, reschedule, cancel and tick off your consultations.
          </p>
        </div>
        <BookConsultationDialog />
      </div>
      <DashboardStats
        upcoming={groups.upcoming.length}
        completed={consultations.filter((c) => c.status !== "cancelled" && c.completed).length}
        next={groups.upcoming.find((c) => !c.completed) ?? null}
      />
      <ConsultationList groups={groups} />
    </div>
  );
}
