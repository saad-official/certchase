/**
 * Display helpers shared by the vendor, certificate and template screens.
 * Pure (no server-only imports) so client components can use them too.
 */
import { daysBetweenIsoDates, isoDateInZone } from "@/lib/domain/dates";
import { VENDOR_STATUSES, type VendorStatus } from "@/lib/domain/types";

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function todayInZone(now: Date, timeZone: string): string {
  try {
    return isoDateInZone(now, timeZone || "UTC");
  } catch {
    return isoDateInZone(now, "UTC");
  }
}

/** "Oct 21, 2026" for a calendar date (no zone shift). */
export function formatCalendarDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "Oct 7" (adds the year when it differs from `today`'s). */
export function formatShortDate(iso: string, today?: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const sameYear = today ? today.slice(0, 4) === iso.slice(0, 4) : true;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Oct 3, 2026, 14:05" in the org's zone. */
export function formatTimestamp(value: string | Date, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      hourCycle: "h23",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16);
  }
}

/** "in 18 days", "today", "12 days ago". */
export function relativeDays(iso: string, today: string): string {
  const days = daysBetweenIsoDates(today, iso.slice(0, 10));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function daysUntil(iso: string, today: string): number {
  return daysBetweenIsoDates(today, iso.slice(0, 10));
}

export function parseVendorStatus(value: string | null | undefined): VendorStatus {
  return (VENDOR_STATUSES as readonly string[]).includes(value ?? "") ? (value as VendorStatus) : "missing";
}

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  missing: "Missing",
  compliant: "Compliant",
  deficient: "Deficient",
  expiring: "Expiring",
  expired: "Expired",
};

const CHASE_KIND_LABELS = {
  request_initial: "Request",
  deficiency: "Deficiency",
  renewal: "Renewal",
} as const;

export type ChaseKindKey = keyof typeof CHASE_KIND_LABELS;

export function chaseKindLabel(kind: string | null | undefined): string {
  return kind && kind in CHASE_KIND_LABELS ? CHASE_KIND_LABELS[kind as ChaseKindKey] : "Chase";
}

export type CadenceStateInput = {
  kind: string | null;
  step: number | null;
  status: string | null;
  nextRunAt: string | null;
  pauseReason?: string | null;
};

export type CadenceState = { label: string; tone: "default" | "muted" | "attention" };

const PAUSE_LABELS: Record<string, string> = {
  do_not_contact: "do not contact",
  compliant: "compliant",
  nothing_to_chase: "nothing to chase",
};

/**
 * "Request step 1 · next Oct 7", "Renewal step 2 · next Oct 20", "Stopped".
 * `step` in the database is the last step sent (0 = none), so the next one is step + 1.
 */
export function describeCadence(cadence: CadenceStateInput | null, timeZone: string, now: Date): CadenceState {
  if (!cadence || !cadence.kind || !cadence.status) return { label: "Not planned", tone: "muted" };
  const kind = chaseKindLabel(cadence.kind);
  const today = todayInZone(now, timeZone);
  switch (cadence.status) {
    case "active": {
      const nextStep = Math.min(3, (cadence.step ?? 0) + 1);
      if (!cadence.nextRunAt) return { label: `${kind} step ${nextStep}`, tone: "default" };
      const nextDay = todayInZone(new Date(cadence.nextRunAt), timeZone);
      const overdue = new Date(cadence.nextRunAt).getTime() < now.getTime();
      return {
        label: `${kind} step ${nextStep} · ${overdue ? "due" : "next"} ${formatShortDate(nextDay, today)}`,
        tone: overdue ? "attention" : "default",
      };
    }
    case "paused": {
      const reason = cadence.pauseReason ? PAUSE_LABELS[cadence.pauseReason] ?? cadence.pauseReason : null;
      return { label: reason ? `Paused · ${reason}` : "Paused", tone: "attention" };
    }
    case "completed":
      return { label: `${kind} complete · ${pluralize(cadence.step ?? 0, "email")} sent`, tone: "muted" };
    case "stopped":
    default:
      return { label: "Stopped", tone: "muted" };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CERTIFICATE_STATUS_LABELS: Record<string, string> = {
  pending: "Reading",
  extracted: "Extracted",
  failed: "Failed",
  superseded: "Superseded",
};

export const SOURCE_LABELS: Record<string, string> = {
  upload: "Upload",
  email: "Email",
  demo: "Demo",
};
