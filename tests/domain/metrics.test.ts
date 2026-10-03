import { describe, expect, it } from "vitest";
import { computeMetrics, statusForCertificate, type MetricsVendor } from "@/lib/domain/metrics";
import { evaluateCertificate } from "@/lib/domain/rules";
import { DEFAULT_TEMPLATE_RULES, type Extraction } from "@/lib/domain/types";
import {
  compliantExtraction,
  deficientExtraction,
  expiredExtraction,
  expiringExtraction,
  ORG_LEGAL_NAME,
  TODAY,
} from "./fixtures/extractions";

type Row = MetricsVendor & { id: string };

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  status: "compliant",
  contractValueCents: 1_000_000,
  earliestExpiration: "2027-01-01",
  ...overrides,
});

describe("statusForCertificate", () => {
  it("is missing when there is no certificate", () => {
    expect(statusForCertificate(null)).toBe("missing");
  });

  it.each([
    [compliantExtraction, "compliant"],
    [deficientExtraction, "deficient"],
    [expiringExtraction, "expiring"],
    [expiredExtraction, "expired"],
  ] as Array<[Extraction, string]>)("follows the evaluation status (%#)", (extraction, status) => {
    const evaluation = evaluateCertificate(extraction, DEFAULT_TEMPLATE_RULES, TODAY, { holderName: ORG_LEGAL_NAME });
    expect(statusForCertificate(evaluation)).toBe(status);
  });
});

describe("computeMetrics", () => {
  const roster: Row[] = [
    row("a", { status: "compliant", contractValueCents: 5_000_000 }),
    row("b", { status: "compliant", contractValueCents: 2_000_000, earliestExpiration: "2026-11-02" }),
    row("c", { status: "deficient", contractValueCents: 4_850_000, earliestExpiration: "2026-10-20" }),
    row("d", { status: "expiring", contractValueCents: 1_250_000, earliestExpiration: "2026-10-15" }),
    row("e", { status: "expired", contractValueCents: 900_000, earliestExpiration: "2026-09-30" }),
    row("f", { status: "missing", contractValueCents: 300_000, earliestExpiration: null }),
    row("g", { status: "expiring", contractValueCents: 700_000, earliestExpiration: TODAY }),
  ];

  it("counts vendors per status, including zeros", () => {
    const metrics = computeMetrics(roster, TODAY);
    expect(metrics.total).toBe(7);
    expect(metrics.counts).toEqual({ missing: 1, compliant: 2, deficient: 1, expiring: 2, expired: 1 });
    expect(metrics.expiredCount).toBe(1);
    expect(metrics.missingCount).toBe(1);
  });

  it("computes the compliant share over every vendor, missing included", () => {
    expect(computeMetrics(roster, TODAY).compliantRate).toBeCloseTo(2 / 7, 10);
  });

  it("sums contract value at risk over every vendor that is not compliant", () => {
    expect(computeMetrics(roster, TODAY).valueAtRiskCents).toBe(4_850_000 + 1_250_000 + 900_000 + 300_000 + 700_000);
  });

  it("lists vendors whose earliest expiration is in the next 30 days, soonest first", () => {
    const ids = computeMetrics(roster, TODAY).expiringWithin30.map((v) => v.id);
    // Day 30 (2026-11-02) is included; expired and missing vendors are not.
    expect(ids).toEqual(["g", "d", "c", "b"]);
  });

  it("keeps the caller's fields on listed vendors and keeps input order on equal dates", () => {
    const tied = [row("x", { earliestExpiration: "2026-10-10" }), row("y", { earliestExpiration: "2026-10-10" })];
    const listed = computeMetrics(tied, TODAY).expiringWithin30;
    expect(listed.map((v) => v.id)).toEqual(["x", "y"]);
    expect(listed[0]).toBe(tied[0]);
  });

  it("excludes day 31", () => {
    expect(computeMetrics([row("z", { earliestExpiration: "2026-11-03" })], TODAY).expiringWithin30).toEqual([]);
  });

  it("returns empty metrics with a null rate for an empty roster", () => {
    expect(computeMetrics([], TODAY)).toEqual({
      total: 0,
      counts: { missing: 0, compliant: 0, deficient: 0, expiring: 0, expired: 0 },
      compliantRate: null,
      valueAtRiskCents: 0,
      expiringWithin30: [],
      expiredCount: 0,
      missingCount: 0,
    });
  });

  it("is 1 when every vendor is compliant, with nothing at risk", () => {
    const metrics = computeMetrics([row("a"), row("b")], TODAY);
    expect(metrics.compliantRate).toBe(1);
    expect(metrics.valueAtRiskCents).toBe(0);
  });

  it("does not mutate or reorder its input", () => {
    const input = [...roster];
    computeMetrics(input, TODAY);
    expect(input).toEqual(roster);
  });
});
