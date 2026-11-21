import { CalendarCheck2, CalendarClock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import type { Consultation } from "@/lib/consultations/schemas";

/** At-a-glance summary above the student's consultation list. */
export function DashboardStats({
  upcoming,
  completed,
  next,
}: {
  upcoming: number;
  completed: number;
  next: Consultation | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat icon={CalendarClock} label="Upcoming" value={String(upcoming)} />
      <Stat icon={CheckCircle2} label="Completed" value={String(completed)} />
      <Stat
        icon={CalendarCheck2}
        label="Next consultation"
        value={next ? <LocalDateTime value={next.scheduledAt} /> : "Nothing booked"}
        hint={next ? next.reason : undefined}
        small
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className={small ? "text-sm font-semibold" : "text-2xl font-semibold tabular-nums"}>
            {value}
          </span>
          {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
