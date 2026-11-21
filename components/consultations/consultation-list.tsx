import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Consultation } from "@/lib/consultations/schemas";
import { CalendarX2 } from "lucide-react";
import { ConsultationCard } from "./consultation-card";

type Groups = {
  upcoming: Consultation[];
  past: Consultation[];
  cancelled: Consultation[];
};

/** Split by state; past consultations are shown most recent first. */
export function groupConsultations(items: Consultation[], now: number): Groups {
  const groups: Groups = { upcoming: [], past: [], cancelled: [] };
  for (const c of items) {
    if (c.status === "cancelled") groups.cancelled.push(c);
    else if (Date.parse(c.scheduledAt) >= now) groups.upcoming.push(c);
    else groups.past.push(c);
  }
  groups.past.reverse();
  return groups;
}

const TABS = [
  {
    value: "upcoming",
    label: "Upcoming",
    empty: "No upcoming consultations. Book one to get started.",
  },
  { value: "past", label: "Past", empty: "No past consultations yet." },
  { value: "cancelled", label: "Cancelled", empty: "No cancelled consultations." },
] as const;

export function ConsultationList({ groups }: { groups: Groups }) {
  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList>
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
            <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {groups[t.value].length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {TABS.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          {groups[t.value].length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <CalendarX2 className="size-6 text-muted-foreground" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">{t.empty}</p>
            </div>
          ) : (
            <ul className="grid gap-4">
              {groups[t.value].map((c) => (
                <li key={c.id}>
                  <ConsultationCard consultation={c} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
