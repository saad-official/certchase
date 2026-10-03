import { describe, expect, it } from "vitest";

/** Shallow copy without the given keys. */
function omit<T extends object>(value: T, ...keys: Array<keyof T>): Partial<T> {
  const copy: Partial<T> = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}
import {
  ChaseDraftOutputSchema,
  DEFAULT_TEMPLATE_RULES,
  EvaluationSchema,
  ExtractionSchema,
  GAP_CODES,
  GapSchema,
  POLICY_TYPES,
  TemplateRulesSchema,
  VendorInputSchema,
  type Extraction,
  type TemplateRules,
} from "@/lib/domain/types";
import {
  compliantExtraction,
  deficientExtraction,
  expiredExtraction,
  expiringExtraction,
  makeExtraction,
} from "./fixtures/extractions";

describe("TemplateRulesSchema", () => {
  it("accepts the default template", () => {
    expect(TemplateRulesSchema.parse(DEFAULT_TEMPLATE_RULES)).toEqual(DEFAULT_TEMPLATE_RULES);
  });

  it("has the spec's small-contractor defaults", () => {
    expect(DEFAULT_TEMPLATE_RULES).toEqual({
      generalLiability: { eachOccurrenceCents: 100_000_000, aggregateCents: 200_000_000 },
      autoLiability: { combinedSingleLimitCents: 100_000_000 },
      workersComp: { required: true, eachAccidentCents: 100_000_000 },
      umbrella: null,
      additionalInsured: true,
      waiverOfSubrogation: true,
      primaryNonContributory: false,
      noticeOfCancellationDays: 30,
      certificateHolderMustMatch: true,
    });
  });

  it("accepts every coverage block as null", () => {
    const rules: TemplateRules = {
      ...DEFAULT_TEMPLATE_RULES,
      generalLiability: null,
      autoLiability: null,
      workersComp: null,
      umbrella: null,
      noticeOfCancellationDays: 0,
    };
    expect(TemplateRulesSchema.safeParse(rules).success).toBe(true);
  });

  it("accepts an umbrella requirement", () => {
    const rules = { ...DEFAULT_TEMPLATE_RULES, umbrella: { eachOccurrenceCents: 500_000_000 } };
    expect(TemplateRulesSchema.parse(rules).umbrella).toEqual({ eachOccurrenceCents: 500_000_000 });
  });

  it.each([
    ["negative notice days", { noticeOfCancellationDays: -1 }],
    ["fractional notice days", { noticeOfCancellationDays: 7.5 }],
    ["fractional cents", { autoLiability: { combinedSingleLimitCents: 100.5 } }],
    ["negative cents", { umbrella: { eachOccurrenceCents: -1 } }],
    ["workers comp not required:true", { workersComp: { required: false, eachAccidentCents: 100 } }],
    ["missing aggregate", { generalLiability: { eachOccurrenceCents: 100 } }],
    ["non-boolean endorsement", { additionalInsured: "yes" }],
  ])("rejects %s", (_label, patch) => {
    expect(TemplateRulesSchema.safeParse({ ...DEFAULT_TEMPLATE_RULES, ...patch }).success).toBe(false);
  });

  it("rejects an omitted coverage block (must be explicitly null)", () => {
    expect(TemplateRulesSchema.safeParse(omit(DEFAULT_TEMPLATE_RULES, "umbrella")).success).toBe(false);
  });
});

describe("ExtractionSchema", () => {
  it.each([
    ["compliant", compliantExtraction],
    ["deficient", deficientExtraction],
    ["expiring", expiringExtraction],
    ["expired", expiredExtraction],
  ])("accepts the %s fixture unchanged", (_label, fixture) => {
    expect(ExtractionSchema.parse(fixture)).toEqual(fixture);
  });

  it("lists the five policy types", () => {
    expect(POLICY_TYPES).toEqual(["gl", "auto", "wc", "umbrella", "other"]);
  });

  it("accepts nulls where a structured-output model emits them", () => {
    const withNulls = {
      ...makeExtraction(),
      producerEmail: null,
      producerPhone: null,
      certificateHolderName: null,
      issueDate: null,
      noticeOfCancellationDays: null,
      descriptionOfOperations: null,
      policies: [
        {
          type: "gl",
          insurer: null,
          policyNumber: null,
          effectiveDate: null,
          expirationDate: null,
          limits: {
            eachOccurrenceCents: null,
            aggregateCents: null,
            combinedSingleLimitCents: null,
            eachAccidentCents: null,
          },
          additionalInsured: null,
          waiverOfSubrogation: null,
          primaryNonContributory: null,
        },
      ],
    };
    expect(ExtractionSchema.safeParse(withNulls).success).toBe(true);
  });

  it("accepts omitted optional fields and empty limits", () => {
    const base = makeExtraction();
    const parsed = ExtractionSchema.parse({
      ...omit(base, "producerEmail", "producerPhone"),
      policies: [{ ...base.policies[0], limits: {} }],
    });
    expect(parsed.producerEmail).toBeUndefined();
    expect(parsed.policies[0].limits).toEqual({});
  });

  it("defaults missing fieldConfidence and evidence to empty records", () => {
    const parsed = ExtractionSchema.parse(omit(makeExtraction(), "fieldConfidence", "evidence"));
    expect(parsed.fieldConfidence).toEqual({});
    expect(parsed.evidence).toEqual({});
  });

  const invalid: Array<[string, (e: Extraction) => unknown]> = [
    ["a US-format date", (e) => ({ ...e, issueDate: "10/15/2026" })],
    ["an impossible date", (e) => ({ ...e, issueDate: "2026-02-30" })],
    ["an unknown policy type", (e) => ({ ...e, policies: [{ ...e.policies[0], type: "cyber" }] })],
    [
      "fractional limit cents",
      (e) => ({ ...e, policies: [{ ...e.policies[0], limits: { eachOccurrenceCents: 1.5 } }] }),
    ],
    [
      "a limit given as a string",
      (e) => ({ ...e, policies: [{ ...e.policies[0], limits: { eachOccurrenceCents: "$1,000,000" } }] }),
    ],
    ["confidence above 1", (e) => ({ ...e, fieldConfidence: { insuredName: 1.2 } })],
    ["negative confidence", (e) => ({ ...e, fieldConfidence: { insuredName: -0.1 } })],
    ["a malformed producer email", (e) => ({ ...e, producerEmail: "certs at harbor" })],
    ["negative notice days", (e) => ({ ...e, noticeOfCancellationDays: -30 })],
    ["non-string evidence", (e) => ({ ...e, evidence: { insuredName: 42 } })],
    ["a missing policies array", (e) => ({ ...e, policies: undefined })],
  ];
  it.each(invalid)("rejects %s", (_label, mutate) => {
    expect(ExtractionSchema.safeParse(mutate(makeExtraction())).success).toBe(false);
  });
});

describe("GapSchema / EvaluationSchema", () => {
  it("has a closed list of gap codes", () => {
    expect(GAP_CODES).toEqual([
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
    ]);
    expect(GapSchema.safeParse({ code: "something_else", message: "x" }).success).toBe(false);
  });

  it("round-trips a stored evaluation", () => {
    const evaluation = {
      status: "deficient",
      gaps: [
        {
          code: "limit_below_required",
          message: "General liability each occurrence limit is $500,000; required $1,000,000.",
          required: "$1,000,000",
          actual: "$500,000",
          policyType: "gl",
        },
      ],
      earliestExpiration: "2027-01-01",
      needsReview: false,
      reviewFields: [],
    };
    expect(EvaluationSchema.parse(evaluation)).toEqual(evaluation);
  });

  it("rejects 'missing' as an evaluation status (that is a vendor status only)", () => {
    expect(
      EvaluationSchema.safeParse({
        status: "missing",
        gaps: [],
        earliestExpiration: null,
        needsReview: false,
        reviewFields: [],
      }).success,
    ).toBe(false);
  });
});

describe("ChaseDraftOutputSchema", () => {
  it("accepts a well-formed draft", () => {
    const draft = { subject: "Certificate update", body: "Hello", confidence: 0.9, rationale: "ok" };
    expect(ChaseDraftOutputSchema.parse(draft)).toEqual(draft);
  });

  it.each([
    [{ subject: "", body: "Hello", confidence: 0.9, rationale: "" }],
    [{ subject: "S", body: "", confidence: 0.9, rationale: "" }],
    [{ subject: "S", body: "B", confidence: 1.5, rationale: "" }],
    [{ subject: "S", body: "B", confidence: 0.5 }],
  ])("rejects %j", (draft) => {
    expect(ChaseDraftOutputSchema.safeParse(draft).success).toBe(false);
  });
});

describe("VendorInputSchema", () => {
  const valid = {
    name: "  Bluestone Masonry LLC ",
    contactEmail: "office@bluestonemasonry.example.com",
    contractValueCents: 4_850_000,
  };

  it("trims the name and defaults doNotContact", () => {
    expect(VendorInputSchema.parse(valid)).toEqual({
      name: "Bluestone Masonry LLC",
      contactEmail: "office@bluestonemasonry.example.com",
      contractValueCents: 4_850_000,
      doNotContact: false,
    });
  });

  it("accepts a broker contact", () => {
    const parsed = VendorInputSchema.parse({ ...valid, brokerName: "Pioneer", brokerEmail: "a@b.example.com" });
    expect(parsed.brokerEmail).toBe("a@b.example.com");
  });

  it.each([
    ["an empty name", { name: "   " }],
    ["a bad contact email", { contactEmail: "nope" }],
    ["a bad broker email", { brokerEmail: "nope" }],
    ["fractional cents", { contractValueCents: 10.5 }],
    ["negative cents", { contractValueCents: -1 }],
  ])("rejects %s", (_label, patch) => {
    expect(VendorInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
