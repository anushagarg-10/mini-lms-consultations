"use client";

import { ErrorState } from "@/components/error-state";

/**
 * Errors in signed-in pages (dashboard, admin). Renders inside the app shell,
 * so the header and navigation stay usable.
 */
export default function AppPageError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState {...props} />;
}
