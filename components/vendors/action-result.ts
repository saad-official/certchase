/** Result shape every vendor, certificate and template Server Action returns to the client. */
export type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Id of the row the action created, when the client needs to follow up (upload → extract). */
  id?: string;
};

export const initialActionResult: ActionResult = { ok: false };

/** Outcome of reading and judging one certificate (upload, retry, re-evaluate, review). */
export type EvaluationActionResult = ActionResult & {
  certificateStatus?: string;
  evaluationStatus?: "compliant" | "deficient" | "expiring" | "expired" | null;
  gapCount?: number;
  needsReview?: boolean;
};
