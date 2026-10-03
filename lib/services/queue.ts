import "server-only";
import type { ChaseKindDb, TouchStatus } from "@/lib/db/types";
import { parseEvaluation } from "@/lib/db/mappers";
import { AUTO_RENEWAL_MIN_CONFIDENCE } from "@/lib/domain/guardrails";
import { GapSchema, type Gap, type VendorStatus } from "@/lib/domain/types";
import type { Client } from "@/lib/services/shared";

/** Drafts at or above this confidence are offered for one-click bulk approval (same bar as auto-send). */
export const BULK_APPROVE_MIN_CONFIDENCE = AUTO_RENEWAL_MIN_CONFIDENCE;

/** Upper bound for one bulk approval, so a single click cannot run for minutes. */
export const BULK_APPROVE_LIMIT = 20;

/** Plain, serialisable shape the queue UI renders (safe to pass to Client Components). */
export type QueueItem = {
  id: string;
  status: TouchStatus;
  kind: ChaseKindDb;
  toEmail: string;
  /** True when the email goes to the vendor's broker, false for the vendor contact. */
  toBroker: boolean;
  subject: string;
  body: string;
  confidence: number;
  rationale: string | null;
  /** The rule-engine gaps the email must quote, as stored on the touch. */
  gaps: Gap[];
  createdAt: string;
  vendor: {
    id: string;
    name: string;
    trade: string | null;
    brokerName: string | null;
    brokerEmail: string | null;
    contactEmail: string;
  };
  certificate: {
    id: string;
    /** Evaluation status of the certificate the draft was written from; "missing" when there is none. */
    status: VendorStatus;
    earliestExpiration: string | null;
    needsReview: boolean;
  } | null;
};

/** Parses the touch's `gaps` jsonb, keeping only well-formed entries. */
export function parseGaps(value: unknown): Gap[] {
  if (!Array.isArray(value)) return [];
  const gaps: Gap[] = [];
  for (const entry of value) {
    const parsed = GapSchema.safeParse(entry);
    if (parsed.success) gaps.push(parsed.data);
  }
  return gaps;
}

export function clampConfidence(value: number | string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Touches waiting for a decision, oldest first: status 'draft' (not snoozed
 * into the future) plus 'snoozed' whose snoozed_until has passed. Pass the
 * per-request client so RLS scopes rows; org_id is filtered explicitly too.
 * Vendors and certificates are batch-loaded (one query each).
 */
export async function loadQueue(client: Client, orgId: string, now = new Date(), limit = 100): Promise<QueueItem[]> {
  const nowIso = now.toISOString();
  const { data: touches, error } = await client
    .from("chase_touches")
    .select(
      "id, status, kind, to_email, subject, body, confidence, rationale, gaps, created_at, vendor_id, certificate_id",
    )
    .eq("org_id", orgId)
    .in("status", ["draft", "snoozed"])
    .or(`snoozed_until.is.null,snoozed_until.lte."${nowIso}"`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`load queue: ${error.message}`);
  if (!touches || touches.length === 0) return [];

  const vendorIds = [...new Set(touches.map((t) => t.vendor_id))];
  const certificateIds = [...new Set(touches.map((t) => t.certificate_id).filter((id): id is string => Boolean(id)))];

  const [vendorsRes, certificatesRes] = await Promise.all([
    client
      .from("vendors")
      .select("id, name, trade, broker_name, broker_email, contact_email")
      .eq("org_id", orgId)
      .in("id", vendorIds),
    certificateIds.length > 0
      ? client
          .from("certificates")
          .select("id, status, evaluation, earliest_expiration, needs_review")
          .eq("org_id", orgId)
          .in("id", certificateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (vendorsRes.error) throw new Error(`load queue vendors: ${vendorsRes.error.message}`);
  if (certificatesRes.error) throw new Error(`load queue certificates: ${certificatesRes.error.message}`);

  const vendors = new Map((vendorsRes.data ?? []).map((v) => [v.id, v]));
  const certificates = new Map((certificatesRes.data ?? []).map((c) => [c.id, c]));

  const items: QueueItem[] = [];
  for (const touch of touches) {
    const vendor = vendors.get(touch.vendor_id);
    if (!vendor) continue;
    const certificate = touch.certificate_id ? certificates.get(touch.certificate_id) : undefined;
    const evaluation = certificate && certificate.status === "extracted" ? parseEvaluation(certificate) : null;
    const brokerEmail = vendor.broker_email?.trim() || null;
    items.push({
      id: touch.id,
      status: touch.status,
      kind: touch.kind,
      toEmail: touch.to_email,
      toBroker: Boolean(brokerEmail && brokerEmail.toLowerCase() === touch.to_email.trim().toLowerCase()),
      subject: touch.subject,
      body: touch.body,
      confidence: clampConfidence(touch.confidence),
      rationale: touch.rationale,
      gaps: parseGaps(touch.gaps),
      createdAt: touch.created_at,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        trade: vendor.trade,
        brokerName: vendor.broker_name,
        brokerEmail,
        contactEmail: vendor.contact_email,
      },
      certificate: certificate
        ? {
            id: certificate.id,
            status: evaluation?.status ?? "missing",
            earliestExpiration: certificate.earliest_expiration,
            needsReview: certificate.needs_review,
          }
        : null,
    });
  }
  return items;
}
