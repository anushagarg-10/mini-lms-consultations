import { Badge } from "@/components/ui/badge";
import type { Consultation } from "@/lib/consultations/schemas";

export function ConsultationStatusBadge({
  consultation,
}: {
  consultation: Pick<Consultation, "status" | "completed">;
}) {
  if (consultation.status === "cancelled") return <Badge variant="destructive">Cancelled</Badge>;
  if (consultation.completed) return <Badge>Completed</Badge>;
  return <Badge variant="outline">Scheduled</Badge>;
}
