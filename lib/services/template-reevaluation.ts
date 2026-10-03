import "server-only";
import { reevaluateCertificate } from "@/lib/services/certificates";
import type { Client } from "@/lib/services/shared";

export const TEMPLATE_REEVALUATION_CAP = 50;

/**
 * Latest extracted certificate id for each vendor on `templateId` (at most
 * `cap` vendors). Call with the per-request client so RLS scopes the read to
 * the caller's organisation; the ids are then safe to hand to the service client.
 */
export async function latestExtractedCertificateIdsForTemplate(
  client: Client,
  orgId: string,
  templateId: string,
  cap = TEMPLATE_REEVALUATION_CAP,
): Promise<{ certificateIds: string[]; vendorsOnTemplate: number }> {
  const vendors = await client
    .from("vendors")
    .select("id")
    .eq("org_id", orgId)
    .eq("template_id", templateId)
    .order("name", { ascending: true });
  if (vendors.error) throw new Error(`template vendors: ${vendors.error.message}`);
  const vendorIds = vendors.data.map((v) => v.id);
  if (vendorIds.length === 0) return { certificateIds: [], vendorsOnTemplate: 0 };

  const certificates = await client
    .from("certificates")
    .select("id, vendor_id, created_at")
    .eq("org_id", orgId)
    .in("vendor_id", vendorIds)
    .eq("status", "extracted")
    .order("created_at", { ascending: false });
  if (certificates.error) throw new Error(`template certificates: ${certificates.error.message}`);

  const latest = new Map<string, string>();
  for (const row of certificates.data) {
    if (!latest.has(row.vendor_id)) latest.set(row.vendor_id, row.id);
  }
  const certificateIds = vendorIds
    .map((id) => latest.get(id))
    .filter((id): id is string => Boolean(id))
    .slice(0, cap);
  return { certificateIds, vendorsOnTemplate: vendorIds.length };
}

/**
 * Re-runs the rules for each certificate, one at a time (each run may re-plan
 * a chase cadence). Failures are counted, not thrown, so one bad row does not
 * stop the rest.
 */
export async function reevaluateCertificates(
  client: Client,
  certificateIds: readonly string[],
  now = new Date(),
): Promise<{ reevaluated: number; failed: number }> {
  let reevaluated = 0;
  let failed = 0;
  for (const id of certificateIds) {
    try {
      const { evaluation } = await reevaluateCertificate(client, id, now, "user");
      if (evaluation) reevaluated++;
    } catch (error) {
      failed++;
      console.error("reevaluate certificate failed", id, error);
    }
  }
  return { reevaluated, failed };
}
