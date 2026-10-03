/** Results returned by the queue Server Actions. Plain data, safe across the server/client boundary. */

export type ActionError = { ok: false; error: string; details?: string[] };

export type SendFeedback = {
  /** True when the provider accepted the message (or the Outbox stored it). */
  sent: boolean;
  /** Toast headline: "Stored in Outbox", "Delivered to x@y.com (demo)" or "Sent". */
  title: string;
  description?: string;
};

export type ApproveResult = { ok: true; feedback: SendFeedback; warnings?: string[] } | ActionError;

export type SimpleResult = { ok: true; message: string } | ActionError;

export type BulkApproveResult =
  | { ok: true; approved: number; sent: number; notSent: number; failures: string[] }
  | ActionError;

export type RunAgentResult =
  | {
      ok: true;
      reevaluated: number;
      drafted: number;
      sent: number;
      skipped: number;
      errors: string[];
      durationMs: number;
    }
  | ActionError;
