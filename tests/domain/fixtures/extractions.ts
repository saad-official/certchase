/**
 * Realistic ACORD 25 extractions shared across domain tests.
 * All dates are relative to TODAY ("2026-10-03"). Limits are integer cents.
 */
import type { Extraction, Policy, PolicyType } from "@/lib/domain/types";

export const TODAY = "2026-10-03";

/** The org's legal name, which the certificate holder must match. */
export const ORG_LEGAL_NAME = "Northgate Builders LLC";

export const ONE_MILLION = 100_000_000;
export const TWO_MILLION = 200_000_000;
export const FIVE_MILLION = 500_000_000;
export const FIVE_HUNDRED_K = 50_000_000;

const HIGH_CONFIDENCE = {
  insuredName: 0.98,
  certificateHolderName: 0.97,
  noticeOfCancellationDays: 0.92,
  "policies.0.expirationDate": 0.99,
  "policies.0.limits.eachOccurrenceCents": 0.97,
  "policies.0.limits.aggregateCents": 0.96,
  "policies.0.additionalInsured": 0.9,
  "policies.0.waiverOfSubrogation": 0.88,
  "policies.1.expirationDate": 0.99,
  "policies.1.limits.combinedSingleLimitCents": 0.95,
  "policies.2.expirationDate": 0.99,
  "policies.2.limits.eachAccidentCents": 0.94,
} as const;

export function glPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    type: "gl",
    insurer: "Granite State Casualty Co",
    policyNumber: "GL-4471-0921",
    effectiveDate: "2026-03-01",
    expirationDate: "2027-03-01",
    limits: { eachOccurrenceCents: ONE_MILLION, aggregateCents: TWO_MILLION },
    additionalInsured: true,
    waiverOfSubrogation: true,
    primaryNonContributory: true,
    ...overrides,
  };
}

export function autoPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    type: "auto",
    insurer: "Keystone Mutual Insurance",
    policyNumber: "BA-88213-04",
    effectiveDate: "2026-06-15",
    expirationDate: "2027-06-15",
    limits: { combinedSingleLimitCents: ONE_MILLION },
    additionalInsured: true,
    waiverOfSubrogation: true,
    primaryNonContributory: null,
    ...overrides,
  };
}

export function wcPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    type: "wc",
    insurer: "Patriot Workers Comp Fund",
    policyNumber: "WC-2026-55102",
    effectiveDate: "2026-01-01",
    expirationDate: "2027-01-01",
    limits: { eachAccidentCents: ONE_MILLION },
    additionalInsured: null,
    waiverOfSubrogation: true,
    primaryNonContributory: null,
    ...overrides,
  };
}

export function umbrellaPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    type: "umbrella",
    insurer: "Granite State Casualty Co",
    policyNumber: "UMB-7720-11",
    effectiveDate: "2026-03-01",
    expirationDate: "2027-03-01",
    limits: { eachOccurrenceCents: FIVE_MILLION, aggregateCents: FIVE_MILLION },
    additionalInsured: null,
    waiverOfSubrogation: null,
    primaryNonContributory: null,
    ...overrides,
  };
}

/** Builds an extraction around the compliant baseline; `policies` replaces the whole list. */
export function makeExtraction(overrides: Partial<Extraction> = {}): Extraction {
  return {
    insuredName: "Ridgeline Electric Inc",
    producerName: "Harbor Insurance Agency",
    producerEmail: "certs@harborins.example.com",
    producerPhone: "(603) 555-0142",
    certificateHolderName: "Northgate Builders, LLC",
    issueDate: "2026-09-28",
    policies: [glPolicy(), autoPolicy(), wcPolicy(), umbrellaPolicy()],
    noticeOfCancellationDays: 30,
    descriptionOfOperations:
      "Electrical work at 400 Harbor St. Certificate holder is additional insured on GL on a primary and non-contributory basis; waiver of subrogation applies to GL, Auto and WC.",
    fieldConfidence: { ...HIGH_CONFIDENCE },
    evidence: {
      certificateHolderName: "NORTHGATE BUILDERS, LLC 12 MILL RD CONCORD NH",
      "policies.0.limits.eachOccurrenceCents": "EACH OCCURRENCE $ 1,000,000",
      noticeOfCancellationDays: "30 DAYS NOTICE OF CANCELLATION",
    },
    ...overrides,
  };
}

/** Meets DEFAULT_TEMPLATE_RULES; earliest required expiration is WC on 2027-01-01. */
export const compliantExtraction: Extraction = makeExtraction();

/** GL each occurrence is $500,000 (requires $1,000,000) and the GL waiver box is unticked. */
export const deficientExtraction: Extraction = makeExtraction({
  insuredName: "Bluestone Masonry LLC",
  producerName: "Pioneer Risk Partners",
  producerEmail: "service@pioneerrisk.example.com",
  policies: [
    glPolicy({
      policyNumber: "CGL-1190-33",
      limits: { eachOccurrenceCents: FIVE_HUNDRED_K, aggregateCents: TWO_MILLION },
      waiverOfSubrogation: false,
    }),
    autoPolicy({ policyNumber: "CA-5521-09" }),
    wcPolicy({ policyNumber: "WC-77810-2" }),
  ],
  descriptionOfOperations: "Masonry and concrete flatwork. Certificate holder is additional insured on GL.",
});

/** Fully compliant except the GL policy expires 2026-10-15, 12 days after TODAY. */
export const expiringExtraction: Extraction = makeExtraction({
  insuredName: "Copperline Plumbing Co",
  producerName: "Summit Commercial Insurance",
  producerEmail: null,
  policies: [
    glPolicy({ policyNumber: "GL-3008-17", effectiveDate: "2025-10-15", expirationDate: "2026-10-15" }),
    autoPolicy({ policyNumber: "AU-3008-18" }),
    wcPolicy({ policyNumber: "WC-3008-19" }),
  ],
});

/** GL policy expired 2026-09-30, three days before TODAY. */
export const expiredExtraction: Extraction = makeExtraction({
  insuredName: "Fieldstone Landscaping",
  policies: [
    glPolicy({ effectiveDate: "2025-09-30", expirationDate: "2026-09-30" }),
    autoPolicy(),
    wcPolicy(),
  ],
});

export function policyOf(extraction: Extraction, type: PolicyType): Policy {
  const found = extraction.policies.find((p) => p.type === type);
  if (!found) throw new Error(`fixture has no ${type} policy`);
  return found;
}
