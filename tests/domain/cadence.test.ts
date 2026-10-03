import { describe, expect, it } from "vitest";
import {
  chaseKindForStatus,
  chaseRecipient,
  DEFAULT_SEND_WINDOW,
  nextSendTime,
  nextStep,
  planChase,
  shouldStopChasing,
  type ChasePolicy,
  type PlannedStep,
} from "@/lib/domain/cadence";
import { getZonedParts } from "@/lib/domain/dates";
import { makeVendor } from "./fixtures/entities";

const NY: ChasePolicy = { timezone: "America/New_York" };
/** Monday 2026-10-05 10:00 EDT. */
const MONDAY_10AM = new Date("2026-10-05T14:00:00Z");

const iso = (steps: PlannedStep[]) => steps.map((s) => s.scheduledAt.toISOString());

describe("nextSendTime", () => {
  it("returns the same instant inside the window", () => {
    expect(nextSendTime(MONDAY_10AM, "America/New_York").toISOString()).toBe("2026-10-05T14:00:00.000Z");
  });

  it("moves Saturday to Monday 08:00 org-local", () => {
    expect(nextSendTime(new Date("2026-10-03T16:00:00Z"), "America/New_York").toISOString()).toBe(
      "2026-10-05T12:00:00.000Z",
    );
  });

  it("treats 18:00 as outside the window", () => {
    expect(nextSendTime(new Date("2026-10-05T22:00:00Z"), "America/New_York").toISOString()).toBe(
      "2026-10-06T12:00:00.000Z",
    );
  });

  it("has a weekday 08:00-18:00 default window", () => {
    expect(DEFAULT_SEND_WINDOW).toEqual({ weekdays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 });
  });
});

describe("planChase: request_initial and deficiency", () => {
  it.each(["request_initial", "deficiency"] as const)(
    "%s plans day 0, +7 and +14 at 09:00 org-local, never before now",
    (kind) => {
      const plan = planChase(kind, "2026-10-05", MONDAY_10AM, NY);
      expect(plan.map((s) => [s.step, s.kind, s.dayOffset])).toEqual([
        [1, kind, 0],
        [2, kind, 7],
        [3, kind, 14],
      ]);
      // Day 0's 09:00 has passed, so it goes now; later steps at 09:00 EDT (13:00Z).
      expect(iso(plan)).toEqual([
        "2026-10-05T14:00:00.000Z",
        "2026-10-12T13:00:00.000Z",
        "2026-10-19T13:00:00.000Z",
      ]);
    },
  );

  it("moves weekend steps into the next weekday window and keeps them 7 calendar days apart", () => {
    // Detected on Saturday 2026-10-03: day 0 opens Monday 08:00; later steps at the 09:00 send hour.
    const plan = planChase("deficiency", "2026-10-03", new Date("2026-10-03T12:00:00Z"), NY);
    expect(iso(plan)).toEqual([
      "2026-10-05T12:00:00.000Z",
      "2026-10-12T13:00:00.000Z",
      "2026-10-19T13:00:00.000Z",
    ]);
  });

  it("restarts a stale ladder from now instead of dropping steps", () => {
    const plan = planChase("request_initial", "2026-09-01", MONDAY_10AM, NY);
    expect(plan.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(iso(plan)).toEqual([
      "2026-10-05T14:00:00.000Z",
      "2026-10-12T13:00:00.000Z",
      "2026-10-19T13:00:00.000Z",
    ]);
  });

  it("schedules in the org's own zone (Asia/Karachi, no DST)", () => {
    const plan = planChase("request_initial", "2026-10-05", new Date("2026-10-05T00:00:00Z"), {
      timezone: "Asia/Karachi",
    });
    expect(iso(plan)[0]).toBe("2026-10-05T04:00:00.000Z");
  });

  it("respects a custom send hour and window", () => {
    const plan = planChase("deficiency", "2026-10-06", MONDAY_10AM, {
      timezone: "America/New_York",
      sendHour: 14,
      sendWindow: { weekdays: [2, 4], startHour: 10, endHour: 16 },
    });
    // Tue 14:00 EDT; +7 Tue; +14 Tue.
    expect(iso(plan)).toEqual([
      "2026-10-06T18:00:00.000Z",
      "2026-10-13T18:00:00.000Z",
      "2026-10-20T18:00:00.000Z",
    ]);
  });
});

describe("planChase: renewal", () => {
  it("plans 30, 14 and 7 days before expiration, across the DST change", () => {
    const plan = planChase("renewal", "2026-12-15", MONDAY_10AM, NY);
    expect(plan.map((s) => [s.step, s.dayOffset])).toEqual([
      [1, -30],
      [2, -14],
      [3, -7],
    ]);
    // -30 is Sunday 2026-11-15 -> Monday 08:00 EST (13:00Z); others 09:00 EST (14:00Z).
    expect(iso(plan)).toEqual([
      "2026-11-16T13:00:00.000Z",
      "2026-12-01T14:00:00.000Z",
      "2026-12-08T14:00:00.000Z",
    ]);
  });

  it("drops steps whose day has passed and keeps the step numbers", () => {
    // Expires Saturday 2026-10-17: -30 and -14 are past; -7 is Saturday 10-10 -> Monday 10-12.
    const plan = planChase("renewal", "2026-10-17", MONDAY_10AM, NY);
    expect(plan.map((s) => [s.step, s.dayOffset])).toEqual([[3, -7]]);
    expect(iso(plan)).toEqual(["2026-10-12T12:00:00.000Z"]);
  });

  it("keeps a step that falls today even though its send hour has passed", () => {
    const plan = planChase("renewal", "2026-10-19", MONDAY_10AM, NY);
    expect(plan.map((s) => s.step)).toEqual([2, 3]);
    expect(iso(plan)).toEqual(["2026-10-05T14:00:00.000Z", "2026-10-12T13:00:00.000Z"]);
  });

  it("pushes today's step to the next slot when the window has closed", () => {
    const evening = new Date("2026-10-05T23:00:00Z"); // 19:00 EDT
    expect(iso(planChase("renewal", "2026-10-19", evening, NY))[0]).toBe("2026-10-06T12:00:00.000Z");
  });

  it.each(["2026-10-08", "2026-10-05"])(
    "schedules one step at the next send slot when every step has passed but the policy is in force (expires %s)",
    (expiration) => {
      const plan = planChase("renewal", expiration, MONDAY_10AM, NY);
      expect(plan).toHaveLength(1);
      expect(plan[0]).toMatchObject({ step: 3, kind: "renewal", dayOffset: -7 });
      expect(plan[0].scheduledAt.toISOString()).toBe("2026-10-05T14:00:00.000Z");
    },
  );

  it("the catch-up step waits for the window (Saturday evening -> Monday 08:00)", () => {
    const plan = planChase("renewal", "2026-10-06", new Date("2026-10-03T22:00:00Z"), NY);
    expect(iso(plan)).toEqual(["2026-10-05T12:00:00.000Z"]);
  });

  it("returns no steps once the policy has expired (it becomes a deficiency chase)", () => {
    expect(planChase("renewal", "2026-10-04", MONDAY_10AM, NY)).toEqual([]);
  });

  it("judges 'expired' by the org-local date, not UTC", () => {
    // 2026-10-06T02:00Z is still Monday 10-05 in New York, so a 10-05 expiry is in force.
    const lateMonday = new Date("2026-10-06T02:00:00Z");
    expect(planChase("renewal", "2026-10-05", lateMonday, NY)).toHaveLength(1);
    expect(planChase("renewal", "2026-10-05", lateMonday, { timezone: "Asia/Karachi" })).toEqual([]);
  });
});

describe("planChase: invariants and validation", () => {
  it("every step is inside the weekday 08:00-18:00 window, in ascending order", () => {
    const plans = [
      planChase("renewal", "2027-03-20", new Date("2027-01-15T15:00:00Z"), NY),
      planChase("deficiency", "2027-03-07", new Date("2027-03-07T15:00:00Z"), NY),
      planChase("request_initial", "2026-10-31", new Date("2026-10-31T15:00:00Z"), NY),
    ];
    for (const plan of plans) {
      const times = plan.map((s) => s.scheduledAt.getTime());
      expect([...times].sort((a, b) => a - b)).toEqual(times);
      for (const step of plan) {
        const local = getZonedParts(step.scheduledAt, "America/New_York");
        expect(local.weekday).toBeLessThanOrEqual(5);
        expect(local.hour).toBeGreaterThanOrEqual(8);
        expect(local.hour).toBeLessThan(18);
      }
    }
  });

  it.each([-1, 24, 9.5])("rejects send hour %s", (sendHour) => {
    expect(() => planChase("deficiency", "2026-10-05", MONDAY_10AM, { ...NY, sendHour })).toThrow(RangeError);
  });

  it("rejects an invalid anchor date or zone", () => {
    expect(() => planChase("deficiency", "2026-02-30", MONDAY_10AM, NY)).toThrow(RangeError);
    expect(() => planChase("deficiency", "2026-10-05", MONDAY_10AM, { timezone: "Mars/Olympus" })).toThrow(
      RangeError,
    );
  });

  it("rejects an empty send window", () => {
    expect(() =>
      planChase("deficiency", "2026-10-05", MONDAY_10AM, {
        ...NY,
        sendWindow: { weekdays: [], startHour: 8, endHour: 18 },
      }),
    ).toThrow(RangeError);
  });
});

describe("nextStep", () => {
  const plan = planChase("deficiency", "2026-10-05", MONDAY_10AM, NY);

  it("returns the first step when nothing has been sent", () => {
    expect(nextStep(plan, 0)).toBe(plan[0]);
  });

  it("returns the step after the last one sent", () => {
    expect(nextStep(plan, 1)).toBe(plan[1]);
    expect(nextStep(plan, 2)).toBe(plan[2]);
  });

  it("returns null when the ladder is finished", () => {
    expect(nextStep(plan, 3)).toBeNull();
    expect(nextStep([], 0)).toBeNull();
  });

  it("skips step numbers that were dropped from a late renewal plan", () => {
    const renewal = planChase("renewal", "2026-10-17", MONDAY_10AM, NY);
    expect(nextStep(renewal, 0)?.step).toBe(3);
    expect(nextStep(renewal, 1)?.step).toBe(3);
  });
});

describe("shouldStopChasing", () => {
  it("stops a compliant vendor", () => {
    expect(shouldStopChasing("compliant", makeVendor())).toBe("compliant");
  });

  it.each(["missing", "deficient", "expiring", "expired"] as const)("stops a do-not-contact vendor (%s)", (status) => {
    expect(shouldStopChasing(status, makeVendor({ doNotContact: true }))).toBe("do_not_contact");
  });

  it.each(["missing", "deficient", "expiring", "expired"] as const)("keeps chasing a %s vendor", (status) => {
    expect(shouldStopChasing(status, makeVendor())).toBeNull();
  });
});

describe("chaseKindForStatus", () => {
  it.each([
    ["missing", "request_initial"],
    ["deficient", "deficiency"],
    ["expired", "deficiency"],
    ["expiring", "renewal"],
    ["compliant", null],
  ] as const)("%s -> %s", (status, kind) => {
    expect(chaseKindForStatus(status)).toBe(kind);
  });
});

describe("chaseRecipient", () => {
  it("prefers the broker when known", () => {
    expect(chaseRecipient(makeVendor())).toBe("service@pioneerrisk.example.com");
  });

  it.each([null, undefined, "  "])("falls back to the vendor contact when the broker email is %j", (brokerEmail) => {
    expect(chaseRecipient(makeVendor({ brokerEmail }))).toBe("office@bluestonemasonry.example.com");
  });
});
