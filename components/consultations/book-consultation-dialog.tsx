"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createConsultationSchema } from "@/lib/consultations/schemas";
import { ApiRequestError, consultationsApi } from "@/lib/consultations/client-api";
import { DateTimePicker } from "@/components/date-time-picker";

type FieldErrors = Partial<Record<"firstName" | "lastName" | "reason" | "scheduledAt", string>>;

export function BookConsultationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [when, setWhen] = useState<Date | null>(null);

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const parsed = createConsultationSchema.safeParse({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      reason: form.get("reason"),
      scheduledAt: when ? when.toISOString() : undefined,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setErrors(
        Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as FieldErrors,
      );
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      await consultationsApi.create(parsed.data);
      toast.success("Consultation booked");
      setOpen(false);
      setWhen(null);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Could not book consultation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarPlus /> Book consultation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          onSubmit={onSubmit}
          onChange={(e) => {
            // Clear a field's error as soon as the user edits it.
            const { name } = e.target as unknown as { name?: string };
            if (name) clearError(name as keyof FieldErrors);
          }}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Book a consultation</DialogTitle>
            <DialogDescription>
              Tell us who it&apos;s for and when suits you. Times are in your local timezone.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="firstName" label="First name" error={errors.firstName}>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                maxLength={100}
                required
              />
            </Field>
            <Field id="lastName" label="Last name" error={errors.lastName}>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                maxLength={100}
                required
              />
            </Field>
          </div>

          <Field id="reason" label="Reason for consultation" error={errors.reason}>
            <Textarea
              id="reason"
              name="reason"
              rows={4}
              maxLength={1000}
              placeholder="e.g. I'd like help preparing for my Methods SAC"
              required
            />
          </Field>

          <Field id="scheduledAt" label="Date and time" error={errors.scheduledAt}>
            <DateTimePicker
              id="scheduledAt"
              value={when}
              onChange={(d) => {
                setWhen(d);
                if (d) clearError("scheduledAt");
              }}
              invalid={!!errors.scheduledAt}
              describedBy={errors.scheduledAt ? "scheduledAt-error" : undefined}
            />
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Booking..." : "Book consultation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
