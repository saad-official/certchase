import type { CertificateDocument } from "@/lib/pdf/acord25";
import type { Extraction, VendorInput } from "@/lib/domain/types";
import { addDaysToIsoDate } from "@/lib/domain/dates";

/**
 * Synthetic vendors and certificates for the demo. Every certificate is
 * generated from the extraction below, so the demo can show the model's
 * reading against the known truth. Dates are relative to `today` so the
 * statuses stay meaningful whenever the demo is loaded.
 *
 * Expected statuses against the default template (GL 1M/2M, Auto 1M CSL,
 * WC 1M, additional insured + waiver required, 30-day notice, holder match):
 *   ridgeline  compliant
 *   harbor     expiring (GL expires in 18 days)
 *   northside  deficient (GL each occurrence 500k; waiver missing)
 *   summit     expired (auto policy expired 12 days ago)
 *   bluegrass  deficient (no workers comp; holder mismatch)
 *   atlas      compliant (umbrella present, not required)
 *   cedar      missing (no certificate yet)
 *   pioneer    compliant but needs review (low-confidence notice days)
 */

export type DemoVendor = {
  key: string;
  vendor: VendorInput;
  certificate: ((today: string, holder: string) => CertificateDocument) | null;
  /** Lower a couple of confidences to exercise the review flow. */
  lowConfidenceFields?: string[];
};

const PRODUCERS = {
  keystone: {
    producerName: "Keystone Risk Partners",
    producerEmail: "certs@keystonerisk.example",
    producerPhone: "(555) 014-2200",
    producerAddress: "410 Commerce Way, Suite 300, Denver, CO 80202",
  },
  lakeshore: {
    producerName: "Lakeshore Insurance Agency",
    producerEmail: "coi@lakeshoreins.example",
    producerPhone: "(555) 018-7731",
    producerAddress: "88 Harbor Street, Cleveland, OH 44113",
  },
  meridian: {
    producerName: "Meridian Brokerage",
    producerEmail: "service@meridianbrokerage.example",
    producerPhone: "(555) 011-9040",
    producerAddress: "1200 Market Street, Philadelphia, PA 19107",
  },
};

function confidence(fields: string[], value = 0.94): Record<string, number> {
  return Object.fromEntries(fields.map((f) => [f, value]));
}

function base(
  today: string,
  holder: string,
  producer: (typeof PRODUCERS)[keyof typeof PRODUCERS],
  insuredName: string,
  insuredAddress: string,
  policies: Extraction["policies"],
  overrides: Partial<CertificateDocument> = {},
): CertificateDocument {
  const fields = [
    "insuredName",
    "producerName",
    "certificateHolderName",
    "issueDate",
    "noticeOfCancellationDays",
    ...policies.flatMap((_, i) => [
      `policies.${i}.policyNumber`,
      `policies.${i}.effectiveDate`,
      `policies.${i}.expirationDate`,
      `policies.${i}.limits`,
    ]),
  ];
  return {
    insuredName,
    insuredAddress,
    ...producer,
    certificateHolderName: holder,
    certificateHolderAddress: "Attn: Risk Management",
    issueDate: addDaysToIsoDate(today, -20),
    policies,
    noticeOfCancellationDays: 30,
    descriptionOfOperations: `${holder} is included as additional insured with respect to general liability on a primary basis where required by written contract. Waiver of subrogation applies in favor of the certificate holder where required by written contract.`,
    fieldConfidence: confidence(fields),
    evidence: {
      insuredName: insuredName.toUpperCase(),
      certificateHolderName: holder.toUpperCase(),
      noticeOfCancellationDays: "30 DAYS NOTICE OF CANCELLATION",
    },
    ...overrides,
  };
}

function gl(num: string, eff: string, exp: string, each = 100_000_000, agg = 200_000_000, ai = true, wv = true): Extraction["policies"][number] {
  return {
    type: "gl",
    insurer: "Granite State Mutual",
    policyNumber: num,
    effectiveDate: eff,
    expirationDate: exp,
    limits: { eachOccurrenceCents: each, aggregateCents: agg },
    additionalInsured: ai,
    waiverOfSubrogation: wv,
    primaryNonContributory: true,
  };
}
function auto(num: string, eff: string, exp: string, csl = 100_000_000): Extraction["policies"][number] {
  return {
    type: "auto",
    insurer: "Granite State Mutual",
    policyNumber: num,
    effectiveDate: eff,
    expirationDate: exp,
    limits: { combinedSingleLimitCents: csl },
    additionalInsured: null,
    waiverOfSubrogation: null,
    primaryNonContributory: null,
  };
}
function wc(num: string, eff: string, exp: string, each = 100_000_000): Extraction["policies"][number] {
  return {
    type: "wc",
    insurer: "Allied Compensation Co.",
    policyNumber: num,
    effectiveDate: eff,
    expirationDate: exp,
    limits: { eachAccidentCents: each },
    additionalInsured: null,
    waiverOfSubrogation: true,
    primaryNonContributory: null,
  };
}
function umbrella(num: string, eff: string, exp: string, each = 500_000_000): Extraction["policies"][number] {
  return {
    type: "umbrella",
    insurer: "Northstar Excess & Surplus",
    policyNumber: num,
    effectiveDate: eff,
    expirationDate: exp,
    limits: { eachOccurrenceCents: each },
    additionalInsured: null,
    waiverOfSubrogation: null,
    primaryNonContributory: null,
  };
}

export const DEMO_VENDORS: DemoVendor[] = [
  {
    key: "ridgeline",
    vendor: {
      name: "Ridgeline Electric LLC",
      contactEmail: "office@ridgelineelectric.example",
      brokerName: "Keystone Risk Partners",
      brokerEmail: "certs@keystonerisk.example",
      trade: "Electrical",
      contractValueCents: 18_500_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(today, holder, PRODUCERS.keystone, "Ridgeline Electric LLC", "2210 Alder Road, Boulder, CO 80301", [
        gl("GL-7731904", addDaysToIsoDate(today, -140), addDaysToIsoDate(today, 225)),
        auto("CA-5520817", addDaysToIsoDate(today, -140), addDaysToIsoDate(today, 225)),
        wc("WC-9016623", addDaysToIsoDate(today, -100), addDaysToIsoDate(today, 265)),
      ]),
  },
  {
    key: "harbor",
    vendor: {
      name: "Harbor Mechanical Inc.",
      contactEmail: "admin@harbormech.example",
      brokerName: "Lakeshore Insurance Agency",
      brokerEmail: "coi@lakeshoreins.example",
      trade: "HVAC",
      contractValueCents: 42_000_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(today, holder, PRODUCERS.lakeshore, "Harbor Mechanical Inc.", "97 Dock Street, Cleveland, OH 44114", [
        gl("GL-2208115", addDaysToIsoDate(today, -347), addDaysToIsoDate(today, 18)),
        auto("CA-2208116", addDaysToIsoDate(today, -347), addDaysToIsoDate(today, 18)),
        wc("WC-6611340", addDaysToIsoDate(today, -200), addDaysToIsoDate(today, 165)),
      ]),
  },
  {
    key: "northside",
    vendor: {
      name: "Northside Drywall Co.",
      contactEmail: "jlopez@northsidedrywall.example",
      brokerName: "Meridian Brokerage",
      brokerEmail: "service@meridianbrokerage.example",
      trade: "Drywall",
      contractValueCents: 9_800_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(
        today,
        holder,
        PRODUCERS.meridian,
        "Northside Drywall Co.",
        "515 Girard Avenue, Philadelphia, PA 19123",
        [
          gl("GL-4480211", addDaysToIsoDate(today, -60), addDaysToIsoDate(today, 305), 50_000_000, 100_000_000, true, false),
          auto("CA-4480212", addDaysToIsoDate(today, -60), addDaysToIsoDate(today, 305)),
          wc("WC-3302981", addDaysToIsoDate(today, -60), addDaysToIsoDate(today, 305)),
        ],
        {
          descriptionOfOperations: `${holder} is included as additional insured with respect to general liability where required by written contract.`,
        },
      ),
  },
  {
    key: "summit",
    vendor: {
      name: "Summit Roofing & Sheet Metal",
      contactEmail: "dispatch@summitroofing.example",
      brokerName: "Keystone Risk Partners",
      brokerEmail: "certs@keystonerisk.example",
      trade: "Roofing",
      contractValueCents: 61_200_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(today, holder, PRODUCERS.keystone, "Summit Roofing & Sheet Metal", "7 Quarry Lane, Golden, CO 80401", [
        gl("GL-9915002", addDaysToIsoDate(today, -300), addDaysToIsoDate(today, 65)),
        auto("CA-9915003", addDaysToIsoDate(today, -377), addDaysToIsoDate(today, -12)),
        wc("WC-7720455", addDaysToIsoDate(today, -300), addDaysToIsoDate(today, 65)),
      ]),
  },
  {
    key: "bluegrass",
    vendor: {
      name: "Bluegrass Landscaping",
      contactEmail: "hello@bluegrasslandscaping.example",
      brokerName: null,
      brokerEmail: null,
      trade: "Landscaping",
      contractValueCents: 4_400_000,
      doNotContact: false,
    },
    certificate: (today) =>
      base(
        today,
        "Bluegrass Property Services",
        PRODUCERS.lakeshore,
        "Bluegrass Landscaping",
        "310 Meadow Road, Lexington, KY 40502",
        [
          gl("GL-1140077", addDaysToIsoDate(today, -90), addDaysToIsoDate(today, 275)),
          auto("CA-1140078", addDaysToIsoDate(today, -90), addDaysToIsoDate(today, 275)),
        ],
        { certificateHolderName: "Bluegrass Property Services" },
      ),
  },
  {
    key: "atlas",
    vendor: {
      name: "Atlas Concrete Partners",
      contactEmail: "pm@atlasconcrete.example",
      brokerName: "Meridian Brokerage",
      brokerEmail: "service@meridianbrokerage.example",
      trade: "Concrete",
      contractValueCents: 88_000_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(today, holder, PRODUCERS.meridian, "Atlas Concrete Partners", "4000 Industrial Blvd, Camden, NJ 08104", [
        gl("GL-6650912", addDaysToIsoDate(today, -30), addDaysToIsoDate(today, 335)),
        auto("CA-6650913", addDaysToIsoDate(today, -30), addDaysToIsoDate(today, 335)),
        wc("WC-8810234", addDaysToIsoDate(today, -30), addDaysToIsoDate(today, 335)),
        umbrella("UMB-2201177", addDaysToIsoDate(today, -30), addDaysToIsoDate(today, 335)),
      ]),
  },
  {
    key: "cedar",
    vendor: {
      name: "Cedar & Stone Masonry",
      contactEmail: "cedarstone@masonry.example",
      brokerName: null,
      brokerEmail: null,
      trade: "Masonry",
      contractValueCents: 12_700_000,
      doNotContact: false,
    },
    certificate: null,
  },
  {
    key: "pioneer",
    vendor: {
      name: "Pioneer Plumbing Services",
      contactEmail: "service@pioneerplumbing.example",
      brokerName: "Lakeshore Insurance Agency",
      brokerEmail: "coi@lakeshoreins.example",
      trade: "Plumbing",
      contractValueCents: 15_300_000,
      doNotContact: false,
    },
    certificate: (today, holder) =>
      base(today, holder, PRODUCERS.lakeshore, "Pioneer Plumbing Services", "62 Mill Street, Akron, OH 44308", [
        gl("GL-3390456", addDaysToIsoDate(today, -75), addDaysToIsoDate(today, 290)),
        auto("CA-3390457", addDaysToIsoDate(today, -75), addDaysToIsoDate(today, 290)),
        wc("WC-5570890", addDaysToIsoDate(today, -75), addDaysToIsoDate(today, 290)),
      ]),
    lowConfidenceFields: ["noticeOfCancellationDays"],
  },
];
