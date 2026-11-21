"use client";

import { useSyncExternalStore } from "react";
import { differenceInCalendarDays } from "date-fns";
import { BellRing, Clock, History } from "lucide-react";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
const HOUR = 3_600_000;
const MINUTE = 60_000;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Tomorrow", "In 3 days", "In 5 hours", "2 days ago"...
 * Whole days are calendar days in the viewer's timezone, so "Tomorrow" means
 * tomorrow where the admin is, not in UTC.
 */
export function describeRelative(date: Date, now: Date): { label: string; tone: Tone } {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const diffMs = date.getTime() - now.getTime();
  const days = differenceInCalendarDays(date, now);

  if (days !== 0) {
    return {
      label: capitalise(rtf.format(days, "day")),
      tone: diffMs < 0 ? "past" : days === 1 ? "soon" : "future",
    };
  }
  // Same calendar day: use hours, or minutes when it's close.
  const abs = Math.abs(diffMs);
  const label =
    abs < MINUTE
      ? "Now"
      : abs < HOUR
        ? capitalise(rtf.format(Math.round(diffMs / MINUTE), "minute"))
        : capitalise(rtf.format(Math.round(diffMs / HOUR), "hour"));
  return { label, tone: diffMs < 0 ? "past" : "soon" };
}

type Tone = "soon" | "future" | "past";

const TONES: Record<Tone, { className: string; icon: typeof Clock }> = {
  soon: {
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    icon: BellRing,
  },
  future: { className: "border-border bg-muted/60 text-foreground", icon: Clock },
  past: { className: "border-border bg-transparent text-muted-foreground", icon: History },
};

/**
 * Reminder chip for a consultation time. Rendered on the client only: the
 * server can't know the viewer's clock or timezone, and rendering a guess
 * would cause a hydration mismatch.
 */
export function RelativeTime({ value, className }: { value: string; className?: string }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!isClient) return <span className={cn("inline-block h-5", className)} aria-hidden />;

  const { label, tone } = describeRelative(new Date(value), new Date());
  const { className: toneClass, icon: Icon } = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
