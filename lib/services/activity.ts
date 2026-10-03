import "server-only";
import type { AgentEvent } from "@/lib/db/types";
import { loadRecentActivity } from "@/lib/services/metrics";
import type { Client } from "@/lib/services/shared";

/** An agent_events row plus the vendor it concerns, resolved for display. */
export type ActivityEvent = AgentEvent & {
  vendorName: string | null;
  /** Chase kind of the touch the event refers to, when it refers to one. */
  touchKind: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inputVendorId(event: AgentEvent): string | null {
  const input = event.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const id = (input as Record<string, unknown>).vendorId;
  return typeof id === "string" && UUID.test(id) ? id : null;
}

/**
 * Recent agent_events with vendor names. Vendors are found from the event
 * itself (entity_type 'vendor', or input.vendorId) or through the touch /
 * certificate it points at; every lookup is one batched query through the
 * per-request client, so RLS scopes them all.
 */
export async function loadActivityFeed(client: Client, orgId: string, limit = 15): Promise<ActivityEvent[]> {
  const events = await loadRecentActivity(client, orgId, limit);
  if (events.length === 0) return [];

  const idsOf = (type: string) =>
    [...new Set(events.filter((e) => e.entity_type === type && e.entity_id).map((e) => e.entity_id as string))];
  const touchIds = idsOf("touch");
  const certificateIds = idsOf("certificate");

  const [touchesRes, certificatesRes] = await Promise.all([
    touchIds.length > 0
      ? client.from("chase_touches").select("id, vendor_id, kind").eq("org_id", orgId).in("id", touchIds)
      : Promise.resolve({ data: [], error: null }),
    certificateIds.length > 0
      ? client.from("certificates").select("id, vendor_id").eq("org_id", orgId).in("id", certificateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (touchesRes.error) throw new Error(`load activity touches: ${touchesRes.error.message}`);
  if (certificatesRes.error) throw new Error(`load activity certificates: ${certificatesRes.error.message}`);

  const touches = new Map((touchesRes.data ?? []).map((t) => [t.id, t]));
  const certificateVendors = new Map((certificatesRes.data ?? []).map((c) => [c.id, c.vendor_id]));

  const vendorIdFor = (event: AgentEvent): string | null => {
    const fromInput = inputVendorId(event);
    if (fromInput) return fromInput;
    if (!event.entity_id) return null;
    if (event.entity_type === "vendor") return event.entity_id;
    if (event.entity_type === "touch") return touches.get(event.entity_id)?.vendor_id ?? null;
    if (event.entity_type === "certificate") return certificateVendors.get(event.entity_id) ?? null;
    return null;
  };

  const vendorIds = [...new Set(events.map(vendorIdFor).filter((id): id is string => Boolean(id)))];
  const vendorsRes =
    vendorIds.length > 0
      ? await client.from("vendors").select("id, name").eq("org_id", orgId).in("id", vendorIds)
      : { data: [], error: null };
  if (vendorsRes.error) throw new Error(`load activity vendors: ${vendorsRes.error.message}`);
  const vendorNames = new Map((vendorsRes.data ?? []).map((v) => [v.id, v.name]));

  return events.map((event) => {
    const vendorId = vendorIdFor(event);
    const touch = event.entity_type === "touch" && event.entity_id ? touches.get(event.entity_id) : undefined;
    return {
      ...event,
      vendorName: vendorId ? (vendorNames.get(vendorId) ?? null) : null,
      touchKind: touch?.kind ?? null,
    };
  });
}
