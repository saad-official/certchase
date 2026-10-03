/**
 * Dashboard metrics (spec 3.6). Pure: callers inject `today` (org-local date).
 */
import { addDaysToIsoDate } from "./dates";
import { VENDOR_STATUSES, type Evaluation, type IsoDate, type VendorStatus } from "./types";

export const EXPIRING_WINDOW_DAYS = 30;

export interface MetricsVendor {
  status: VendorStatus;
  contractValueCents: number;
  earliestExpiration: IsoDate | null;
}

export interface ComplianceMetrics<T extends MetricsVendor> {
  total: number;
  counts: Record<VendorStatus, number>;
  /** compliant / total, 0..1 (missing vendors count against it); null for an empty roster. */
  compliantRate: number | null;
  /** Sum of contract values for every vendor that is not compliant (missing included). */
  valueAtRiskCents: number;
  /** Vendors whose earliest expiration is today..today+30 inclusive, soonest first (stable). */
  expiringWithin30: T[];
  expiredCount: number;
  missingCount: number;
}

/** Vendor status derived from its latest certificate evaluation (spec 3.2). */
export function statusForCertificate(evaluation: Pick<Evaluation, "status"> | null): VendorStatus {
  return evaluation ? evaluation.status : "missing";
}

export function computeMetrics<T extends MetricsVendor>(vendors: readonly T[], today: IsoDate): ComplianceMetrics<T> {
  const counts = Object.fromEntries(VENDOR_STATUSES.map((s) => [s, 0])) as Record<VendorStatus, number>;
  let valueAtRiskCents = 0;
  for (const vendor of vendors) {
    counts[vendor.status] += 1;
    if (vendor.status !== "compliant") valueAtRiskCents += vendor.contractValueCents;
  }

  const horizon = addDaysToIsoDate(today, EXPIRING_WINDOW_DAYS);
  const expiringWithin30 = vendors
    .filter(
      (v): v is T & { earliestExpiration: IsoDate } =>
        v.earliestExpiration !== null && v.earliestExpiration >= today && v.earliestExpiration <= horizon,
    )
    .map((vendor, index) => ({ vendor, index }))
    .sort((a, b) =>
      a.vendor.earliestExpiration === b.vendor.earliestExpiration
        ? a.index - b.index
        : a.vendor.earliestExpiration < b.vendor.earliestExpiration
          ? -1
          : 1,
    )
    .map(({ vendor }) => vendor);

  return {
    total: vendors.length,
    counts,
    compliantRate: vendors.length === 0 ? null : counts.compliant / vendors.length,
    valueAtRiskCents,
    expiringWithin30,
    expiredCount: counts.expired,
    missingCount: counts.missing,
  };
}
