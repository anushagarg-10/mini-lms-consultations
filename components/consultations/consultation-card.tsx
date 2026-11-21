"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Clock, User, XCircle } from "lucide-react";
import { ConsultationStatusBadge, consultationState } from "./consultation-status-badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LocalDateTime } from "@/components/local-date-time";
import { futureDateTime, type Consultation, type UpdateConsultationInput } from "@/lib/consultations/schemas";
import { ApiRequestError, consultationsApi } from "@/lib/consultations/client-api";
import { DateTimePicker } from "@/components/date-time-picker";

export function ConsultationCard({ consultation }: { consultation: Consultation }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const isCancelled = consultation.status === "cancelled";

  /** Send one change, then re-render the server data. */
  async function mutate(input: UpdateConsultationInput, success: string): Promise<boolean> {
    setBusy(true);
    try {
      await consultationsApi.update(consultation.id, input);
      toast.success(success);
      startTransition(() => router.refresh());
      return true;
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || isPending;

  return (
    <Card
      className={cn(
        "border-l-4 transition-shadow hover:shadow-md",
        {
          scheduled: "border-l-primary",
          completed: "border-l-emerald-500",
          cancelled: "border-l-muted-foreground/30 opacity-75",
        }[consultationState(consultation)],
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-muted-foreground" aria-hidden />
            <LocalDateTime value={consultation.scheduledAt} />
          </CardTitle>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="size-4" aria-hidden />
            {consultation.firstName} {consultation.lastName}
          </p>
        </div>
        <ConsultationStatusBadge consultation={consultation} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 px-3 py-2 text-sm">
          {consultation.reason}
        </p>

        {!isCancelled && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`complete-${consultation.id}`}
                checked={consultation.completed}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  mutate(
                    { completed: checked === true },
                    checked === true ? "Marked as complete" : "Marked as incomplete",
                  )
                }
              />
              <Label htmlFor={`complete-${consultation.id}`} className="cursor-pointer">
                Completed
              </Label>
            </div>

            <div className="ml-auto flex gap-2">
              <RescheduleDialog
                consultation={consultation}
                disabled={disabled || consultation.completed}
                onSubmit={(scheduledAt) => mutate({ scheduledAt }, "Consultation rescheduled")}
              />
              <CancelDialog
                disabled={disabled || consultation.completed}
                onConfirm={() => mutate({ status: "cancelled" }, "Consultation cancelled")}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RescheduleDialog({
  consultation,
  disabled,
  onSubmit,
}: {
  consultation: Consultation;
  disabled: boolean;
  onSubmit: (scheduledAt: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [when, setWhen] = useState<Date | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!when) return setError("Choose a new date and time");

    const iso = when.toISOString();
    const parsed = futureDateTime.safeParse(iso);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid date");
    if (Date.parse(iso) === Date.parse(consultation.scheduledAt)) {
      return setError("Pick a different time");
    }

    setError(null);
    setSubmitting(true);
    const ok = await onSubmit(iso);
    setSubmitting(false);
    if (ok) setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setError(null);
        setWhen(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={consultation.completed ? "Mark incomplete to reschedule" : undefined}
        >
          <CalendarClock /> Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reschedule consultation</DialogTitle>
            <DialogDescription>
              Currently <LocalDateTime value={consultation.scheduledAt} />.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`reschedule-${consultation.id}`}>New date and time</Label>
            <DateTimePicker
              id={`reschedule-${consultation.id}`}
              value={when}
              onChange={setWhen}
              invalid={!!error}
            />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep current time
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save new time"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <XCircle /> Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this consultation?</AlertDialogTitle>
          <AlertDialogDescription>
            This can&apos;t be undone. You can book a new consultation at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onConfirm()}>
            Cancel consultation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
