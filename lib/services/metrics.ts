import "server-only";
import type { AgentEvent, VendorOverview } from "@/lib/db/types";
import { computeMetrics, type ComplianceMetrics, type MetricsVendor } from "@/lib/domain/metrics";
import { VendorStatusSchema, type VendorStatus } from "@/lib/domain/types";
import type { Client } from "@/lib/services/shared";

export type MetricsRow = MetricsVendor & { id: string; name: string; trade: string | null; needsReview: boolean };

export async function loadMetrics(
  client: Client,
  orgId: string,
  today: string,
): Promise<{ metrics: ComplianceMetrics<MetricsRow>; rows: MetricsRow[] }> {
  const { data, error } = await client.from("vendor_overview").select("*").eq("org_id", orgId);
  if (error) throw new Error(`load vendor overview: ${error.message}`);
  const rows = (data as VendorOverview[]).map(toMetricsRow);
  return { metrics: computeMetrics(rows, today), rows };
}

export function toMetricsRow(v: VendorOverview): MetricsRow {
  const parsed = VendorStatusSchema.safeParse(v.vendor_status);
  const status: VendorStatus = parsed.success ? parsed.data : "missing";
  return {
    id: v.id ?? "",
    name: v.name ?? "",
    trade: v.trade ?? null,
    status,
    contractValueCents: v.contract_value_cents ?? 0,
    earliestExpiration: v.earliest_expiration ?? null,
    needsReview: v.needs_review ?? false,
  };
}

export async function loadRecentActivity(client: Client, orgId: string, limit = 15): Promise<AgentEvent[]> {
  const { data, error } = await client
    .from("agent_events")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`load activity: ${error.message}`);
  return data;
}
