/** Small, dependency-free formatters shared by the queue, outbox and dashboard (server and client safe). */

export type ChaseKindValue = "request_initial" | "deficiency" | "renewal";

const KIND_LABELS: Record<ChaseKindValue, string> = {
  request_initial: "First request",
  deficiency: "Deficiency",
  renewal: "Renewal",
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind as ChaseKindValue] ?? kind;
}

/** Lower-case noun for sentences: "first request", "deficiency", "renewal". */
export function kindNoun(kind: string): string {
  return kindLabel(kind).toLowerCase();
}

/** "Sep 30" (or "Sep 30, 2027" outside the current year) for a YYYY-MM-DD calendar date. */
export function formatCalendarDate(iso: string, now = new Date()): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(y === now.getUTCFullYear() ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(date);
}

/** "Oct 3, 14:05" for an instant, read in the given IANA zone. */
export function formatDateTime(isoInstant: string, timeZone = "UTC"): string {
  const date = new Date(isoInstant);
  if (Number.isNaN(date.getTime())) return isoInstant;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** "in 12 days", "today", "tomorrow", "3 days ago" for a signed day count. */
export function daysLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function percent(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}
