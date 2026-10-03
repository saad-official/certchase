import { kindNoun } from "@/components/queue/format";

/**
 * Turns agent_events rows into one-line sentences for the dashboard timeline.
 * Pure (no I/O); unknown event types fall back to a readable version of the
 * dotted type name, so new events show up without a code change.
 */

export type ActivityLike = {
  type: string;
  actor: string;
  input: unknown;
  output: unknown;
  vendorName: string | null;
  touchKind: string | null;
};

type JsonObject = Record<string, unknown>;

function obj(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

const words = (value: string) => value.replace(/[._]+/g, " ").trim();

function sentenceCase(value: string): string {
  const w = words(value);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function percent(confidence: number | null): string | null {
  return confidence === null ? null : `${Math.round(confidence * 100)}%`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function describeEvent(event: ActivityLike): string {
  const input = obj(event.input);
  const output = obj(event.output);
  const vendor = event.vendorName ?? str(input.name) ?? "a vendor";
  const kind = str(input.kind) ?? str(output.kind) ?? event.touchKind;
  const kindText = kind ? `${kindNoun(kind)} email` : "chase email";

  switch (event.type) {
    case "certificate.evaluated": {
      const status = str(output.status) ?? "evaluated";
      const gaps = Array.isArray(output.gaps) ? output.gaps.length : 0;
      const details = [gaps > 0 ? plural(gaps, "gap") : null, output.needsReview ? "needs review" : null].filter(
        Boolean,
      );
      return `Evaluated ${vendor}: ${status}${details.length ? ` (${details.join(", ")})` : ""}`;
    }
    case "certificate.uploaded": {
      const source = str(input.source);
      if (source === "demo") return `Demo certificate generated for ${vendor}`;
      if (source === "email") return `Certificate for ${vendor} received by email`;
      return `Certificate uploaded for ${vendor}`;
    }
    case "certificate.extracted": {
      const policies = num(output.policies);
      const low = Array.isArray(output.lowConfidence) ? output.lowConfidence.length : 0;
      const details = [policies !== null ? plural(policies, "policy", "policies") : null, low ? `${plural(low, "field")} to confirm` : null].filter(Boolean);
      return `Read the certificate for ${vendor}${details.length ? ` (${details.join(", ")})` : ""}`;
    }
    case "certificate.extraction_failed":
      return `Could not read the certificate for ${vendor}`;
    case "certificate.extraction_unavailable":
      return `Certificate for ${vendor} not read: no model provider configured`;
    case "certificate.reviewed":
      return `Reviewed the extracted fields for ${vendor}`;
    case "draft.created": {
      const confidence = percent(num(output.confidence));
      const auto = output.decision === "auto_send" ? "auto-approved" : null;
      const details = [confidence, auto].filter(Boolean);
      return `Drafted ${kindText} for ${vendor}${details.length ? ` (${details.join(", ")})` : ""}`;
    }
    case "draft.unavailable":
      return `Draft skipped for ${vendor}: no model provider configured`;
    case "touch.sent": {
      const where = output.demo ? (output.provider === "outbox" ? " (stored in Outbox)" : " to the demo inbox") : "";
      return `Sent ${kindText} for ${vendor}${where}`;
    }
    case "touch.failed":
      return `Sending the ${kindText} for ${vendor} failed`;
    case "touch.cancelled": {
      const reason = str(output.reason);
      return `Cancelled the ${kindText} for ${vendor}${reason ? ` (${words(reason)})` : ""}`;
    }
    case "touch.approved":
      return `Approved the ${kindText} for ${vendor}`;
    case "touch.edited_and_approved":
      return `Edited and approved the ${kindText} for ${vendor}`;
    case "touch.rejected":
      return `Rejected the ${kindText} for ${vendor}`;
    case "touch.snoozed":
      return `Snoozed the ${kindText} for ${vendor}`;
    case "vendor.created":
      return `Added vendor ${vendor}`;
    case "vendor.updated":
      return `Updated vendor ${vendor}`;
    case "vendor.deleted":
      return event.vendorName ? `Deleted vendor ${event.vendorName}` : "Deleted a vendor";
    case "template.created": {
      const name = str(input.name);
      return name ? `Created requirement template “${name}”` : "Created a requirement template";
    }
    case "template.updated":
      return "Updated a requirement template";
    case "demo.seeded": {
      const vendors = num(output.vendors);
      const certificates = num(output.certificates);
      return vendors !== null && certificates !== null
        ? `Loaded demo vendors: ${plural(vendors, "vendor")}, ${plural(certificates, "certificate")}`
        : "Loaded demo vendors";
    }
    case "settings.autonomy_changed":
      return input.to === "auto_renewals"
        ? "Turned on auto-send for renewal reminders"
        : "Switched to manual approval of every chase email";
    case "agent.run": {
      const drafted = num(output.drafted) ?? 0;
      const sent = num(output.sent) ?? 0;
      const reevaluated = num(output.reevaluated) ?? 0;
      return `Agent run: ${drafted} drafted, ${sent} sent, ${reevaluated} re-checked`;
    }
    default:
      return event.vendorName ? `${sentenceCase(event.type)}: ${event.vendorName}` : sentenceCase(event.type);
  }
}

const ACTORS: Record<string, string> = {
  agent: "Agent",
  user: "You",
  system: "System",
  cron: "Scheduler",
  webhook: "Webhook",
};

export function actorLabel(actor: string): string {
  return ACTORS[actor] ?? sentenceCase(actor);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), "minute");
}
