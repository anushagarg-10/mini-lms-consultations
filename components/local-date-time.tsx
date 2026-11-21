"use client";

import { useSyncExternalStore } from "react";

const OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};
const formatter = new Intl.DateTimeFormat(undefined, OPTIONS);
// Same shape, pinned to UTC and labelled, for the server render before hydration.
const utcFormatter = new Intl.DateTimeFormat("en-AU", { ...OPTIONS, timeZone: "UTC", timeZoneName: "short" });

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
      {isClient ? formatter.format(date) : utcFormatter.format(date)}
    </time>
  );
}
