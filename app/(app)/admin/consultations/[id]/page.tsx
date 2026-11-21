import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarPlus,
  CalendarX2,
  ChevronRight,
  Clock,
  Mail,
  MessageSquareText,
  PencilLine,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { consultationIdSchema, type Consultation } from "@/lib/consultations/schemas";
import { getConsultationForAdmin } from "@/lib/consultations/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import { RelativeTime } from "@/components/relative-time";
import {
  ConsultationStatusBadge,
  consultationState,
} from "@/components/consultations/consultation-status-badge";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultation details" };

/**
 * Read-only detail view of one consultation for admins. The role check lives
 * in app/(app)/admin/layout.tsx, which wraps this page; RLS backs it up.
 */
export default async function AdminConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const parsedId = consultationIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const supabase = await createClient();
  const c = await getConsultationForAdmin(supabase, parsedId.data);
  if (!c) notFound();

  const isActive = c.status === "scheduled" && !c.completed;

  return (
    <div className="grid gap-6">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All consultations
      </Link>

      {/* Header: who and when */}
      <Card
        className={cn(
          "border-l-4",
          {
            scheduled: "border-l-primary",
            completed: "border-l-emerald-500",
            cancelled: "border-l-muted-foreground/30",
          }[consultationState(c)],
        )}
      >
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Consultation with</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.firstName} {c.lastName}
            </h1>
            <p className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              <LocalDateTime value={c.scheduledAt} />
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConsultationStatusBadge consultation={c} />
            {isActive && <RelativeTime value={c.scheduledAt} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* The request */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="size-4 text-muted-foreground" aria-hidden />
              Reason for consultation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-4 text-sm leading-relaxed">
              {c.reason}
            </p>
          </CardContent>
        </Card>

        {/* Who booked it */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4 text-muted-foreground" aria-hidden />
              Student
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Detail label="Name on booking">
              {c.firstName} {c.lastName}
            </Detail>
            <Detail label="Booked from account">
              <span className="inline-flex items-center gap-1.5 break-all">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {c.studentEmail ?? "Unknown"}
              </span>
            </Detail>
            <Detail label="Total consultations">{c.otherConsultations.length + 1}</Detail>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* What happened, when */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-4 text-sm">
              <TimelineItem icon={CalendarPlus} label="Booked" value={c.createdAt} />
              {c.updatedAt !== c.createdAt && (
                <TimelineItem icon={PencilLine} label="Last changed" value={c.updatedAt} />
              )}
              {c.completedAt && (
                <TimelineItem icon={CalendarCheck2} label="Marked complete" value={c.completedAt} />
              )}
              {c.cancelledAt && (
                <TimelineItem icon={CalendarX2} label="Cancelled" value={c.cancelledAt} />
              )}
            </ol>
          </CardContent>
        </Card>

        {/* Context: the student's other bookings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Other consultations from this student</CardTitle>
          </CardHeader>
          <CardContent>
            {c.otherConsultations.length === 0 ? (
              <p className="text-sm text-muted-foreground">This is their only consultation.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {c.otherConsultations.map((o) => (
                  <OtherConsultation key={o.id} consultation={o} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Read-only: admins can view consultations but not change them.
      </p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="grid">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <LocalDateTime value={value} />
        </span>
      </div>
    </li>
  );
}

function OtherConsultation({ consultation: o }: { consultation: Consultation }) {
  return (
    <li>
      <Link
        href={`/admin/consultations/${o.id}`}
        className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/50"
      >
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium">
            <LocalDateTime value={o.scheduledAt} />
          </span>
          <span className="truncate text-muted-foreground">{o.reason}</span>
        </div>
        <ConsultationStatusBadge consultation={o} />
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
