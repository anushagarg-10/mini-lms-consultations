import Link from "next/link";
import { BellRing, CalendarCheck2, CalendarRange, CalendarX2, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LocalDateTime } from "@/components/local-date-time";
import { RelativeTime } from "@/components/relative-time";
import type { AdminOverview as Overview } from "@/lib/consultations/schemas";

/** Counts plus the next few consultations, shown above the admin table. */
export function AdminOverview({ overview }: { overview: Overview }) {
  return (
    <section className="grid gap-4" aria-label="Overview">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={BellRing} label="Next 24 hours" value={overview.next24Hours} highlight />
        <Stat icon={CalendarRange} label="Next 7 days" value={overview.next7Days} />
        <Stat icon={CalendarCheck2} label="Completed" value={overview.completed} />
        <Stat icon={CalendarX2} label="Cancelled" value={overview.cancelled} />
      </div>

      <div className="grid gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Coming up</h2>
        {overview.upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No upcoming consultations.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {overview.upcoming.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/consultations/${c.id}`}
                  className="group block h-full rounded-xl border border-l-4 border-l-primary bg-card p-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <User className="size-4 text-muted-foreground" aria-hidden />
                      {c.firstName} {c.lastName}
                    </span>
                    <RelativeTime value={c.scheduledAt} />
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden />
                    <LocalDateTime value={c.scheduledAt} />
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">{c.reason}</p>
                  <p className="mt-3 text-xs font-medium text-primary group-hover:underline">
                    View details
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={
            highlight && value > 0
              ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          }
        >
          <Icon className="size-4" />
        </span>
        <div className="grid">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}
