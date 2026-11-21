"use client";

import { useSyncExternalStore } from "react";

const formatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const subscribe = () => () => {};

/**
 * Renders a timestamp in the viewer's own timezone.
 * The server doesn't know the browser's timezone, so it renders the UTC
 * value first and the client swaps in the local format after hydration.
 */
export function LocalDateTime({ value }: { value: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const date = new Date(value);
  return (
    <time dateTime={value} title={date.toISOString()}>
      {isClient ? formatter.format(date) : date.toUTCString()}
    </time>
  );
}
