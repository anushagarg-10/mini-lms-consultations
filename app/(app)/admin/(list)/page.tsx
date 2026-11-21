import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminListQuerySchema } from "@/lib/consultations/schemas";
import { getAdminOverview, listAllConsultations } from "@/lib/consultations/service";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight } from "lucide-react";
import { LocalDateTime } from "@/components/local-date-time";
import { RelativeTime } from "@/components/relative-time";
import { AdminOverview } from "@/components/consultations/admin-overview";
import { ConsultationStatusBadge } from "@/components/consultations/consultation-status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "All consultations" };

const FILTERS = [
  { label: "All", value: undefined },
  { label: "Scheduled", value: "scheduled" },
  { label: "Cancelled", value: "cancelled" },
] as const;

/** Read-only, paginated list of every consultation. Admins only. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  // 404 rather than 403 so the page's existence isn't advertised.
  if (user?.role !== "admin") notFound();

  const raw = await searchParams;
  const parsed = adminListQuerySchema.safeParse({
    page: raw.page,
    status: raw.status,
  });
  const query = parsed.success ? parsed.data : adminListQuerySchema.parse({});

  const supabase = await createClient();
  const [{ items, total }, overview] = await Promise.all([
    listAllConsultations(supabase, query),
    getAdminOverview(supabase),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  const href = (page: number, status = query.status) => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">All consultations</h1>
        <p className="text-sm text-muted-foreground">
          Every student&apos;s bookings in one place. Read-only.
        </p>
      </div>

      <AdminOverview overview={overview} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total} consultation{total === 1 ? "" : "s"}
          {query.status ? ` (${query.status})` : ""}. Select one to see the full request.
        </p>
        <div className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={href(1, f.value)}
              className={cn(
                "rounded px-3 py-1 text-sm",
                query.status === f.value
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>When</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="w-[40%]">Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8">
                <span className="sr-only">Open</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No consultations found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                // The whole row is clickable: the link in the first cell stretches
                // over the row (after:absolute), keeping one real <a> per row.
                <TableRow key={c.id} className="relative cursor-pointer">
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/admin/consultations/${c.id}`}
                      className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
                    >
                      <LocalDateTime value={c.scheduledAt} />
                    </Link>
                    {c.status === "scheduled" && !c.completed && (
                      <div className="mt-1">
                        <RelativeTime value={c.scheduledAt} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {c.firstName} {c.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.studentEmail ?? "Unknown"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={c.reason}>
                    {c.reason}
                  </TableCell>
                  <TableCell>
                    <ConsultationStatusBadge consultation={c} />
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {query.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
            {query.page <= 1 ? (
              <span>Previous</span>
            ) : (
              <Link href={href(query.page - 1)}>Previous</Link>
            )}
          </Button>
          <Button asChild variant="outline" size="sm" disabled={query.page >= totalPages}>
            {query.page >= totalPages ? (
              <span>Next</span>
            ) : (
              <Link href={href(query.page + 1)}>Next</Link>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
