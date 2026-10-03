import "server-only";
import { logAgentEvent } from "@/lib/ai/log";
import type { Organization as OrganizationRow, Vendor as VendorRow, VendorOverview, VendorUpdate } from "@/lib/db/types";
import { VendorInputSchema, type VendorInput } from "@/lib/domain/types";
import { getVendorCapacity } from "@/lib/services/plan-limits";
import { getDefaultTemplate } from "@/lib/services/templates";
import { unwrap, type Client } from "@/lib/services/shared";

export class PlanLimitError extends Error {
  constructor(limit: number) {
    super(`The Free plan includes up to ${limit} vendors. Upgrade to Pro to add more.`);
    this.name = "PlanLimitError";
  }
}

export async function listVendorOverview(client: Client, orgId: string): Promise<VendorOverview[]> {
  const { data, error } = await client
    .from("vendor_overview")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(`list vendors: ${error.message}`);
  return data;
}

export async function getVendor(client: Client, orgId: string, vendorId: string): Promise<VendorRow | null> {
  const { data, error } = await client.from("vendors").select("*").eq("id", vendorId).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(`load vendor: ${error.message}`);
  return data;
}

export async function createVendor(
  client: Client,
  org: OrganizationRow,
  input: VendorInput & { templateId?: string | null },
  actor: { kind: "user" | "system"; userId?: string },
): Promise<VendorRow> {
  const parsed = VendorInputSchema.parse(input);
  const capacity = await getVendorCapacity(client, org.id, org.plan);
  if (capacity.atLimit && capacity.limit !== null) throw new PlanLimitError(capacity.limit);
  const templateId = input.templateId ?? (await getDefaultTemplate(client, org.id)).id;

  const row = unwrap(
    await client
      .from("vendors")
      .insert({
        org_id: org.id,
        name: parsed.name,
        contact_email: parsed.contactEmail.toLowerCase(),
        broker_name: parsed.brokerName?.trim() || null,
        broker_email: parsed.brokerEmail?.toLowerCase() ?? null,
        trade: parsed.trade?.trim() || null,
        contract_value_cents: parsed.contractValueCents,
        template_id: templateId,
        do_not_contact: parsed.doNotContact,
      })
      .select()
      .single(),
    "create vendor",
  );
  await logAgentEvent(client, {
    orgId: org.id,
    actor: actor.kind,
    type: "vendor.created",
    entityType: "vendor",
    entityId: row.id,
    input: { userId: actor.userId ?? null, name: row.name, trade: row.trade },
  });
  return row;
}

export async function updateVendor(
  client: Client,
  orgId: string,
  vendorId: string,
  input: Partial<VendorInput> & { templateId?: string; notes?: string | null },
  userId: string,
): Promise<VendorRow> {
  const partial = VendorInputSchema.partial().parse(input);
  const patch: VendorUpdate = {};
  if (partial.name !== undefined) patch.name = partial.name;
  if (partial.contactEmail !== undefined) patch.contact_email = partial.contactEmail.toLowerCase();
  if (partial.brokerName !== undefined) patch.broker_name = partial.brokerName?.trim() || null;
  if (partial.brokerEmail !== undefined) patch.broker_email = partial.brokerEmail?.toLowerCase() ?? null;
  if (partial.trade !== undefined) patch.trade = partial.trade?.trim() || null;
  if (partial.contractValueCents !== undefined) patch.contract_value_cents = partial.contractValueCents;
  if (partial.doNotContact !== undefined) patch.do_not_contact = partial.doNotContact;
  if (input.templateId !== undefined) patch.template_id = input.templateId;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const row = unwrap(
    await client.from("vendors").update(patch).eq("id", vendorId).eq("org_id", orgId).select().single(),
    "update vendor",
  );
  await logAgentEvent(client, {
    orgId,
    actor: "user",
    type: "vendor.updated",
    entityType: "vendor",
    entityId: row.id,
    input: { userId, fields: Object.keys(patch) },
  });
  return row;
}

export async function deleteVendor(client: Client, orgId: string, vendorId: string, userId: string): Promise<void> {
  const { error } = await client.from("vendors").delete().eq("id", vendorId).eq("org_id", orgId);
  if (error) throw new Error(`delete vendor: ${error.message}`);
  await logAgentEvent(client, {
    orgId,
    actor: "user",
    type: "vendor.deleted",
    entityType: "vendor",
    entityId: vendorId,
    input: { userId },
  });
}
