/**
 * Field paths, confidence and evidence lookup for an extraction.
 *
 * The extraction prompt asks the model for bracketed keys
 * ("policies[0].expirationDate") while the rule engine and applyReview use
 * dotted keys ("policies.0.expirationDate"). Both are normalised to the dotted
 * form here so the review panel sees every key whichever way it was written.
 */
import { formatLimit } from "@/lib/domain/normalize";
import type { Extraction, LimitField, Policy, PolicyType } from "@/lib/domain/types";
import { formatCalendarDate } from "@/components/vendors/format";

export const LOW_CONFIDENCE = 0.7;

export function normalizePath(key: string): string {
  return key.replace(/\[(\d+)\]/g, ".$1");
}

/** Normalised key → value. Duplicate keys keep the highest value (a reviewed field is 1). */
export function normalizeConfidence(fieldConfidence: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(fieldConfidence ?? {})) {
    const path = normalizePath(key);
    out[path] = Math.max(out[path] ?? Number.NEGATIVE_INFINITY, value);
  }
  return out;
}

export function normalizeEvidence(evidence: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(evidence ?? {})) out[normalizePath(key)] = value;
  return out;
}

/** Exact key first, then the longest key that is a dotted prefix of `path`. */
export function lookup<T>(map: Record<string, T>, path: string): T | undefined {
  if (path in map) return map[path];
  let best: string | undefined;
  for (const key of Object.keys(map)) {
    if (path.startsWith(`${key}.`) && (!best || key.length > best.length)) best = key;
  }
  return best === undefined ? undefined : map[best];
}

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  gl: "General liability",
  auto: "Automobile liability",
  wc: "Workers' compensation",
  umbrella: "Umbrella / excess",
  other: "Other",
};

export const POLICY_TYPE_SHORT: Record<PolicyType, string> = {
  gl: "GL",
  auto: "Auto",
  wc: "WC",
  umbrella: "Umbrella",
  other: "Other",
};

export const LIMIT_LABELS: Record<LimitField, string> = {
  eachOccurrenceCents: "Each occurrence",
  aggregateCents: "General aggregate",
  combinedSingleLimitCents: "Combined single limit",
  eachAccidentCents: "E.L. each accident",
};

export const LIMIT_FIELDS: LimitField[] = [
  "eachOccurrenceCents",
  "aggregateCents",
  "combinedSingleLimitCents",
  "eachAccidentCents",
];

/** Limits that belong on each policy type (others show only when the model filled them). */
export const LIMITS_BY_TYPE: Record<PolicyType, LimitField[]> = {
  gl: ["eachOccurrenceCents", "aggregateCents"],
  auto: ["combinedSingleLimitCents"],
  wc: ["eachAccidentCents"],
  umbrella: ["eachOccurrenceCents", "aggregateCents"],
  other: [],
};

export function limitFieldsFor(policy: Policy): LimitField[] {
  const base = LIMITS_BY_TYPE[policy.type];
  const extra = LIMIT_FIELDS.filter((f) => !base.includes(f) && policy.limits[f] !== null && policy.limits[f] !== undefined);
  return [...base, ...extra];
}

export const ENDORSEMENT_FIELDS = ["additionalInsured", "waiverOfSubrogation", "primaryNonContributory"] as const;
export type EndorsementField = (typeof ENDORSEMENT_FIELDS)[number];

export const ENDORSEMENT_LABELS: Record<EndorsementField, string> = {
  additionalInsured: "Additional insured",
  waiverOfSubrogation: "Waiver of subrogation",
  primaryNonContributory: "Primary / non-contributory",
};

export function formatBool(value: boolean | null | undefined): string {
  return value === true ? "Yes" : value === false ? "No" : "Not shown";
}

export function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatCalendarDate(value) : "Not shown";
}

export function formatMaybeLimit(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not shown" : formatLimit(value);
}

/* ------------------------------------------------------------------ */
/* Model vs fixture comparison                                         */
/* ------------------------------------------------------------------ */

export type ComparedField = { key: string; label: string; value: string };

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Flattens an extraction into comparable display values. Policies are keyed
 * by type and occurrence ("gl#0") rather than position, so a model that lists
 * the policies in another order is not penalised for it.
 */
export function flattenForComparison(extraction: Extraction): ComparedField[] {
  const out: ComparedField[] = [
    { key: "insuredName", label: "Insured", value: extraction.insuredName },
    { key: "producerName", label: "Producer", value: extraction.producerName },
    { key: "certificateHolderName", label: "Certificate holder", value: extraction.certificateHolderName ?? "Not shown" },
    { key: "issueDate", label: "Issue date", value: formatMaybeDate(extraction.issueDate) },
    {
      key: "noticeOfCancellationDays",
      label: "Notice of cancellation",
      value: extraction.noticeOfCancellationDays === null ? "Not shown" : `${extraction.noticeOfCancellationDays} days`,
    },
  ];
  const seen: Partial<Record<PolicyType, number>> = {};
  for (const policy of extraction.policies) {
    const n = seen[policy.type] ?? 0;
    seen[policy.type] = n + 1;
    const prefix = `${policy.type}#${n}`;
    const name = `${POLICY_TYPE_SHORT[policy.type]}${n > 0 ? ` ${n + 1}` : ""}`;
    out.push(
      { key: `${prefix}.present`, label: `${name} policy`, value: "Present" },
      { key: `${prefix}.insurer`, label: `${name} insurer`, value: policy.insurer ?? "Not shown" },
      { key: `${prefix}.policyNumber`, label: `${name} policy number`, value: policy.policyNumber ?? "Not shown" },
      { key: `${prefix}.effectiveDate`, label: `${name} effective`, value: formatMaybeDate(policy.effectiveDate) },
      { key: `${prefix}.expirationDate`, label: `${name} expiration`, value: formatMaybeDate(policy.expirationDate) },
    );
    for (const field of LIMIT_FIELDS) {
      const value = policy.limits[field];
      if (value === null || value === undefined) continue;
      out.push({ key: `${prefix}.limits.${field}`, label: `${name} ${LIMIT_LABELS[field].toLowerCase()}`, value: formatLimit(value) });
    }
    for (const field of ENDORSEMENT_FIELDS) {
      out.push({ key: `${prefix}.${field}`, label: `${name} ${ENDORSEMENT_LABELS[field].toLowerCase()}`, value: formatBool(policy[field]) });
    }
  }
  return out;
}

export type ComparisonRow = { key: string; label: string; fixture: string; model: string };

export function compareExtractions(model: Extraction, fixture: Extraction): { total: number; differences: ComparisonRow[] } {
  const m = new Map(flattenForComparison(model).map((f) => [f.key, f]));
  const f = new Map(flattenForComparison(fixture).map((x) => [x.key, x]));
  const keys = [...new Set([...f.keys(), ...m.keys()])];
  const differences: ComparisonRow[] = [];
  for (const key of keys) {
    const a = f.get(key);
    const b = m.get(key);
    const fixtureValue = a?.value ?? "Absent";
    const modelValue = b?.value ?? "Absent";
    if (norm(fixtureValue) !== norm(modelValue)) {
      differences.push({ key, label: a?.label ?? b?.label ?? key, fixture: fixtureValue, model: modelValue });
    }
  }
  return { total: keys.length, differences };
}
