"use client";

import { ErrorState } from "@/components/error-state";

/**
 * Errors thrown by a layout below the root, e.g. the signed-in layout when
 * the account can't be verified because the database is unavailable.
 * (A segment's own error.tsx can't catch errors from its own layout.)
 */
export default function RootSegmentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <ErrorState {...props} className="flex flex-col items-center gap-4 text-center" />
    </main>
  );
}
