/**
 * Deterministic chase planner (spec 3.5). Pure: callers inject `now`.
 *
 * - request_initial / deficiency: day 0, +7, +14 after the anchor (the date the
 *   condition was detected). The ladder is relative, so a late start keeps every
 *   step: each is pushed to >= now and to the send hour >= 7 org-local calendar
 *   days after the previous step's send day.
 * - renewal: 30, 14 and 7 days before the anchor (the expiration date). These are
 *   pinned to the expiration, so steps whose org-local day has passed are dropped;
 *   if none remain while the policy is still in force, one catch-up step goes at
 *   the next send slot. After expiration there is no renewal plan (it becomes a
 *   deficiency chase).
 * All times land in the org-local send window (weekdays 08:00-18:00 by default).
 */
import { addDaysToIsoDate, getZonedParts, isoDateInZone, isoWeekday, zonedTimeToUtc } from "./dates";
import type { ChaseKind, IsoDate, Vendor, VendorStatus } from "./types";

export interface SendWindow {
  /** ISO weekdays allowed, 1 = Monday ... 7 = Sunday. */
  weekdays: number[];
  /** Inclusive local start hour. */
  startHour: number;
  /** Exclusive local end hour: 18 means the last allowed minute is 17:59. */
  endHour: number;
}

export const DEFAULT_SEND_WINDOW: SendWindow = { weekdays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 };
export const DEFAULT_SEND_HOUR = 9;
/** Minimum spacing, in org-local calendar days, between steps of a request/deficiency ladder. */
export const RELATIVE_MIN_GAP_DAYS = 7;

export interface ChasePolicy {
  /** IANA zone of the organisation. */
  timezone: string;
  sendWindow?: SendWindow;
  /** Preferred local hour on a step's day (default 9). */
  sendHour?: number;
}

export type ChaseStepNumber = 1 | 2 | 3;

export interface PlannedStep {
  step: ChaseStepNumber;
  kind: ChaseKind;
  /** Calendar days from the anchor the step was planned for (negative = before expiration). */
  dayOffset: number;
  scheduledAt: Date;
}

const LADDERS: Record<ChaseKind, ReadonlyArray<{ step: ChaseStepNumber; dayOffset: number }>> = {
  request_initial: [
    { step: 1, dayOffset: 0 },
    { step: 2, dayOffset: 7 },
    { step: 3, dayOffset: 14 },
  ],
  deficiency: [
    { step: 1, dayOffset: 0 },
    { step: 2, dayOffset: 7 },
    { step: 3, dayOffset: 14 },
  ],
  renewal: [
    { step: 1, dayOffset: -30 },
    { step: 2, dayOffset: -14 },
    { step: 3, dayOffset: -7 },
  ],
};

function assertWindow(window: SendWindow): void {
  const validDays = window.weekdays.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (validDays.length === 0) throw new RangeError("Send window must allow at least one weekday (1-7)");
  if (
    !Number.isInteger(window.startHour) ||
    !Number.isInteger(window.endHour) ||
    window.startHour < 0 ||
    window.endHour > 24 ||
    window.startHour >= window.endHour
  ) {
    throw new RangeError("Send window needs integer hours with 0 <= startHour < endHour <= 24");
  }
}

/**
 * Earliest instant >= `date` inside the send window in `timezone`. Window bounds are
 * org-local wall-clock times, so the UTC result shifts correctly across DST.
 */
export function nextSendTime(date: Date, timezone: string, window: SendWindow = DEFAULT_SEND_WINDOW): Date {
  assertWindow(window);
  const local = getZonedParts(date, timezone);
  const allowed = new Set(window.weekdays);

  if (allowed.has(local.weekday)) {
    if (local.hour >= window.startHour && local.hour < window.endHour) return date;
    if (local.hour < window.startHour) {
      return zonedTimeToUtc(isoDateInZone(date, timezone), window.startHour, 0, timezone);
    }
  }

  const today = isoDateInZone(date, timezone);
  for (let offset = 1; offset <= 7; offset++) {
    const day = addDaysToIsoDate(today, offset);
    if (allowed.has(isoWeekday(day))) return zonedTimeToUtc(day, window.startHour, 0, timezone);
  }
  throw new RangeError("No allowed weekday found in send window");
}

/** Plans the chase ladder for `kind` around `anchor`. See the module comment for the rules. */
export function planChase(kind: ChaseKind, anchor: IsoDate, now: Date, policy: ChasePolicy): PlannedStep[] {
  const window = policy.sendWindow ?? DEFAULT_SEND_WINDOW;
  const sendHour = policy.sendHour ?? DEFAULT_SEND_HOUR;
  if (!Number.isInteger(sendHour) || sendHour < 0 || sendHour > 23) {
    throw new RangeError("sendHour must be an integer from 0 to 23");
  }
  assertWindow(window);
  const tz = policy.timezone;
  const today = isoDateInZone(now, tz);
  const slot = (candidateMs: number): Date => nextSendTime(new Date(Math.max(candidateMs, now.getTime())), tz, window);
  const target = (day: IsoDate): number => zonedTimeToUtc(day, sendHour, 0, tz).getTime();

  if (kind === "renewal") {
    // Validates the anchor before any comparison.
    target(anchor);
    if (anchor < today) return [];
    const ladder = LADDERS.renewal;
    const upcoming = ladder.filter((rung) => addDaysToIsoDate(anchor, rung.dayOffset) >= today);
    if (upcoming.length === 0) {
      const last = ladder[ladder.length - 1];
      return [{ step: last.step, kind, dayOffset: last.dayOffset, scheduledAt: slot(now.getTime()) }];
    }
    return upcoming.map((rung) => ({
      step: rung.step,
      kind,
      dayOffset: rung.dayOffset,
      scheduledAt: slot(target(addDaysToIsoDate(anchor, rung.dayOffset))),
    }));
  }

  const planned: PlannedStep[] = [];
  let previous: Date | null = null;
  for (const rung of LADDERS[kind]) {
    let candidate = target(addDaysToIsoDate(anchor, rung.dayOffset));
    if (previous) {
      // At least 7 org-local calendar days after the previous send, at the send hour.
      candidate = Math.max(candidate, target(addDaysToIsoDate(isoDateInZone(previous, tz), RELATIVE_MIN_GAP_DAYS)));
    }
    const scheduledAt = slot(candidate);
    planned.push({ step: rung.step, kind, dayOffset: rung.dayOffset, scheduledAt });
    previous = scheduledAt;
  }
  return planned;
}

/** The first planned step after `lastStep` (0 = nothing sent yet), or null when the ladder is done. */
export function nextStep(plan: readonly PlannedStep[], lastStep: number): PlannedStep | null {
  return plan.find((s) => s.step > lastStep) ?? null;
}

export type ChaseStopReason = "compliant" | "do_not_contact";

/** Why chasing must stop for this vendor, or null when it may continue. */
export function shouldStopChasing(
  status: VendorStatus,
  vendor: Pick<Vendor, "doNotContact">,
): ChaseStopReason | null {
  if (status === "compliant") return "compliant";
  if (vendor.doNotContact) return "do_not_contact";
  return null;
}

/** Which chase a vendor status calls for (spec 3.5), or null for compliant vendors. */
export function chaseKindForStatus(status: VendorStatus): ChaseKind | null {
  switch (status) {
    case "missing":
      return "request_initial";
    case "deficient":
    case "expired":
      return "deficiency";
    case "expiring":
      return "renewal";
    case "compliant":
      return null;
  }
}

/** Emails go to the broker when known, else the vendor contact (spec 3.5). */
export function chaseRecipient(vendor: Pick<Vendor, "contactEmail" | "brokerEmail">): string {
  const broker = vendor.brokerEmail?.trim();
  return broker ? broker : vendor.contactEmail;
}
