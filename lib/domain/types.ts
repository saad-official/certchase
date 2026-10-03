import { z } from "zod";

/**
 * Calendar date with no time or zone, "YYYY-MM-DD" (Postgres `date`).
 * Timestamps (`timestamptz`) are modelled as `Date`. Money is integer cents.
 */
export type IsoDate = string;

const Cents = z.int({ error: "amount must be integer cents" }).nonnegative({ error: "amount must be >= 0" });
const Confidence = z
  .number()
  .min(0, { error: "confidence must be >= 0" })
  .max(1, { error: "confidence must be <= 1" });
const IsoDateString = z.iso.date({ error: "date must be YYYY-MM-DD" });

/* ------------------------------------------------------------------ */
/* Requirement templates (spec 3.1)                                    */
/* ------------------------------------------------------------------ */

export const TemplateRulesSchema = z.object({
  generalLiability: z.object({ eachOccurrenceCents: Cents, aggregateCents: Cents }).nullable(),
  autoLiability: z.object({ combinedSingleLimitCents: Cents }).nullable(),
  /** Statutory WC cannot be checked numerically; `required: true` plus employer's liability each accident. */
  workersComp: z.object({ required: z.literal(true), eachAccidentCents: Cents }).nullable(),
  umbrella: z.object({ eachOccurrenceCents: Cents }).nullable(),
  /** Certificate holder named as additional insured (checked on the GL policy). */
  additionalInsured: z.boolean(),
  waiverOfSubrogation: z.boolean(),
  primaryNonContributory: z.boolean(),
  /** 0 = not required. */
  noticeOfCancellationDays: z.int({ error: "notice days must be a whole number" }).nonnegative(),
  /** Holder on the certificate must match the org's legal name. */
  certificateHolderMustMatch: z.boolean(),
});
export type TemplateRules = z.infer<typeof TemplateRulesSchema>;

export const DEFAULT_TEMPLATE_RULES: TemplateRules = {
  generalLiability: { eachOccurrenceCents: 100_000_000, aggregateCents: 200_000_000 },
  autoLiability: { combinedSingleLimitCents: 100_000_000 },
  workersComp: { required: true, eachAccidentCents: 100_000_000 },
  umbrella: null,
  additionalInsured: true,
  waiverOfSubrogation: true,
  primaryNonContributory: false,
  noticeOfCancellationDays: 30,
  certificateHolderMustMatch: true,
};

/* ------------------------------------------------------------------ */
/* Extraction (spec 3.3)                                               */
/* ------------------------------------------------------------------ */

export const POLICY_TYPES = ["gl", "auto", "wc", "umbrella", "other"] as const;
export const PolicyTypeSchema = z.enum(POLICY_TYPES);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

/**
 * Optional fields are `nullish` because structured-output models commonly emit
 * `null` for values the document does not show.
 */
export const PolicyLimitsSchema = z.object({
  eachOccurrenceCents: Cents.nullish(),
  aggregateCents: Cents.nullish(),
  combinedSingleLimitCents: Cents.nullish(),
  eachAccidentCents: Cents.nullish(),
});
export type PolicyLimits = z.infer<typeof PolicyLimitsSchema>;
export type LimitField = keyof PolicyLimits;

export const PolicySchema = z.object({
  type: PolicyTypeSchema,
  insurer: z.string().nullish(),
  policyNumber: z.string().nullish(),
  effectiveDate: IsoDateString.nullable(),
  expirationDate: IsoDateString.nullable(),
  limits: PolicyLimitsSchema,
  /** null = the form does not say (blank box), which is not the same as "N". */
  additionalInsured: z.boolean().nullable(),
  waiverOfSubrogation: z.boolean().nullable(),
  primaryNonContributory: z.boolean().nullable(),
});
export type Policy = z.infer<typeof PolicySchema>;

/**
 * `fieldConfidence` and `evidence` are keyed by field path: top-level names
 * ("certificateHolderName", "noticeOfCancellationDays") or dotted policy paths
 * ("policies.0.expirationDate", "policies.0.limits.eachOccurrenceCents").
 * A key that is a prefix of a path (e.g. "policies.0") covers every field under it.
 */
export const ExtractionSchema = z.object({
  insuredName: z.string(),
  producerName: z.string(),
  producerEmail: z.email({ error: "producerEmail must be an email address" }).nullish(),
  producerPhone: z.string().nullish(),
  certificateHolderName: z.string().nullable(),
  issueDate: IsoDateString.nullable(),
  policies: z.array(PolicySchema),
  noticeOfCancellationDays: z.int().nonnegative().nullable(),
  descriptionOfOperations: z.string().nullish(),
  fieldConfidence: z.record(z.string(), Confidence).default({}),
  evidence: z.record(z.string(), z.string()).default({}),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/* ------------------------------------------------------------------ */
/* Evaluation (spec 3.4)                                               */
/* ------------------------------------------------------------------ */

export const EVALUATION_STATUSES = ["compliant", "deficient", "expiring", "expired"] as const;
export const EvaluationStatusSchema = z.enum(EVALUATION_STATUSES);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;

export const VENDOR_STATUSES = ["missing", ...EVALUATION_STATUSES] as const;
export const VendorStatusSchema = z.enum(VENDOR_STATUSES);
export type VendorStatus = z.infer<typeof VendorStatusSchema>;

export const GAP_CODES = [
  "missing_coverage",
  "limit_below_required",
  "policy_expired",
  "policy_expiring",
  "missing_additional_insured",
  "missing_waiver",
  "missing_primary_noncontributory",
  "notice_days_below_required",
  "holder_mismatch",
  "unreadable_field",
] as const;
export const GapCodeSchema = z.enum(GAP_CODES);
export type GapCode = z.infer<typeof GapCodeSchema>;

export const GapSchema = z.object({
  code: GapCodeSchema,
  /** Human sentence; chase emails must quote it (or `required`) verbatim. */
  message: z.string(),
  /** Required value as rendered for humans, e.g. "$1,000,000" or "30 days". */
  required: z.string().optional(),
  actual: z.string().optional(),
  policyType: PolicyTypeSchema.optional(),
});
export type Gap = z.infer<typeof GapSchema>;

export const EvaluationSchema = z.object({
  status: EvaluationStatusSchema,
  gaps: z.array(GapSchema),
  earliestExpiration: IsoDateString.nullable(),
  needsReview: z.boolean(),
  reviewFields: z.array(z.string()),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

/* ------------------------------------------------------------------ */
/* Chasing (spec 3.5)                                                  */
/* ------------------------------------------------------------------ */

export const CHASE_KINDS = ["request_initial", "deficiency", "renewal"] as const;
export const ChaseKindSchema = z.enum(CHASE_KINDS);
export type ChaseKind = z.infer<typeof ChaseKindSchema>;

export const ChaseDraftOutputSchema = z.object({
  subject: z.string().min(1, { error: "subject is required" }),
  body: z.string().min(1, { error: "body is required" }),
  confidence: Confidence,
  rationale: z.string(),
});
export type ChaseDraftOutput = z.infer<typeof ChaseDraftOutputSchema>;

/* ------------------------------------------------------------------ */
/* Organisations and vendors (spec 2, 3.2, 4)                          */
/* ------------------------------------------------------------------ */

export type Plan = "free" | "pro";
export type Autonomy = "manual" | "auto_renewals";

export interface OrgVoice {
  businessName: string;
  signature: string;
  toneNotes: string;
}

export interface Organization {
  id: string;
  name: string;
  /** Matched against the certificate holder name. */
  legalName: string;
  /** IANA zone, e.g. "America/New_York". */
  timezone: string;
  plan: Plan;
  autonomy: Autonomy;
  voice: OrgVoice;
}

export interface Vendor {
  id: string;
  orgId: string;
  name: string;
  contactEmail: string;
  brokerName?: string | null;
  brokerEmail?: string | null;
  trade?: string | null;
  contractValueCents: number;
  templateId: string;
  doNotContact: boolean;
}

/** Owner-entered vendor fields (create/edit form, CSV import). */
export const VendorInputSchema = z.object({
  name: z.string().trim().min(1, { error: "name is required" }),
  contactEmail: z.email({ error: "contactEmail must be an email address" }),
  brokerName: z.string().trim().nullish(),
  brokerEmail: z.email({ error: "brokerEmail must be an email address" }).nullish(),
  trade: z.string().trim().nullish(),
  contractValueCents: Cents,
  doNotContact: z.boolean().default(false),
});
export type VendorInput = z.infer<typeof VendorInputSchema>;
