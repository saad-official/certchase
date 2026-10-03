/**
 * Guardrails applied to every model-written chase email before it is saved
 * (spec 3.5), and the autonomy decision that gates auto-send.
 * The rules decide the gaps; these checks stop the model from dropping or
 * softening them, inventing placeholders, or threatening anyone.
 */
import { normalizeCompanyName } from "./normalize";
import type { ChaseDraftOutput, ChaseKind, Gap, Organization } from "./types";

export interface ChaseDraftContext {
  vendorName: string;
  /** Gaps from evaluateCertificate; deficiency and renewal drafts must state each one. */
  gaps: readonly Gap[];
  /** Org voice signature; when present in the body it counts as a sign-off. */
  signature?: string;
  kind: ChaseKind;
}

export type ViolationCode =
  | "missing_vendor_name"
  | "missing_gap"
  | "placeholder"
  | "subject_length"
  | "body_length"
  | "banned_phrase"
  | "exclamation"
  | "missing_sign_off";

export interface Violation {
  code: ViolationCode;
  message: string;
}

export interface ChaseValidation {
  ok: boolean;
  violations: Violation[];
  /** Draft confidence clamped to [0, 1], or 0 when any violation exists (forces approval). */
  adjustedConfidence: number;
}

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 120;
export const BODY_MIN = 40;
export const BODY_MAX = 2000;
export const MAX_EXCLAMATIONS = 1;

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{\{[^}]*\}\}/, // {{broker_name}}
  /\{[A-Za-z_][\w ]*\}/, // {first_name}
  /\[[A-Z][A-Za-z]*(?:[ _][A-Za-z]+)*\]/, // [NAME], [Broker Name]
  /<<[^>]*>>/, // <<BROKER>>
];

/** Legal threats, coercion and profanity. Word-bounded to avoid "courtyard" or "pursued". */
export const BANNED_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "legal action", pattern: /\blegal (?:action|proceedings?)\b/i },
  { label: "lawsuit", pattern: /\blaw ?suits?\b/i },
  // Lower-case only so a broker called "Sue" is not flagged.
  { label: "sue", pattern: /\b(?:sue|sued|suing)\b/ },
  { label: "litigation", pattern: /\b(?:litigation|litigate|prosecut\w*)\b/i },
  { label: "attorney", pattern: /\battorneys?\b/i },
  { label: "lawyer", pattern: /\blawyers?\b/i },
  { label: "court", pattern: /\b(?:courts?|small claims)\b/i },
  { label: "breach of contract", pattern: /\bbreach(?:es|ed)? (?:of )?(?:the |your |our )?contract\b/i },
  { label: "blacklist", pattern: /\bblacklist\w*\b/i },
  { label: "police", pattern: /\b(?:police|arrest\w*|jail|prison)\b/i },
  { label: "or else", pattern: /\bor else\b/i },
  { label: "profanity", pattern: /\b(?:fuck\w*|shit\w*|bitch\w*|bastard\w*|asshole\w*|damn\w*|crap|piss\w*|wtf)\b/i },
];

const SIGN_OFF =
  /^(?:thanks|thank you|many thanks|with thanks|best|best regards|best wishes|all the best|kind regards|warm regards|warmly|regards|sincerely|yours sincerely|yours truly|cheers|respectfully)\b/i;

function normalizeSpaces(text: string): string {
  return text.replace(/[  ]/g, " ");
}

/** Case-, whitespace- and trailing-period-insensitive form used for gap matching. */
function forMatch(text: string): string {
  return normalizeSpaces(text).replace(/\s+/g, " ").trim().toLowerCase().replace(/\.$/, "");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsVendor(body: string, vendorName: string): boolean {
  const vendor = normalizeCompanyName(vendorName);
  if (vendor.length === 0) return forMatch(body).includes(forMatch(vendorName));
  return ` ${normalizeCompanyName(body)} `.includes(` ${vendor} `);
}

function statesGap(body: string, gap: Gap): boolean {
  const text = forMatch(body);
  if (text.includes(forMatch(gap.message))) return true;
  const required = gap.required ? forMatch(gap.required) : "";
  return required.length > 0 && text.includes(required);
}

function hasSignOff(body: string, signature: string | undefined): boolean {
  if (signature && signature.trim() && body.includes(normalizeSpaces(signature.trim()))) return true;
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  return lines.slice(-4).some((line) => SIGN_OFF.test(line));
}

export function validateChaseDraft(draft: ChaseDraftOutput, ctx: ChaseDraftContext): ChaseValidation {
  const subject = normalizeSpaces(draft.subject).trim();
  const body = normalizeSpaces(draft.body).trim();
  const violations: Violation[] = [];
  const add = (code: ViolationCode, message: string) => violations.push({ code, message });

  if (!mentionsVendor(body, ctx.vendorName)) {
    add("missing_vendor_name", `Body must mention the vendor "${ctx.vendorName}".`);
  }

  if (ctx.kind !== "request_initial") {
    for (const gap of ctx.gaps) {
      if (gap.message.trim().length === 0) continue;
      if (!statesGap(body, gap)) add("missing_gap", `Body must state the gap "${gap.message}"`);
    }
  }

  const fullText = `${subject}\n${body}`;
  const placeholder = PLACEHOLDER_PATTERNS.map((p) => p.exec(fullText)).find((m) => m !== null);
  if (placeholder) add("placeholder", `Unreplaced placeholder "${placeholder[0]}".`);

  if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
    add("subject_length", `Subject must be ${SUBJECT_MIN}-${SUBJECT_MAX} characters (got ${subject.length}).`);
  }
  if (body.length < BODY_MIN || body.length > BODY_MAX) {
    add("body_length", `Body must be ${BODY_MIN}-${BODY_MAX} characters (got ${body.length}).`);
  }

  // Names the org and vendor chose (e.g. "Court Street Builders") are not threats.
  const ownNames = [ctx.vendorName, ctx.signature ?? ""].map((n) => normalizeSpaces(n).trim()).filter((n) => n);
  const scanText = ownNames.reduce(
    (text, name) => text.replace(new RegExp(escapeRegExp(name), "gi"), " | "),
    fullText,
  );
  const banned = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(scanText)).map((b) => b.label);
  if (banned.length > 0) add("banned_phrase", `Contains banned language: ${banned.join(", ")}.`);

  const exclamations = (fullText.match(/!/g) ?? []).length;
  if (exclamations > MAX_EXCLAMATIONS) {
    add("exclamation", `At most ${MAX_EXCLAMATIONS} exclamation mark allowed (got ${exclamations}).`);
  }

  if (!hasSignOff(body, ctx.signature)) {
    add("missing_sign_off", 'Body must end with a sign-off (e.g. "Thanks," or the org signature).');
  }

  const clamped = Number.isFinite(draft.confidence) ? Math.min(1, Math.max(0, draft.confidence)) : 0;
  return {
    ok: violations.length === 0,
    violations,
    adjustedConfidence: violations.length === 0 ? clamped : 0,
  };
}

export type AutonomyDecision = "auto_send" | "needs_approval";

export const AUTO_RENEWAL_MIN_CONFIDENCE = 0.8;

/**
 * Whether a validated draft (pass its adjustedConfidence) may be sent without approval.
 * Only Pro orgs in `auto_renewals` mode auto-send, and only renewal reminders at
 * confidence >= 0.8. Everything else goes to the approval queue.
 * Do-not-contact vendors never reach this point (shouldStopChasing stops them).
 */
export function decideAutonomy(
  org: Pick<Organization, "plan" | "autonomy">,
  kind: ChaseKind,
  confidence: number,
): AutonomyDecision {
  if (org.plan !== "pro" || org.autonomy !== "auto_renewals") return "needs_approval";
  if (kind !== "renewal" || !Number.isFinite(confidence)) return "needs_approval";
  return confidence >= AUTO_RENEWAL_MIN_CONFIDENCE ? "auto_send" : "needs_approval";
}
