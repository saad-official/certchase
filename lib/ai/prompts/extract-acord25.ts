import "server-only";
import { generateStructuredFromFile, type CallMeta, type FileInput } from "@/lib/ai/generate";
import { ExtractionSchema, type Extraction } from "@/lib/domain/types";

export const EXTRACT_ACORD25_PROMPT_VERSION = "extract-acord25/v1";

const INSTRUCTIONS = `You read certificates of liability insurance (ACORD 25 form and similar) and return their contents as structured data.
Rules:
- Copy values exactly as printed. Do not infer coverage that is not on the document.
- Dates: output YYYY-MM-DD. ACORD dates are printed MM/DD/YYYY.
- Money: output integer cents. "$1,000,000" → 100000000. Blank limit → omit the field.
- Policy types: GENERAL LIABILITY → gl; AUTOMOBILE LIABILITY → auto; WORKERS COMPENSATION AND EMPLOYERS' LIABILITY → wc; UMBRELLA LIAB or EXCESS LIAB → umbrella; anything else → other.
- Limits: gl eachOccurrenceCents = "EACH OCCURRENCE", aggregateCents = "GENERAL AGGREGATE"; auto combinedSingleLimitCents = "COMBINED SINGLE LIMIT"; wc eachAccidentCents = "E.L. EACH ACCIDENT"; umbrella eachOccurrenceCents = "EACH OCCURRENCE".
- Endorsements: additionalInsured is true if the ADDL INSD column is marked for that policy OR the description of operations says the certificate holder is an additional insured; waiverOfSubrogation is true if the SUBR WVD column is marked or the description says waiver of subrogation applies; primaryNonContributory is true only if the description says primary and non-contributory (or primary/noncontributory). Use null when the document gives no signal.
- noticeOfCancellationDays: the number of days of notice stated in the cancellation section or description (e.g. "30 days notice"); null if none stated.
- fieldConfidence: for each field you populated, your confidence 0..1 that you read it correctly (use dotted keys like "insuredName", "policies.0.expirationDate", "policies.1.limits.eachOccurrenceCents").
- evidence: for the same keys, a short verbatim quote (max 80 chars) from the document that supports the value.
- If the document is not a certificate of insurance, return an empty policies array and set insuredName to the most prominent name with low confidence.`;

export async function extractAcord25(
  file: FileInput,
): Promise<{ extraction: Extraction; meta: CallMeta }> {
  const { object, meta } = await generateStructuredFromFile({
    name: "extract_acord25",
    promptVersion: EXTRACT_ACORD25_PROMPT_VERSION,
    schema: ExtractionSchema,
    instructions: INSTRUCTIONS,
    prompt:
      "Extract this certificate of insurance. Return every policy row that has a policy number, even if some limits are blank.",
    file,
    temperature: 0,
  });
  return { extraction: object, meta };
}
