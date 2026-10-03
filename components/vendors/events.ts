/**
 * Turns agent_events rows into one-line, human sentences for the vendor
 * timeline. Unknown types fall back to the dotted name, so a new event type
 * never breaks the page.
 */
import { chaseKindLabel, pluralize } from "./format";

export type TimelineEventInput = {
  id: string;
  type: string;
  actor: string;
  entity_type: string | null;
  entity_id: string | null;
  input: unknown;
  output: unknown;
  model: string | null;
  latency_ms: number | null;
  created_at: string;
};

export type TimelineTone = "default" | "good" | "warn" | "bad" | "muted";

export type HumanEvent = {
  title: string;
  detail?: string;
  tone: TimelineTone;
  /** Certificate the event is about, for a link. */
  certificateId?: string;
};

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const STATUS_TONE: Record<string, TimelineTone> = {
  compliant: "good",
  expiring: "warn",
  deficient: "bad",
  expired: "bad",
};

function humanizeField(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

export function humanizeEvent(event: TimelineEventInput): HumanEvent {
  const input = obj(event.input);
  const output = obj(event.output);
  const certificateId = event.entity_type === "certificate" && event.entity_id ? event.entity_id : undefined;

  switch (event.type) {
    case "vendor.created":
      return { title: "Vendor added", detail: str(input.trade), tone: "default" };
    case "vendor.updated": {
      const fields = Array.isArray(input.fields) ? (input.fields as unknown[]).filter((f): f is string => typeof f === "string") : [];
      return {
        title: "Details updated",
        detail: fields.length > 0 ? fields.map(humanizeField).join(", ") : undefined,
        tone: "muted",
      };
    }
    case "certificate.uploaded": {
      const source = str(input.source);
      return {
        title: source === "demo" ? "Demo certificate generated" : source === "email" ? "Certificate received by email" : "Certificate uploaded",
        detail: str(input.fileName),
        tone: "default",
        certificateId,
      };
    }
    case "certificate.extracted": {
      const policies = num(output.policies) ?? 0;
      const low = Array.isArray(output.lowConfidence) ? output.lowConfidence.length : 0;
      return {
        title: `Extracted: ${pluralize(policies, "policy", "policies")}${low > 0 ? `, ${pluralize(low, "low-confidence field")}` : ""}`,
        detail: [event.model, event.latency_ms !== null ? `${(event.latency_ms / 1000).toFixed(1)} s` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
        tone: low > 0 ? "warn" : "default",
        certificateId,
      };
    }
    case "certificate.extraction_failed":
      return { title: "Extraction failed", detail: str(output.message), tone: "bad", certificateId };
    case "certificate.extraction_unavailable":
      return { title: "Extraction unavailable", detail: "No vision model is configured.", tone: "bad", certificateId };
    case "certificate.evaluated": {
      const status = str(output.status) ?? "evaluated";
      const gaps = Array.isArray(output.gaps) ? (output.gaps as unknown[]).filter((g): g is string => typeof g === "string") : [];
      return {
        title: `Evaluated: ${status}${gaps.length > 0 ? ` (${pluralize(gaps.length, "gap")})` : ""}${output.needsReview === true ? ", needs review" : ""}`,
        detail: gaps.length > 0 ? [...new Set(gaps)].join(", ") : undefined,
        tone: STATUS_TONE[status] ?? "default",
        certificateId,
      };
    }
    case "certificate.reviewed":
      return { title: "Review confirmed", detail: "Low-confidence fields confirmed or corrected.", tone: "good", certificateId };
    case "cadence.replanned": {
      const after = str(output.after);
      return {
        title: output.changed === true ? "Chase re-planned" : "Chase checked, unchanged",
        detail: after,
        tone: "muted",
      };
    }
    case "draft.created": {
      const kind = chaseKindLabel(str(input.kind));
      const step = num(input.step);
      const decision = str(output.decision);
      return {
        title: `Chase drafted: ${kind.toLowerCase()}${step ? ` step ${step}` : ""}`,
        detail: decision === "auto_send" ? "Approved automatically (renewal, high confidence)" : "Waiting in the approval queue",
        tone: "default",
      };
    }
    case "draft.unavailable":
      return { title: "Chase draft skipped", detail: "No language model is configured.", tone: "muted" };
    case "touch.approved":
      return { title: "Chase email approved", tone: "default" };
    case "touch.edited":
      return { title: "Chase email edited", tone: "muted" };
    case "touch.rejected":
      return { title: "Chase email rejected", detail: str(input.reason) ?? str(output.reason), tone: "muted" };
    case "touch.snoozed":
      return { title: "Chase email snoozed", tone: "muted" };
    case "touch.cancelled":
      return { title: "Chase email cancelled", detail: str(output.reason), tone: "muted" };
    case "touch.failed":
      return { title: "Chase email failed to send", detail: str(output.message), tone: "bad" };
    case "touch.sent": {
      const to = str(output.intendedRecipient) ?? str(output.deliveredTo);
      const demo = output.demo === true;
      return {
        title: `Chase email sent${output.kind ? ` (${chaseKindLabel(str(output.kind)).toLowerCase()})` : ""}`,
        detail: to ? `To ${to}${demo ? " · demo delivery" : ""}` : undefined,
        tone: "good",
      };
    }
    default:
      return { title: event.type.replace(/[._]/g, " "), tone: "muted", certificateId };
  }
}

export const ACTOR_LABELS: Record<string, string> = {
  agent: "Agent",
  user: "User",
  system: "System",
  cron: "Scheduler",
  webhook: "Webhook",
};
