"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAX_BOOKING_DAYS_AHEAD } from "@/lib/consultations/schemas";
import { cn } from "@/lib/utils";

const SLOT_MINUTES = 30;
const SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => i * SLOT_MINUTES);

const timeLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function atMinutes(day: Date, minutes: number): Date {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return d;
}

/**
 * Date (calendar popover) + time (30 minute slots) in the viewer's timezone.
 * Emits a Date, or null until both parts are chosen. The parent converts it
 * to an ISO string for the API; the server re-validates everything.
 */
export function DateTimePicker({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>(value ?? undefined);
  const [minutes, setMinutes] = useState<number | undefined>(
    value ? value.getHours() * 60 + value.getMinutes() : undefined,
  );

  // Recomputed when the popover/select opens, which is close enough to "now".
  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = startOfDay(now);
  const lastDay = addDays(today, MAX_BOOKING_DAYS_AHEAD - 1);

  function emit(nextDay: Date | undefined, nextMinutes: number | undefined) {
    onChange(
      nextDay !== undefined && nextMinutes !== undefined ? atMinutes(nextDay, nextMinutes) : null,
    );
  }

  // A slot is unavailable if it has already passed today.
  const slotDisabled = (m: number) => !!day && isSameDay(day, now) && atMinutes(day, m) <= now;

  return (
    <div className="grid grid-cols-[1fr_8.5rem] gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              "justify-start font-normal",
              !day && "text-muted-foreground",
              invalid && "border-destructive",
            )}
          >
            <CalendarIcon className="opacity-60" />
            {day ? format(day, "EEE d MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={day}
            defaultMonth={day ?? today}
            startMonth={today}
            endMonth={lastDay}
            disabled={[{ before: today }, { after: lastDay }]}
            onSelect={(d) => {
              setDay(d);
              // Drop a time that is no longer valid for the new day.
              const keep =
                minutes !== undefined && d && !(isSameDay(d, now) && atMinutes(d, minutes) <= now);
              const nextMinutes = keep ? minutes : undefined;
              setMinutes(nextMinutes);
              emit(d, nextMinutes);
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <Select
        value={minutes === undefined ? "" : String(minutes)}
        onValueChange={(v) => {
          const m = Number(v);
          setMinutes(m);
          emit(day, m);
        }}
        disabled={!day}
      >
        <SelectTrigger aria-label="Time" aria-invalid={invalid || undefined}>
          <SelectValue placeholder="Time" />
        </SelectTrigger>
        <SelectContent>
          {SLOTS.map((m) => (
            <SelectItem key={m} value={String(m)} disabled={slotDisabled(m)}>
              {timeLabel.format(atMinutes(today, m))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
