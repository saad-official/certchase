import "server-only";
import { parseEvaluation } from "@/lib/db/mappers";
import type { VendorStatus } from "@/lib/domain/types";
import type { Client } from "@/lib/services/shared";

export type NeedsReviewItem = {
  certificateId: string;
  vendorId: string;
  vendorName: string;
  fileName: string;
  status: VendorStatus;
  /** Low-confidence fields the owner should confirm. */
  reviewFields: string[];
  createdAt: string;
};

/**
 * Current (not superseded) extracted certificates whose evaluation is
 * labelled "needs review", newest first. Per-request client: RLS applies.
 */
export async function loadNeedsReview(client: Client, orgId: string, limit = 8): Promise<NeedsReviewItem[]> {
  const { data, error } = await client
    .from("certificates")
    .select("id, vendor_id, file_name, evaluation, created_at")
    .eq("org_id", orgId)
    .eq("status", "extracted")
    .eq("needs_review", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`load needs review: ${error.message}`);
  if (!data || data.length === 0) return [];

  const vendorIds = [...new Set(data.map((c) => c.vendor_id))];
  const vendors = await client.from("vendors").select("id, name").eq("org_id", orgId).in("id", vendorIds);
  if (vendors.error) throw new Error(`load needs review vendors: ${vendors.error.message}`);
  const names = new Map((vendors.data ?? []).map((v) => [v.id, v.name]));

  return data.map((c) => {
    const evaluation = parseEvaluation(c);
    return {
      certificateId: c.id,
      vendorId: c.vendor_id,
      vendorName: names.get(c.vendor_id) ?? "Unknown vendor",
      fileName: c.file_name,
      status: evaluation?.status ?? "missing",
      reviewFields: evaluation?.reviewFields ?? [],
      createdAt: c.created_at,
    };
  });
}
