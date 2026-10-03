import "server-only";
import type { Plan } from "@/lib/db/types";
import type { Client } from "@/lib/services/shared";

export const FREE_VENDOR_LIMIT = 10;

export async function countVendors(client: Client, orgId: string): Promise<number> {
  const { count, error } = await client
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throw new Error(`count vendors: ${error.message}`);
  return count ?? 0;
}

export type VendorCapacity = { plan: Plan; used: number; limit: number | null; remaining: number | null; atLimit: boolean };

export async function getVendorCapacity(client: Client, orgId: string, plan: Plan): Promise<VendorCapacity> {
  const used = await countVendors(client, orgId);
  if (plan === "pro") return { plan, used, limit: null, remaining: null, atLimit: false };
  const remaining = Math.max(0, FREE_VENDOR_LIMIT - used);
  return { plan, used, limit: FREE_VENDOR_LIMIT, remaining, atLimit: remaining === 0 };
}
