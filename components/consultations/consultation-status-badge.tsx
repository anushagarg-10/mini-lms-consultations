import { CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Consultation } from "@/lib/consultations/schemas";

const STYLES = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  scheduled: {
    label: "Scheduled",
    icon: CircleDot,
    className:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "border-border bg-muted text-muted-foreground",
  },
} as const;

export function consultationState(c: Pick<Consultation, "status" | "completed">) {
  if (c.status === "cancelled") return "cancelled" as const;
  return c.completed ? ("completed" as const) : ("scheduled" as const);
}

export function ConsultationStatusBadge({
  consultation,
}: {
  consultation: Pick<Consultation, "status" | "completed">;
}) {
  const { label, icon: Icon, className } = STYLES[consultationState(consultation)];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  );
}
