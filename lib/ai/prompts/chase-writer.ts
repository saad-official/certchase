import "server-only";
import { generateStructured, type CallMeta } from "@/lib/ai/generate";
import { validateChaseDraft, type ChaseValidation } from "@/lib/domain/guardrails";
import { ChaseDraftOutputSchema, type ChaseDraftOutput, type ChaseKind, type Gap } from "@/lib/domain/types";

export const CHASE_WRITER_PROMPT_VERSION = "chase-writer/v1";

export type ChaseWriterInput = {
  kind: ChaseKind;
  businessName: string;
  legalName: string;
  signature: string;
  toneNotes: string;
  vendorName: string;
  recipientName?: string | null;
  recipientIsBroker: boolean;
  trade?: string | null;
  /** From the rule engine; must be quoted, never softened. */
  gaps: Gap[];
  /** ISO date of the earliest required policy expiration, for renewals. */
  expirationDate?: string | null;
  /** 1-based step in the chase cadence. */
  step: number;
  priorSubjects: string[];
  /** Owner feedback from rejected drafts, newest first (max 3). */
  rejectionReasons?: string[];
};

export type ChaseWriterResult = { draft: ChaseDraftOutput; validation: ChaseValidation; meta: CallMeta };

const KIND_GUIDE: Record<ChaseKind, string> = {
  request_initial:
    "First request for a certificate of insurance. Explain who we are, that our contract requires a current certificate naming us as certificate holder, and list the required coverages. Offer to send our requirements sheet.",
  deficiency:
    "The certificate we have does not meet the contract requirements. List each finding exactly as given (the findings come from our rules, not from you). Ask for a corrected certificate or endorsement. Be matter-of-fact: brokers see these daily.",
  renewal:
    "A policy on the certificate expires soon. Give the expiration date and ask for the renewal certificate before that date so work can continue without interruption.",
};

const INSTRUCTIONS = `You write short, professional emails on behalf of a small contractor or property manager about certificates of insurance.
Rules:
- Write as the business owner in first person plural ("we").
- 70 to 180 words in the body. Plain English. No marketing tone, no exclamation marks, no ALL CAPS.
- When findings are provided, include each finding's text verbatim as a bulleted line ("- ..."). Do not add findings, soften them, interpret coverage, or add requirements that are not in the findings (for example project completion dates).
- Never threaten, never mention lawyers, legal action, back-charges or withholding payment.
- Never invent policy numbers, limits, dates or names not in the input.
- No placeholders like [Name]; use the real values given.
- End with the provided signature exactly.
- Subject under 80 characters, mentions the vendor name and the topic (certificate of insurance).
- confidence: 0..1 that the owner would send this unchanged. rationale: one sentence.`;

export async function writeChaseEmail(input: ChaseWriterInput): Promise<ChaseWriterResult> {
  const prompt = buildPrompt(input);
  const { object, meta } = await generateStructured({
    name: "chase_writer",
    promptVersion: CHASE_WRITER_PROMPT_VERSION,
    schema: ChaseDraftOutputSchema,
    instructions: INSTRUCTIONS,
    prompt,
    temperature: 0.4,
  });
  const validation = validateChaseDraft(object, {
    vendorName: input.vendorName,
    gaps: input.gaps,
    signature: input.signature,
    kind: input.kind,
  });
  return { draft: { ...object, confidence: validation.adjustedConfidence }, validation, meta };
}

export function buildPrompt(input: ChaseWriterInput): string {
  const findings =
    input.gaps.length === 0
      ? "None. Do not include a findings list or any bullet points in this email."
      : input.gaps.map((g) => `- ${g.message}`).join("\n");
  const feedback =
    input.rejectionReasons && input.rejectionReasons.length > 0
      ? `Owner feedback on earlier drafts (apply it):\n${input.rejectionReasons.map((r) => `- ${r}`).join("\n")}`
      : "";
  return [
    `Email kind: ${input.kind}. Step ${input.step} of 3${input.step > 1 ? " (a follow-up; reference that we wrote before)" : ""}. ${KIND_GUIDE[input.kind]}`,
    "",
    `Our business: ${input.businessName} (legal name on certificates: ${input.legalName}).`,
    `Signature (use exactly):\n${input.signature}`,
    input.toneNotes ? `Owner's voice notes: ${input.toneNotes}` : "",
    "",
    `Vendor: ${input.vendorName}${input.trade ? ` (${input.trade})` : ""}.`,
    `Recipient: ${input.recipientName ?? (input.recipientIsBroker ? "the vendor's insurance broker" : "the vendor")}${input.recipientIsBroker ? " (insurance broker)" : ""}.`,
    input.expirationDate ? `Earliest policy expiration: ${input.expirationDate}.` : "",
    "",
    `Findings from our requirements check (quote verbatim as bullets):\n${findings}`,
    input.priorSubjects.length > 0 ? `\nEarlier emails on this topic: ${input.priorSubjects.map((s) => `"${s}"`).join(", ")}` : "",
    feedback ? `\n${feedback}` : "",
  ]
    .join("\n")
    .trim();
}
