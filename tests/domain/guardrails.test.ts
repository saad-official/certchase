import { describe, expect, it } from "vitest";
import {
  AUTO_RENEWAL_MIN_CONFIDENCE,
  BODY_MAX,
  BODY_MIN,
  decideAutonomy,
  SUBJECT_MAX,
  validateChaseDraft,
  type ChaseDraftContext,
} from "@/lib/domain/guardrails";
import { evaluateCertificate } from "@/lib/domain/rules";
import { DEFAULT_TEMPLATE_RULES, type ChaseDraftOutput, type Gap } from "@/lib/domain/types";
import { makeOrg } from "./fixtures/entities";
import { deficientExtraction, expiringExtraction, ORG_LEGAL_NAME, TODAY } from "./fixtures/extractions";

const deficiencyGaps = evaluateCertificate(deficientExtraction, DEFAULT_TEMPLATE_RULES, TODAY, {
  holderName: ORG_LEGAL_NAME,
}).gaps;
const renewalGaps = evaluateCertificate(expiringExtraction, DEFAULT_TEMPLATE_RULES, TODAY, {
  holderName: ORG_LEGAL_NAME,
}).gaps;

const ctx: ChaseDraftContext = {
  vendorName: "Bluestone Masonry LLC",
  gaps: deficiencyGaps,
  signature: "Dana Ortiz, Northgate Builders",
  kind: "deficiency",
};

const goodBody = [
  "Hi Pioneer Risk Partners team,",
  "",
  "We reviewed the certificate of insurance for Bluestone Masonry LLC and it does not yet meet our requirements:",
  "",
  "- General liability each occurrence limit is $500,000; required $1,000,000.",
  "- General liability policy does not show a waiver of subrogation.",
  "",
  "Could you send an updated certificate that addresses both items?",
  "",
  "Thanks,",
  "Dana Ortiz, Northgate Builders",
].join("\n");

function draft(overrides: Partial<ChaseDraftOutput> = {}): ChaseDraftOutput {
  return {
    subject: "Updated certificate needed for Bluestone Masonry LLC",
    body: goodBody,
    confidence: 0.9,
    rationale: "Deficiency step 1; lists both rule gaps.",
    ...overrides,
  };
}

const codes = (d: ChaseDraftOutput, c: ChaseDraftContext = ctx) => validateChaseDraft(d, c).violations.map((v) => v.code);

describe("validateChaseDraft", () => {
  it("passes a clean deficiency draft and keeps its confidence", () => {
    expect(validateChaseDraft(draft(), ctx)).toEqual({ ok: true, violations: [], adjustedConfidence: 0.9 });
  });

  it("clamps confidence into [0, 1]", () => {
    expect(validateChaseDraft(draft({ confidence: 1.3 }), ctx).adjustedConfidence).toBe(1);
    expect(validateChaseDraft(draft({ confidence: Number.NaN }), ctx).adjustedConfidence).toBe(0);
  });

  it("forces confidence to 0 on any violation", () => {
    const result = validateChaseDraft(draft({ subject: "Hi" }), ctx);
    expect(result.ok).toBe(false);
    expect(result.adjustedConfidence).toBe(0);
  });

  describe("vendor name", () => {
    it("requires the vendor name in the body", () => {
      const body = goodBody.replace("Bluestone Masonry LLC", "your company");
      expect(codes(draft({ body }))).toEqual(["missing_vendor_name"]);
    });

    it.each(["Bluestone Masonry", "BLUESTONE MASONRY, L.L.C.", "bluestone masonry"])(
      "accepts the normalised form %j",
      (name) => {
        expect(codes(draft({ body: goodBody.replace("Bluestone Masonry LLC", name) }))).toEqual([]);
      },
    );

    it("does not accept a partial name", () => {
      expect(codes(draft({ body: goodBody.replace("Bluestone Masonry LLC", "Bluestone") }))).toContain(
        "missing_vendor_name",
      );
    });
  });

  describe("gaps", () => {
    it("requires every gap from the rules", () => {
      const body = goodBody.replace("- General liability policy does not show a waiver of subrogation.\n", "");
      const result = validateChaseDraft(draft({ body }), ctx);
      expect(result.violations).toEqual([
        {
          code: "missing_gap",
          message: 'Body must state the gap "General liability policy does not show a waiver of subrogation."',
        },
      ]);
    });

    it("accepts a gap stated by its required value instead of the full sentence", () => {
      const body = goodBody.replace(
        "General liability each occurrence limit is $500,000; required $1,000,000.",
        "Please raise the general liability limit to $1,000,000 each occurrence.",
      );
      expect(codes(draft({ body }))).toEqual([]);
    });

    it("rejects a softened gap that drops the required value", () => {
      const body = goodBody.replace(
        "General liability each occurrence limit is $500,000; required $1,000,000.",
        "The general liability limit looks a little low.",
      );
      expect(codes(draft({ body }))).toEqual(["missing_gap"]);
    });

    it("matches gap messages ignoring case, spacing and the trailing period", () => {
      const body = goodBody.replace(
        "- General liability policy does not show a waiver of subrogation.",
        "Also, the general liability policy   does not show a waiver of subrogation, which we need",
      );
      expect(codes(draft({ body }))).toEqual([]);
    });

    it("requires the expiring-policy gap in a renewal draft", () => {
      const renewal: ChaseDraftContext = { ...ctx, vendorName: "Copperline Plumbing Co", gaps: renewalGaps, kind: "renewal" };
      const body = [
        "Hi,",
        "",
        "A reminder that the certificate on file for Copperline Plumbing Co is coming up for renewal:",
        "General liability policy expires on 2026-10-15.",
        "Please send the renewed certificate when it is issued.",
        "",
        "Best regards,",
        "Dana",
      ].join("\n");
      expect(codes(draft({ body }), renewal)).toEqual([]);
      expect(codes(draft({ body: body.replace("2026-10-15", "mid October") }), renewal)).toEqual(["missing_gap"]);
    });

    it("does not require gaps for an initial request", () => {
      const request: ChaseDraftContext = { ...ctx, kind: "request_initial" };
      const body = [
        "Hello,",
        "",
        "We do not yet have a certificate of insurance on file for Bluestone Masonry LLC. Could you send one naming Northgate Builders LLC as certificate holder?",
        "",
        "Thank you,",
        "Dana",
      ].join("\n");
      expect(codes(draft({ body }), request)).toEqual([]);
    });

    it("ignores a gap without a message", () => {
      const blank: Gap = { code: "missing_waiver", message: "  " };
      expect(codes(draft(), { ...ctx, gaps: [...deficiencyGaps, blank] })).toEqual([]);
    });
  });

  it.each([
    ["Hi {{broker_name}},"],
    ["Hi {first_name},"],
    ["Hi [NAME],"],
    ["Hi [Broker Name],"],
    ["Hi <<BROKER>>,"],
  ])("rejects the placeholder %j", (greeting) => {
    expect(codes(draft({ body: goodBody.replace("Hi Pioneer Risk Partners team,", greeting) }))).toContain(
      "placeholder",
    );
  });

  it("does not treat a bracketed list marker as a placeholder", () => {
    expect(codes(draft({ body: goodBody.replace("- General", "[1] General") }))).toEqual([]);
  });

  it("enforces subject length", () => {
    expect(codes(draft({ subject: "Hi" }))).toEqual(["subject_length"]);
    expect(codes(draft({ subject: "COI" }))).toEqual([]);
    expect(codes(draft({ subject: "x".repeat(SUBJECT_MAX) }))).toEqual([]);
    expect(codes(draft({ subject: "x".repeat(SUBJECT_MAX + 1) }))).toEqual(["subject_length"]);
  });

  it("enforces body length", () => {
    const request: ChaseDraftContext = { ...ctx, kind: "request_initial", vendorName: "Ab Cd" };
    const sized = (n: number) => {
      const tail = "\nThanks,\nAb Cd";
      return "x".repeat(n - tail.length) + tail;
    };
    expect(BODY_MIN).toBe(40);
    expect(BODY_MAX).toBe(2000);
    expect(codes(draft({ body: sized(BODY_MIN) }), request)).toEqual([]);
    expect(codes(draft({ body: sized(BODY_MIN - 1) }), request)).toEqual(["body_length"]);
    expect(codes(draft({ body: sized(BODY_MAX) }), request)).toEqual([]);
    expect(codes(draft({ body: sized(BODY_MAX + 1) }), request)).toEqual(["body_length"]);
  });

  it.each([
    "we will take legal action",
    "this may lead to a lawsuit",
    "we will sue",
    "our attorney will follow up",
    "we have passed this to our lawyers",
    "we will see you in court",
    "this is a breach of contract",
    "send it today or else",
    "you will be blacklisted",
    "this is damn frustrating",
  ])("rejects banned language: %j", (phrase) => {
    const body = goodBody.replace("Could you send", `Note that ${phrase}. Could you send`);
    expect(codes(draft({ body }))).toEqual(["banned_phrase"]);
  });

  it("does not flag banned words inside the vendor name or ordinary words", () => {
    const court: ChaseDraftContext = { ...ctx, vendorName: "Court Street Builders" };
    const body = goodBody
      .replace("Bluestone Masonry LLC", "Court Street Builders")
      .replace("Hi Pioneer Risk Partners team,", "Hi Sue,")
      .replace("Could you send", "The courtyard work is pursued separately. Could you send");
    expect(codes(draft({ body }), court)).toEqual([]);
  });

  it("allows one exclamation mark and rejects two", () => {
    expect(codes(draft({ subject: "Certificate update needed!" }))).toEqual([]);
    expect(codes(draft({ subject: "Certificate update needed!", body: goodBody.replace("items?", "items!") }))).toEqual(
      ["exclamation"],
    );
  });

  describe("sign-off", () => {
    it("requires a sign-off", () => {
      const body = goodBody.replace("\n\nThanks,\nDana Ortiz, Northgate Builders", "");
      expect(codes(draft({ body }))).toEqual(["missing_sign_off"]);
    });

    it("accepts the org signature on its own", () => {
      const body = goodBody.replace("Thanks,\n", "");
      expect(codes(draft({ body }))).toEqual([]);
    });

    it.each(["Best regards,", "Kind regards", "Thank you,", "Sincerely,", "Many thanks"])("accepts %j", (signOff) => {
      const body = goodBody.replace("Thanks,\nDana Ortiz, Northgate Builders", `${signOff}\nDana`);
      expect(codes(draft({ body }), { ...ctx, signature: undefined })).toEqual([]);
    });
  });

  it("reports several violations together", () => {
    const result = validateChaseDraft(draft({ subject: "x", body: "Hi [NAME]! We will sue!" }), ctx);
    expect(result.violations.map((v) => v.code)).toEqual([
      "missing_vendor_name",
      "missing_gap",
      "missing_gap",
      "placeholder",
      "subject_length",
      "body_length",
      "banned_phrase",
      "exclamation",
      "missing_sign_off",
    ]);
  });
});

describe("decideAutonomy", () => {
  it("always needs approval on the free plan", () => {
    expect(decideAutonomy(makeOrg({ plan: "free" }), "renewal", 0.99)).toBe("needs_approval");
  });

  it("always needs approval in manual mode", () => {
    expect(decideAutonomy(makeOrg({ autonomy: "manual" }), "renewal", 0.99)).toBe("needs_approval");
  });

  it("auto-sends Pro renewal reminders at or above 0.8", () => {
    expect(AUTO_RENEWAL_MIN_CONFIDENCE).toBe(0.8);
    expect(decideAutonomy(makeOrg(), "renewal", 0.8)).toBe("auto_send");
    expect(decideAutonomy(makeOrg(), "renewal", 0.79)).toBe("needs_approval");
  });

  it.each(["request_initial", "deficiency"] as const)("never auto-sends %s emails", (kind) => {
    expect(decideAutonomy(makeOrg(), kind, 1)).toBe("needs_approval");
  });

  it("needs approval for a non-finite confidence", () => {
    expect(decideAutonomy(makeOrg(), "renewal", Number.NaN)).toBe("needs_approval");
    expect(decideAutonomy(makeOrg(), "renewal", Number.POSITIVE_INFINITY)).toBe("needs_approval");
  });
});
