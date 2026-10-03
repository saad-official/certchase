import "server-only";
import { parseVendorStatus, todayInZone, type CadenceStateInput } from "@/components/vendors/format";
import type {
  AgentEvent,
  Certificate,
  ChaseCadence,
  ChaseTouch,
  Organization,
  Vendor,
  VendorOverview,
} from "@/lib/db/types";
import { DEMO_VENDORS } from "@/lib/demo/fixtures";
import { parseEvaluation } from "@/lib/db/mappers";
import type { VendorStatus } from "@/lib/domain/types";
import { getVendorCapacity, type VendorCapacity } from "@/lib/services/plan-limits";
import { listTemplates } from "@/lib/services/templates";
import { getVendor, listVendorOverview } from "@/lib/services/vendors";
import { createClient } from "@/lib/supabase/server";

export const STATUS_FILTERS = ["all", "compliant", "expiring", "deficient", "expired", "missing", "review"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  compliant: "Compliant",
  expiring: "Expiring",
  deficient: "Deficient",
  expired: "Expired",
  missing: "Missing",
  review: "Needs review",
};

export type TemplateOption = { id: string; name: string; isDefault: boolean };

export type VendorRowView = {
  id: string;
  name: string;
  trade: string | null;
  status: VendorStatus;
  earliestExpiration: string | null;
  contractValueCents: number;
  templateName: string | null;
  cadence: CadenceStateInput | null;
  needsReview: boolean;
  latestCertificateId: string | null;
  /** pending / failed newest certificate explains a "missing" status. */
  certificateStatus: string | null;
  doNotContact: boolean;
};

export function matchesFilter(row: VendorRowView, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "review") return row.needsReview;
  return row.status === filter;
}

function toRowView(row: VendorOverview): VendorRowView | null {
  if (!row.id || !row.name) return null;
  return {
    id: row.id,
    name: row.name,
    trade: row.trade,
    status: parseVendorStatus(row.vendor_status),
    earliestExpiration: row.earliest_expiration,
    contractValueCents: row.contract_value_cents ?? 0,
    templateName: row.template_name,
    cadence: row.cadence_id
      ? { kind: row.cadence_kind, step: row.cadence_step, status: row.cadence_status, nextRunAt: row.next_run_at }
      : null,
    needsReview: Boolean(row.needs_review) && row.certificate_status === "extracted",
    latestCertificateId: row.latest_certificate_id,
    certificateStatus: row.certificate_status,
    doNotContact: Boolean(row.do_not_contact),
  };
}

const DEMO_EMAILS = new Set(DEMO_VENDORS.map((d) => d.vendor.contactEmail.toLowerCase()));

export type VendorListData = {
  rows: VendorRowView[];
  capacity: VendorCapacity;
  hasDemoVendors: boolean;
  templates: TemplateOption[];
  now: Date;
  today: string;
};

export async function loadVendorList(org: Organization): Promise<VendorListData> {
  const supabase = await createClient();
  const now = new Date();
  const [overview, capacity, templates] = await Promise.all([
    listVendorOverview(supabase, org.id),
    getVendorCapacity(supabase, org.id, org.plan),
    listTemplates(supabase, org.id),
  ]);
  return {
    rows: overview.map(toRowView).filter((r): r is VendorRowView => r !== null),
    capacity,
    hasDemoVendors: overview.some((row) => DEMO_EMAILS.has((row.contact_email ?? "").toLowerCase())),
    templates: templates.map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default })),
    now,
    today: todayInZone(now, org.timezone),
  };
}

export type VendorCertificateView = {
  id: string;
  fileName: string;
  status: string;
  source: string;
  evaluationStatus: VendorStatus | null;
  gapCount: number;
  earliestExpiration: string | null;
  needsReview: boolean;
  createdAt: string;
};

export type VendorDetailData = {
  vendor: Vendor;
  overview: VendorRowView | null;
  templates: TemplateOption[];
  certificates: VendorCertificateView[];
  cadence: ChaseCadence | null;
  pendingDraft: Pick<ChaseTouch, "id" | "subject" | "kind" | "status" | "to_email" | "confidence" | "created_at" | "snoozed_until"> | null;
  events: AgentEvent[];
  now: Date;
  today: string;
};

function toCertificateView(row: Certificate): VendorCertificateView {
  const evaluation = parseEvaluation(row);
  return {
    id: row.id,
    fileName: row.file_name,
    status: row.status,
    source: row.source,
    evaluationStatus: evaluation?.status ?? null,
    gapCount: evaluation?.gaps.length ?? 0,
    earliestExpiration: row.earliest_expiration,
    needsReview: row.needs_review,
    createdAt: row.created_at,
  };
}

const TIMELINE_LIMIT = 60;

/** Everything the vendor detail page shows, read through the per-request client and scoped to the org. */
export async function loadVendorDetail(org: Organization, vendorId: string): Promise<VendorDetailData | null> {
  const supabase = await createClient();
  const vendor = await getVendor(supabase, org.id, vendorId);
  if (!vendor) return null;

  const [overviewRes, templates, certificatesRes, cadenceRes, draftRes, touchesRes] = await Promise.all([
    supabase.from("vendor_overview").select("*").eq("org_id", org.id).eq("id", vendorId).maybeSingle(),
    listTemplates(supabase, org.id),
    supabase
      .from("certificates")
      .select("*")
      .eq("org_id", org.id)
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false }),
    supabase.from("chase_cadences").select("*").eq("org_id", org.id).eq("vendor_id", vendorId).maybeSingle(),
    supabase
      .from("chase_touches")
      .select("id, subject, kind, status, to_email, confidence, created_at, snoozed_until")
      .eq("org_id", org.id)
      .eq("vendor_id", vendorId)
      .in("status", ["draft", "snoozed", "approved"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("chase_touches").select("id").eq("org_id", org.id).eq("vendor_id", vendorId),
  ]);
  for (const res of [overviewRes, certificatesRes, cadenceRes, draftRes, touchesRes]) {
    if (res.error) throw new Error(`load vendor detail: ${res.error.message}`);
  }

  const certificates = certificatesRes.data ?? [];
  // The timeline merges events about the vendor, its certificates and its chase emails.
  const entityIds = [vendor.id, ...certificates.map((c) => c.id), ...(touchesRes.data ?? []).map((t) => t.id)];
  const eventsRes = await supabase
    .from("agent_events")
    .select("*")
    .eq("org_id", org.id)
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(TIMELINE_LIMIT);
  if (eventsRes.error) throw new Error(`load vendor timeline: ${eventsRes.error.message}`);

  const now = new Date();
  return {
    vendor,
    overview: overviewRes.data ? toRowView(overviewRes.data) : null,
    templates: templates.map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default })),
    certificates: certificates.map(toCertificateView),
    cadence: cadenceRes.data,
    pendingDraft: draftRes.data,
    events: eventsRes.data ?? [],
    now,
    today: todayInZone(now, org.timezone),
  };
}
