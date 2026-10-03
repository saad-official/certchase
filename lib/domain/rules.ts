/**
 * Deterministic rule engine (spec 3.4). The model extracts, the rules decide:
 * no verdict here depends on anything but the extraction, the template and `today`.
 *
 * Date semantics: a policy is in force through its expiration date, so it is
 * `expired` only when expirationDate < today, and `expiring` when
 * today <= expirationDate <= today + expiringWithinDays (inclusive).
 */
import { daysBetweenIsoDates } from "./dates";
import { formatLimit, namesMatch } from "./normalize";
import type {
  Evaluation,
  EvaluationStatus,
  Extraction,
  Gap,
  IsoDate,
  LimitField,
  Policy,
  PolicyType,
  TemplateRules,
} from "./types";

export const DEFAULT_EXPIRING_WITHIN_DAYS = 30;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
const NOT_SHOWN = "not shown";

export interface EvaluateOptions {
  /** Days ahead (inclusive) that count as expiring. Default 30. */
  expiringWithinDays?: number;
  /** The org's legal name; the holder check runs only when this is given and the template requires it. */
  holderName?: string;
  /** Checked fields whose fieldConfidence is strictly below this go to review. Default 0.7. */
  confidenceThreshold?: number;
}

const COVERAGE_LABEL: Record<PolicyType, string> = {
  gl: "General liability",
  auto: "Automobile liability",
  wc: "Workers' compensation",
  umbrella: "Umbrella liability",
  other: "Other",
};

const LIMIT_LABEL: Record<LimitField, string> = {
  eachOccurrenceCents: "each occurrence",
  aggregateCents: "general aggregate",
  combinedSingleLimitCents: "combined single limit",
  eachAccidentCents: "employer's liability each accident",
};

interface RequiredCoverage {
  type: Exclude<PolicyType, "other">;
  limits: Array<{ field: LimitField; cents: number }>;
  /** Shown in the missing-coverage gap, e.g. "$1,000,000 combined single limit". */
  summaryPrefix?: string;
}

/** Required coverages in gap order: gl, auto, wc, umbrella. */
function requiredCoverages(rules: TemplateRules): RequiredCoverage[] {
  const out: RequiredCoverage[] = [];
  if (rules.generalLiability) {
    out.push({
      type: "gl",
      limits: [
        { field: "eachOccurrenceCents", cents: rules.generalLiability.eachOccurrenceCents },
        { field: "aggregateCents", cents: rules.generalLiability.aggregateCents },
      ],
    });
  }
  if (rules.autoLiability) {
    out.push({
      type: "auto",
      limits: [{ field: "combinedSingleLimitCents", cents: rules.autoLiability.combinedSingleLimitCents }],
    });
  }
  if (rules.workersComp) {
    out.push({
      type: "wc",
      limits: [{ field: "eachAccidentCents", cents: rules.workersComp.eachAccidentCents }],
      summaryPrefix: "Statutory",
    });
  }
  if (rules.umbrella) {
    out.push({ type: "umbrella", limits: [{ field: "eachOccurrenceCents", cents: rules.umbrella.eachOccurrenceCents }] });
  }
  return out;
}

interface Located {
  policy: Policy;
  index: number;
}

/** The policy of `type` with the latest expiration; undated policies rank last; ties keep the first listed. */
function selectPolicy(policies: readonly Policy[], type: PolicyType): Located | null {
  let best: Located | null = null;
  policies.forEach((policy, index) => {
    if (policy.type !== type) return;
    if (!best) {
      best = { policy, index };
      return;
    }
    const current = best.policy.expirationDate;
    const candidate = policy.expirationDate;
    if (candidate !== null && (current === null || candidate > current)) best = { policy, index };
  });
  return best;
}

/** Lowest confidence among keys equal to `path` or a dotted prefix of it; undefined when none given. */
function confidenceFor(fieldConfidence: Record<string, number>, path: string): number | undefined {
  let lowest: number | undefined;
  for (const [key, value] of Object.entries(fieldConfidence)) {
    if (key === path || path.startsWith(`${key}.`)) {
      lowest = lowest === undefined ? value : Math.min(lowest, value);
    }
  }
  return lowest;
}

const ENDORSEMENTS = [
  {
    rule: "additionalInsured",
    field: "additionalInsured",
    code: "missing_additional_insured",
    message: "General liability policy does not show the certificate holder as additional insured.",
  },
  {
    rule: "waiverOfSubrogation",
    field: "waiverOfSubrogation",
    code: "missing_waiver",
    message: "General liability policy does not show a waiver of subrogation.",
  },
  {
    rule: "primaryNonContributory",
    field: "primaryNonContributory",
    code: "missing_primary_noncontributory",
    message: "General liability policy does not show primary and non-contributory coverage.",
  },
] as const satisfies ReadonlyArray<{
  rule: keyof TemplateRules;
  field: keyof Policy;
  code: Gap["code"];
  message: string;
}>;

function statusFrom(gaps: readonly Gap[]): EvaluationStatus {
  if (gaps.some((g) => g.code === "policy_expired")) return "expired";
  if (gaps.some((g) => g.code !== "policy_expiring")) return "deficient";
  if (gaps.length > 0) return "expiring";
  return "compliant";
}

/**
 * Judges an extracted certificate against a requirement template.
 *
 * Gaps are ordered: coverage (gl, auto, wc, umbrella; within each: limits then
 * expiration), then GL endorsements, then notice of cancellation, then holder.
 * `reviewFields` lists checked field paths that are blank where a value matters
 * or whose confidence is under the threshold; `needsReview` is true when any exist.
 * Review never changes the status.
 */
export function evaluateCertificate(
  extraction: Extraction,
  rules: TemplateRules,
  today: IsoDate,
  options: EvaluateOptions = {},
): Evaluation {
  const windowDays = options.expiringWithinDays ?? DEFAULT_EXPIRING_WITHIN_DAYS;
  const threshold = options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const fieldConfidence = extraction.fieldConfidence ?? {};

  const gaps: Gap[] = [];
  const review = new Set<string>();
  const expirations: IsoDate[] = [];

  /** Records that a check used `path`; flags it for review when low confidence (or forced). */
  const checked = (path: string, forceReview = false): void => {
    const confidence = confidenceFor(fieldConfidence, path);
    if (forceReview || (confidence !== undefined && confidence < threshold)) review.add(path);
  };

  for (const coverage of requiredCoverages(rules)) {
    const label = COVERAGE_LABEL[coverage.type];
    const located = selectPolicy(extraction.policies, coverage.type);
    if (!located) {
      const limits = coverage.limits.map((l) => `${formatLimit(l.cents)} ${LIMIT_LABEL[l.field]}`).join(" / ");
      gaps.push({
        code: "missing_coverage",
        message: `No ${label.charAt(0).toLowerCase()}${label.slice(1)} policy is shown on the certificate.`,
        required: coverage.summaryPrefix ? `${coverage.summaryPrefix} / ${limits}` : limits,
        policyType: coverage.type,
      });
      continue;
    }

    const { policy, index } = located;
    const base = `policies.${index}`;
    checked(`${base}.type`);

    for (const limit of coverage.limits) {
      const path = `${base}.limits.${limit.field}`;
      const actual = policy.limits[limit.field];
      const required = formatLimit(limit.cents);
      const limitLabel = `${label} ${LIMIT_LABEL[limit.field]} limit`;
      if (actual === null || actual === undefined) {
        checked(path, true);
        gaps.push({
          code: "unreadable_field",
          message: `${limitLabel} is not shown; required ${required}.`,
          required,
          actual: NOT_SHOWN,
          policyType: coverage.type,
        });
        continue;
      }
      checked(path);
      if (actual < limit.cents) {
        gaps.push({
          code: "limit_below_required",
          message: `${limitLabel} is ${formatLimit(actual)}; required ${required}.`,
          required,
          actual: formatLimit(actual),
          policyType: coverage.type,
        });
      }
    }

    const expirationPath = `${base}.expirationDate`;
    const expiration = policy.expirationDate;
    if (expiration === null) {
      checked(expirationPath, true);
      gaps.push({
        code: "unreadable_field",
        message: `${label} expiration date is not shown.`,
        actual: NOT_SHOWN,
        policyType: coverage.type,
      });
      continue;
    }
    checked(expirationPath);
    expirations.push(expiration);
    if (expiration < today) {
      gaps.push({
        code: "policy_expired",
        message: `${label} policy expired on ${expiration}.`,
        actual: expiration,
        policyType: coverage.type,
      });
    } else if (daysBetweenIsoDates(today, expiration) <= windowDays) {
      gaps.push({
        code: "policy_expiring",
        message: `${label} policy expires on ${expiration}.`,
        actual: expiration,
        policyType: coverage.type,
      });
    }
  }

  const gl = selectPolicy(extraction.policies, "gl");
  for (const endorsement of ENDORSEMENTS) {
    if (!rules[endorsement.rule]) continue;
    if (!gl) {
      gaps.push({ code: endorsement.code, message: endorsement.message, actual: NOT_SHOWN, policyType: "gl" });
      continue;
    }
    const value = gl.policy[endorsement.field];
    checked(`policies.${gl.index}.${endorsement.field}`, value === null);
    if (value !== true) {
      gaps.push({
        code: endorsement.code,
        message: endorsement.message,
        actual: value === null ? NOT_SHOWN : "No",
        policyType: "gl",
      });
    }
  }

  const requiredNotice = rules.noticeOfCancellationDays;
  if (requiredNotice > 0) {
    const notice = extraction.noticeOfCancellationDays;
    const required = `${requiredNotice} days`;
    checked("noticeOfCancellationDays", notice === null);
    if (notice === null) {
      gaps.push({
        code: "notice_days_below_required",
        message: `Notice of cancellation period is not shown; required ${required}.`,
        required,
        actual: NOT_SHOWN,
      });
    } else if (notice < requiredNotice) {
      gaps.push({
        code: "notice_days_below_required",
        message: `Notice of cancellation is ${notice} days; required ${required}.`,
        required,
        actual: `${notice} days`,
      });
    }
  }

  const holderName = options.holderName?.trim();
  if (rules.certificateHolderMustMatch && holderName) {
    const holder = extraction.certificateHolderName;
    const blank = holder === null || holder.trim().length === 0;
    checked("certificateHolderName", blank);
    if (blank) {
      gaps.push({
        code: "unreadable_field",
        message: `Certificate holder name is not shown; required "${holderName}".`,
        required: holderName,
        actual: NOT_SHOWN,
      });
    } else if (!namesMatch(holder, holderName)) {
      gaps.push({
        code: "holder_mismatch",
        message: `Certificate holder is "${holder}"; required "${holderName}".`,
        required: holderName,
        actual: holder,
      });
    }
  }

  const reviewFields = [...review];
  return {
    status: statusFrom(gaps),
    gaps,
    earliestExpiration: expirations.length === 0 ? null : expirations.reduce((a, b) => (b < a ? b : a)),
    needsReview: reviewFields.length > 0,
    reviewFields,
  };
}
