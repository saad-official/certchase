import { describe, expect, it } from "vitest";
import { evaluateCertificate, type EvaluateOptions } from "@/lib/domain/rules";
import { DEFAULT_TEMPLATE_RULES, type Extraction, type Policy, type TemplateRules } from "@/lib/domain/types";
import {
  autoPolicy,
  compliantExtraction,
  deficientExtraction,
  expiredExtraction,
  expiringExtraction,
  FIVE_HUNDRED_K,
  FIVE_MILLION,
  glPolicy,
  makeExtraction,
  ONE_MILLION,
  ORG_LEGAL_NAME,
  TODAY,
  TWO_MILLION,
  umbrellaPolicy,
  wcPolicy,
} from "./fixtures/extractions";

const rules = DEFAULT_TEMPLATE_RULES;
const withHolder: EvaluateOptions = { holderName: ORG_LEGAL_NAME };

function evaluate(extraction: Extraction, r: TemplateRules = rules, options: EvaluateOptions = withHolder) {
  return evaluateCertificate(extraction, r, TODAY, options);
}

function withPolicies(...policies: Policy[]): Extraction {
  return makeExtraction({ policies });
}

const codes = (e: Extraction, r: TemplateRules = rules, options: EvaluateOptions = withHolder) =>
  evaluate(e, r, options).gaps.map((g) => g.code);

describe("evaluateCertificate: fixtures", () => {
  it("passes the compliant certificate", () => {
    expect(evaluate(compliantExtraction)).toEqual({
      status: "compliant",
      gaps: [],
      earliestExpiration: "2027-01-01",
      needsReview: false,
      reviewFields: [],
    });
  });

  it("flags the low GL limit and the missing waiver, quoting the compared values", () => {
    expect(evaluate(deficientExtraction)).toEqual({
      status: "deficient",
      gaps: [
        {
          code: "limit_below_required",
          message: "General liability each occurrence limit is $500,000; required $1,000,000.",
          required: "$1,000,000",
          actual: "$500,000",
          policyType: "gl",
        },
        {
          code: "missing_waiver",
          message: "General liability policy does not show a waiver of subrogation.",
          actual: "No",
          policyType: "gl",
        },
      ],
      earliestExpiration: "2027-01-01",
      needsReview: false,
      reviewFields: [],
    });
  });

  it("marks a GL policy expiring in 12 days as expiring", () => {
    expect(evaluate(expiringExtraction)).toEqual({
      status: "expiring",
      gaps: [
        {
          code: "policy_expiring",
          message: "General liability policy expires on 2026-10-15.",
          actual: "2026-10-15",
          policyType: "gl",
        },
      ],
      earliestExpiration: "2026-10-15",
      needsReview: false,
      reviewFields: [],
    });
  });

  it("marks a GL policy that ended three days ago as expired", () => {
    const result = evaluate(expiredExtraction);
    expect(result.status).toBe("expired");
    expect(result.gaps).toEqual([
      {
        code: "policy_expired",
        message: "General liability policy expired on 2026-09-30.",
        actual: "2026-09-30",
        policyType: "gl",
      },
    ]);
    expect(result.earliestExpiration).toBe("2026-09-30");
  });

  it("does not mutate the extraction or the rules", () => {
    const extraction = structuredClone(deficientExtraction);
    const template = structuredClone(rules);
    evaluate(extraction, template);
    expect(extraction).toEqual(deficientExtraction);
    expect(template).toEqual(rules);
  });
});

describe("evaluateCertificate: required coverage", () => {
  it.each([
    ["gl", "No general liability policy is shown on the certificate.", "$1,000,000 each occurrence / $2,000,000 general aggregate"],
    ["auto", "No automobile liability policy is shown on the certificate.", "$1,000,000 combined single limit"],
    ["wc", "No workers' compensation policy is shown on the certificate.", "Statutory / $1,000,000 employer's liability each accident"],
  ] as const)("reports a missing %s policy with what is required", (type, message, required) => {
    const extraction = makeExtraction({
      policies: makeExtraction().policies.filter((p) => p.type !== type),
    });
    const result = evaluate(extraction);
    expect(result.status).toBe("deficient");
    expect(result.gaps).toContainEqual({ code: "missing_coverage", message, required, policyType: type });
  });

  it("ignores coverage the template does not require", () => {
    const template: TemplateRules = { ...rules, autoLiability: null, workersComp: null };
    const extraction = withPolicies(glPolicy());
    expect(evaluate(extraction, template).status).toBe("compliant");
  });

  it("requires an umbrella only when the template has one", () => {
    const template: TemplateRules = { ...rules, umbrella: { eachOccurrenceCents: FIVE_MILLION } };
    const noUmbrella = withPolicies(glPolicy(), autoPolicy(), wcPolicy());
    expect(evaluate(noUmbrella).status).toBe("compliant");
    expect(evaluate(noUmbrella, template).gaps).toEqual([
      {
        code: "missing_coverage",
        message: "No umbrella liability policy is shown on the certificate.",
        required: "$5,000,000 each occurrence",
        policyType: "umbrella",
      },
    ]);
    const smallUmbrella = withPolicies(
      glPolicy(),
      autoPolicy(),
      wcPolicy(),
      umbrellaPolicy({ limits: { eachOccurrenceCents: 200_000_000 } }),
    );
    expect(evaluate(smallUmbrella, template).gaps).toEqual([
      {
        code: "limit_below_required",
        message: "Umbrella liability each occurrence limit is $2,000,000; required $5,000,000.",
        required: "$5,000,000",
        actual: "$2,000,000",
        policyType: "umbrella",
      },
    ]);
  });

  it("never lets an 'other' policy satisfy a required coverage", () => {
    const extraction = withPolicies(glPolicy({ type: "other" }), autoPolicy(), wcPolicy());
    expect(codes(extraction)).toEqual([
      "missing_coverage",
      "missing_additional_insured",
      "missing_waiver",
    ]);
  });
});

describe("evaluateCertificate: limits", () => {
  it("accepts limits exactly equal to the requirement", () => {
    expect(evaluate(compliantExtraction).gaps).toEqual([]);
  });

  it("rejects a limit one cent below the requirement", () => {
    const extraction = withPolicies(
      glPolicy({ limits: { eachOccurrenceCents: ONE_MILLION - 1, aggregateCents: TWO_MILLION } }),
      autoPolicy(),
      wcPolicy(),
    );
    expect(evaluate(extraction).gaps).toEqual([
      {
        code: "limit_below_required",
        message: "General liability each occurrence limit is $999,999.99; required $1,000,000.",
        required: "$1,000,000",
        actual: "$999,999.99",
        policyType: "gl",
      },
    ]);
  });

  it("checks the GL aggregate, auto CSL and WC each-accident limits", () => {
    const extraction = withPolicies(
      glPolicy({ limits: { eachOccurrenceCents: ONE_MILLION, aggregateCents: ONE_MILLION } }),
      autoPolicy({ limits: { combinedSingleLimitCents: FIVE_HUNDRED_K } }),
      wcPolicy({ limits: { eachAccidentCents: FIVE_HUNDRED_K } }),
    );
    expect(evaluate(extraction).gaps.map((g) => g.message)).toEqual([
      "General liability general aggregate limit is $1,000,000; required $2,000,000.",
      "Automobile liability combined single limit limit is $500,000; required $1,000,000.",
      "Workers' compensation employer's liability each accident limit is $500,000; required $1,000,000.",
    ]);
  });

  it("accepts limits above the requirement", () => {
    const extraction = withPolicies(
      glPolicy({ limits: { eachOccurrenceCents: TWO_MILLION, aggregateCents: FIVE_MILLION } }),
      autoPolicy({ limits: { combinedSingleLimitCents: TWO_MILLION } }),
      wcPolicy(),
    );
    expect(evaluate(extraction).status).toBe("compliant");
  });

  it.each([null, undefined])("reports a %s required limit as unreadable and sends it for review", (value) => {
    const extraction = withPolicies(
      glPolicy({ limits: { eachOccurrenceCents: value, aggregateCents: TWO_MILLION } }),
      autoPolicy(),
      wcPolicy(),
    );
    const result = evaluate(extraction);
    expect(result.status).toBe("deficient");
    expect(result.gaps).toEqual([
      {
        code: "unreadable_field",
        message: "General liability each occurrence limit is not shown; required $1,000,000.",
        required: "$1,000,000",
        actual: "not shown",
        policyType: "gl",
      },
    ]);
    expect(result.needsReview).toBe(true);
    expect(result.reviewFields).toEqual(["policies.0.limits.eachOccurrenceCents"]);
  });
});

describe("evaluateCertificate: several policies of one type", () => {
  it("uses the GL policy with the latest expiration (a renewal next to the expired term)", () => {
    const extraction = withPolicies(
      glPolicy({ policyNumber: "OLD", effectiveDate: "2025-09-30", expirationDate: "2026-09-30" }),
      autoPolicy(),
      wcPolicy(),
      glPolicy({ policyNumber: "NEW", effectiveDate: "2026-09-30", expirationDate: "2027-09-30" }),
    );
    const result = evaluate(extraction);
    expect(result.status).toBe("compliant");
    expect(result.earliestExpiration).toBe("2027-01-01");
  });

  it("judges limits and endorsements on the chosen policy only, and reports its field paths", () => {
    const extraction = withPolicies(
      glPolicy({ expirationDate: "2026-12-31" }),
      autoPolicy(),
      wcPolicy(),
      glPolicy({
        expirationDate: "2027-06-30",
        limits: { eachOccurrenceCents: FIVE_HUNDRED_K, aggregateCents: TWO_MILLION },
        additionalInsured: null,
      }),
    );
    const result = evaluate(extraction);
    expect(result.gaps.map((g) => g.code)).toEqual(["limit_below_required", "missing_additional_insured"]);
    expect(result.reviewFields).toEqual(["policies.3.additionalInsured"]);
  });

  it("prefers a dated policy over one with no expiration, and the first on a tie", () => {
    const undated = withPolicies(
      glPolicy({ expirationDate: null }),
      glPolicy({ expirationDate: "2027-03-01", policyNumber: "DATED" }),
      autoPolicy(),
      wcPolicy(),
    );
    expect(evaluate(undated).status).toBe("compliant");

    const tie = withPolicies(
      glPolicy({ waiverOfSubrogation: false }),
      glPolicy({ waiverOfSubrogation: true }),
      autoPolicy(),
      wcPolicy(),
    );
    expect(codes(tie)).toEqual(["missing_waiver"]);
  });
});

describe("evaluateCertificate: expiration boundaries", () => {
  const glExpiring = (expirationDate: string | null) =>
    withPolicies(glPolicy({ expirationDate }), autoPolicy(), wcPolicy());

  it("treats a policy expiring today as still in force (expiring, not expired)", () => {
    const result = evaluate(glExpiring(TODAY));
    expect(result.status).toBe("expiring");
    expect(result.gaps[0]).toMatchObject({ code: "policy_expiring", actual: TODAY });
  });

  it("treats a policy that expired yesterday as expired", () => {
    const result = evaluate(glExpiring("2026-10-02"));
    expect(result.status).toBe("expired");
    expect(result.gaps[0]).toMatchObject({ code: "policy_expired", actual: "2026-10-02" });
  });

  it("includes day 30 in the expiring window and excludes day 31", () => {
    expect(evaluate(glExpiring("2026-11-02")).status).toBe("expiring");
    expect(evaluate(glExpiring("2026-11-03")).status).toBe("compliant");
  });

  it("honours a custom expiring window", () => {
    const options = { ...withHolder, expiringWithinDays: 60 };
    expect(evaluate(glExpiring("2026-12-02"), rules, options).status).toBe("expiring");
    expect(evaluate(glExpiring("2026-12-03"), rules, options).status).toBe("compliant");
    expect(evaluate(glExpiring("2026-10-04"), rules, { ...withHolder, expiringWithinDays: 0 }).status).toBe(
      "compliant",
    );
  });

  it("reports a missing expiration date as unreadable, for review", () => {
    const result = evaluate(glExpiring(null));
    expect(result.status).toBe("deficient");
    expect(result.gaps).toEqual([
      {
        code: "unreadable_field",
        message: "General liability expiration date is not shown.",
        actual: "not shown",
        policyType: "gl",
      },
    ]);
    expect(result.reviewFields).toEqual(["policies.0.expirationDate"]);
    expect(result.earliestExpiration).toBe("2027-01-01");
  });

  it("ignores expired policies of a type the template does not require", () => {
    const extraction = withPolicies(
      glPolicy(),
      autoPolicy(),
      wcPolicy(),
      umbrellaPolicy({ expirationDate: "2026-01-01" }),
      glPolicy({ type: "other", expirationDate: "2026-01-01" }),
    );
    const result = evaluate(extraction);
    expect(result.status).toBe("compliant");
    expect(result.earliestExpiration).toBe("2027-01-01");
  });
});

describe("evaluateCertificate: status precedence and earliestExpiration", () => {
  it("expired wins over deficient", () => {
    const extraction = withPolicies(
      glPolicy({ expirationDate: "2026-09-01", waiverOfSubrogation: false }),
      autoPolicy(),
      wcPolicy(),
    );
    expect(evaluate(extraction).status).toBe("expired");
  });

  it("deficient wins over expiring", () => {
    const extraction = withPolicies(
      glPolicy({ expirationDate: "2026-10-10" }),
      autoPolicy({ limits: { combinedSingleLimitCents: FIVE_HUNDRED_K } }),
      wcPolicy(),
    );
    const result = evaluate(extraction);
    expect(result.status).toBe("deficient");
    expect(result.gaps.map((g) => g.code)).toEqual(["policy_expiring", "limit_below_required"]);
  });

  it("is expiring when any required policy is in the window, and reports the earliest date", () => {
    const extraction = withPolicies(
      glPolicy({ expirationDate: "2026-10-30" }),
      autoPolicy({ expirationDate: "2026-10-20" }),
      wcPolicy(),
    );
    const result = evaluate(extraction);
    expect(result.status).toBe("expiring");
    expect(result.gaps.map((g) => g.policyType)).toEqual(["gl", "auto"]);
    expect(result.earliestExpiration).toBe("2026-10-20");
  });

  it("has no earliestExpiration when no required policy is present", () => {
    const result = evaluate(withPolicies(umbrellaPolicy()));
    expect(result.earliestExpiration).toBeNull();
    expect(result.status).toBe("deficient");
  });

  it("is compliant with no gaps when the template requires nothing", () => {
    const nothing: TemplateRules = {
      generalLiability: null,
      autoLiability: null,
      workersComp: null,
      umbrella: null,
      additionalInsured: false,
      waiverOfSubrogation: false,
      primaryNonContributory: false,
      noticeOfCancellationDays: 0,
      certificateHolderMustMatch: false,
    };
    expect(evaluate(withPolicies(), nothing)).toEqual({
      status: "compliant",
      gaps: [],
      earliestExpiration: null,
      needsReview: false,
      reviewFields: [],
    });
  });
});

describe("evaluateCertificate: endorsements", () => {
  const gl = (overrides: Partial<Policy>) => withPolicies(glPolicy(overrides), autoPolicy(), wcPolicy());
  const pnc: TemplateRules = { ...rules, primaryNonContributory: true };

  it("flags additional insured marked No", () => {
    expect(evaluate(gl({ additionalInsured: false })).gaps).toEqual([
      {
        code: "missing_additional_insured",
        message: "General liability policy does not show the certificate holder as additional insured.",
        actual: "No",
        policyType: "gl",
      },
    ]);
  });

  it("treats a blank (null) endorsement as missing and sends it for review", () => {
    const result = evaluate(gl({ additionalInsured: null, waiverOfSubrogation: null }));
    expect(result.status).toBe("deficient");
    expect(result.gaps.map((g) => [g.code, g.actual])).toEqual([
      ["missing_additional_insured", "not shown"],
      ["missing_waiver", "not shown"],
    ]);
    expect(result.needsReview).toBe(true);
    expect(result.reviewFields).toEqual(["policies.0.additionalInsured", "policies.0.waiverOfSubrogation"]);
  });

  it("checks primary and non-contributory only when required", () => {
    expect(codes(gl({ primaryNonContributory: false }))).toEqual([]);
    expect(evaluate(gl({ primaryNonContributory: false }), pnc).gaps).toEqual([
      {
        code: "missing_primary_noncontributory",
        message: "General liability policy does not show primary and non-contributory coverage.",
        actual: "No",
        policyType: "gl",
      },
    ]);
  });

  it("ignores endorsements the template does not require, even when blank", () => {
    const relaxed: TemplateRules = { ...rules, additionalInsured: false, waiverOfSubrogation: false };
    const result = evaluate(gl({ additionalInsured: null, waiverOfSubrogation: false }), relaxed);
    expect(result.gaps).toEqual([]);
    expect(result.needsReview).toBe(false);
  });

  it("reads endorsements from the GL policy, not from auto or WC", () => {
    const extraction = withPolicies(
      glPolicy({ waiverOfSubrogation: false }),
      autoPolicy({ waiverOfSubrogation: true }),
      wcPolicy({ waiverOfSubrogation: true }),
    );
    expect(codes(extraction)).toEqual(["missing_waiver"]);
  });

  it("reports required endorsements as missing when there is no GL policy at all", () => {
    const result = evaluate(withPolicies(autoPolicy(), wcPolicy()), pnc);
    expect(result.gaps.map((g) => [g.code, g.actual ?? null])).toEqual([
      ["missing_coverage", null],
      ["missing_additional_insured", "not shown"],
      ["missing_waiver", "not shown"],
      ["missing_primary_noncontributory", "not shown"],
    ]);
    expect(result.reviewFields).toEqual([]);
  });

  it("still checks endorsements on a GL policy the template does not require limits for", () => {
    const noGlLimits: TemplateRules = { ...rules, generalLiability: null };
    expect(codes(gl({ additionalInsured: false }), noGlLimits)).toEqual(["missing_additional_insured"]);
  });
});

describe("evaluateCertificate: notice of cancellation", () => {
  it("flags fewer notice days than required", () => {
    expect(evaluate(makeExtraction({ noticeOfCancellationDays: 10 })).gaps).toEqual([
      {
        code: "notice_days_below_required",
        message: "Notice of cancellation is 10 days; required 30 days.",
        required: "30 days",
        actual: "10 days",
      },
    ]);
  });

  it("accepts equal or longer notice", () => {
    expect(codes(makeExtraction({ noticeOfCancellationDays: 30 }))).toEqual([]);
    expect(codes(makeExtraction({ noticeOfCancellationDays: 60 }))).toEqual([]);
  });

  it("treats an unstated notice period as below required and sends it for review", () => {
    const result = evaluate(makeExtraction({ noticeOfCancellationDays: null }));
    expect(result.gaps).toEqual([
      {
        code: "notice_days_below_required",
        message: "Notice of cancellation period is not shown; required 30 days.",
        required: "30 days",
        actual: "not shown",
      },
    ]);
    expect(result.reviewFields).toEqual(["noticeOfCancellationDays"]);
    expect(result.needsReview).toBe(true);
  });

  it("does not check notice when the template requires 0 days", () => {
    const result = evaluate(makeExtraction({ noticeOfCancellationDays: null }), {
      ...rules,
      noticeOfCancellationDays: 0,
    });
    expect(result.gaps).toEqual([]);
    expect(result.needsReview).toBe(false);
  });
});

describe("evaluateCertificate: certificate holder", () => {
  it("accepts punctuation and suffix variants of the org's legal name", () => {
    for (const holder of ["NORTHGATE BUILDERS, L.L.C.", "Northgate Builders", "The Northgate Builders Co."]) {
      expect(codes(makeExtraction({ certificateHolderName: holder }))).toEqual([]);
    }
  });

  it("flags a different holder, quoting both names", () => {
    expect(evaluate(makeExtraction({ certificateHolderName: "Southgate Builders LLC" })).gaps).toEqual([
      {
        code: "holder_mismatch",
        message: 'Certificate holder is "Southgate Builders LLC"; required "Northgate Builders LLC".',
        required: "Northgate Builders LLC",
        actual: "Southgate Builders LLC",
      },
    ]);
  });

  it("skips the check when the template does not require a match", () => {
    const relaxed: TemplateRules = { ...rules, certificateHolderMustMatch: false };
    expect(codes(makeExtraction({ certificateHolderName: "Someone Else" }), relaxed)).toEqual([]);
  });

  it("skips the check when no holder name is supplied", () => {
    expect(codes(makeExtraction({ certificateHolderName: "Someone Else" }), rules, {})).toEqual(
      [],
    );
    expect(codes(makeExtraction({ certificateHolderName: "Someone Else" }), rules, { holderName: "  " })).toEqual([]);
  });

  it("reports a blank holder as unreadable, for review", () => {
    const result = evaluate(makeExtraction({ certificateHolderName: null }));
    expect(result.gaps).toEqual([
      {
        code: "unreadable_field",
        message: 'Certificate holder name is not shown; required "Northgate Builders LLC".',
        required: "Northgate Builders LLC",
        actual: "not shown",
      },
    ]);
    expect(result.reviewFields).toEqual(["certificateHolderName"]);
  });
});

describe("evaluateCertificate: low-confidence fields", () => {
  const lowConfidence = (fieldConfidence: Record<string, number>) =>
    makeExtraction({ fieldConfidence: { ...makeExtraction().fieldConfidence, ...fieldConfidence } });

  it("flags a checked field under 0.7 for review without changing the status", () => {
    const result = evaluate(lowConfidence({ "policies.0.limits.eachOccurrenceCents": 0.42 }));
    expect(result.status).toBe("compliant");
    expect(result.gaps).toEqual([]);
    expect(result.needsReview).toBe(true);
    expect(result.reviewFields).toEqual(["policies.0.limits.eachOccurrenceCents"]);
  });

  it("does not flag a field at exactly the threshold", () => {
    expect(evaluate(lowConfidence({ "policies.0.expirationDate": 0.7 })).needsReview).toBe(false);
  });

  it("ignores low confidence on fields no check uses", () => {
    const result = evaluate(lowConfidence({ insuredName: 0.1, producerName: 0.2, "policies.3.expirationDate": 0.1 }));
    expect(result.needsReview).toBe(false);
    expect(result.reviewFields).toEqual([]);
  });

  it("ignores low confidence on endorsements, notice and holder when they are not required", () => {
    const relaxed: TemplateRules = {
      ...rules,
      additionalInsured: false,
      waiverOfSubrogation: false,
      noticeOfCancellationDays: 0,
      certificateHolderMustMatch: false,
    };
    const extraction = lowConfidence({
      "policies.0.additionalInsured": 0.3,
      "policies.0.waiverOfSubrogation": 0.3,
      noticeOfCancellationDays: 0.3,
      certificateHolderName: 0.3,
    });
    expect(evaluate(extraction, relaxed).needsReview).toBe(false);
    expect(evaluate(extraction).reviewFields).toEqual([
      "policies.0.additionalInsured",
      "policies.0.waiverOfSubrogation",
      "noticeOfCancellationDays",
      "certificateHolderName",
    ]);
  });

  it("lets a policy-level key cover every checked field of that policy", () => {
    const result = evaluate(lowConfidence({ "policies.1": 0.5 }));
    expect(result.reviewFields).toEqual([
      "policies.1.type",
      "policies.1.limits.combinedSingleLimitCents",
      "policies.1.expirationDate",
    ]);
  });

  it("does not treat 'policies.1' as a prefix of 'policies.10'", () => {
    const many = makeExtraction({
      policies: [
        ...Array.from({ length: 10 }, () => umbrellaPolicy()),
        glPolicy(),
        autoPolicy(),
        wcPolicy(),
      ],
      fieldConfidence: { "policies.1": 0.1 },
    });
    expect(evaluate(many).needsReview).toBe(false);
  });

  it("honours a custom threshold", () => {
    const extraction = lowConfidence({ "policies.2.limits.eachAccidentCents": 0.85 });
    expect(evaluate(extraction).needsReview).toBe(false);
    expect(evaluate(extraction, rules, { ...withHolder, confidenceThreshold: 0.86 }).reviewFields).toEqual([
      "policies.2.limits.eachAccidentCents",
    ]);
  });

  it("lists a field once even when it is both blank and low confidence", () => {
    const extraction = makeExtraction({
      noticeOfCancellationDays: null,
      fieldConfidence: { noticeOfCancellationDays: 0.2 },
    });
    expect(evaluate(extraction).reviewFields).toEqual(["noticeOfCancellationDays"]);
  });
});

describe("evaluateCertificate: gap ordering", () => {
  it("orders coverage gaps gl, auto, wc, umbrella, then endorsements, notice and holder", () => {
    const template: TemplateRules = {
      ...rules,
      umbrella: { eachOccurrenceCents: FIVE_MILLION },
      primaryNonContributory: true,
    };
    const extraction = makeExtraction({
      // Deliberately listed out of order on the certificate.
      policies: [
        wcPolicy({ expirationDate: "2026-09-01" }),
        glPolicy({
          limits: { eachOccurrenceCents: FIVE_HUNDRED_K, aggregateCents: ONE_MILLION },
          expirationDate: "2026-10-20",
          additionalInsured: false,
          waiverOfSubrogation: false,
          primaryNonContributory: false,
        }),
      ],
      noticeOfCancellationDays: 10,
      certificateHolderName: "Someone Else Inc",
    });
    const result = evaluate(extraction, template);
    expect(result.gaps.map((g) => `${g.code}${g.policyType ? `:${g.policyType}` : ""}`)).toEqual([
      "limit_below_required:gl",
      "limit_below_required:gl",
      "policy_expiring:gl",
      "missing_coverage:auto",
      "policy_expired:wc",
      "missing_coverage:umbrella",
      "missing_additional_insured:gl",
      "missing_waiver:gl",
      "missing_primary_noncontributory:gl",
      "notice_days_below_required",
      "holder_mismatch",
    ]);
    expect(result.status).toBe("expired");
    expect(result.earliestExpiration).toBe("2026-09-01");
  });
});
