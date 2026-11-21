"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared UI for Next.js error boundaries.
 *
 * In production Next.js hides server error messages from the browser and
 * passes a `digest` instead; the full error is in the server logs under the
 * same digest, so we show it as a reference the user can quote.
 */
export function ErrorState({
  error,
  reset,
  className,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  className?: string;
}) {
  const router = useRouter();

  // reset() alone only re-renders on the client. Server errors (e.g. the
  // database was briefly down) need the server data fetched again too.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    console.error("Page error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <div
      role="alert"
      className={
        className ??
        "flex flex-col items-center gap-4 rounded-lg border border-dashed p-10 text-center"
      }
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" aria-hidden />
      </span>
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load this page. Please try again in a moment.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
      <Button onClick={retry}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
