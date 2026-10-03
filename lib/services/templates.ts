import "server-only";
import { logAgentEvent } from "@/lib/ai/log";
import type { RequirementTemplate as TemplateRow } from "@/lib/db/types";
import { TemplateRulesSchema, type TemplateRules } from "@/lib/domain/types";
import { unwrap, type Client } from "@/lib/services/shared";

export async function listTemplates(client: Client, orgId: string): Promise<TemplateRow[]> {
  const { data, error } = await client
    .from("requirement_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(`list templates: ${error.message}`);
  return data;
}

export async function getDefaultTemplate(client: Client, orgId: string): Promise<TemplateRow> {
  const { data, error } = await client
    .from("requirement_templates")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`default template: ${error.message}`);
  if (data) return data;
  const any = await client.from("requirement_templates").select("*").eq("org_id", orgId).limit(1).maybeSingle();
  if (any.data) return any.data;
  throw new Error("This organisation has no requirement template. Create one under Requirements.");
}

export async function createTemplate(
  client: Client,
  orgId: string,
  input: { name: string; rules: TemplateRules; isDefault?: boolean },
  userId: string,
): Promise<TemplateRow> {
  const rules = TemplateRulesSchema.parse(input.rules);
  if (input.isDefault) await clearDefault(client, orgId);
  const row = unwrap(
    await client
      .from("requirement_templates")
      .insert({ org_id: orgId, name: input.name.trim(), rules, is_default: input.isDefault ?? false })
      .select()
      .single(),
    "create template",
  );
  await logAgentEvent(client, {
    orgId,
    actor: "user",
    type: "template.created",
    entityType: "template",
    entityId: row.id,
    input: { userId, name: row.name },
  });
  return row;
}

export async function updateTemplate(
  client: Client,
  orgId: string,
  templateId: string,
  input: { name?: string; rules?: TemplateRules; isDefault?: boolean },
  userId: string,
): Promise<TemplateRow> {
  const patch: { name?: string; rules?: TemplateRules; is_default?: boolean } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.rules !== undefined) patch.rules = TemplateRulesSchema.parse(input.rules);
  if (input.isDefault) {
    await clearDefault(client, orgId);
    patch.is_default = true;
  }
  const row = unwrap(
    await client
      .from("requirement_templates")
      .update(patch)
      .eq("id", templateId)
      .eq("org_id", orgId)
      .select()
      .single(),
    "update template",
  );
  await logAgentEvent(client, {
    orgId,
    actor: "user",
    type: "template.updated",
    entityType: "template",
    entityId: row.id,
    input: { userId, fields: Object.keys(patch) },
  });
  return row;
}

/** Deleting is only allowed when no vendor uses the template (FK restrict). */
export async function deleteTemplate(client: Client, orgId: string, templateId: string): Promise<void> {
  const inUse = await client
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("template_id", templateId);
  if ((inUse.count ?? 0) > 0) throw new Error("Reassign the vendors using this template before deleting it.");
  const { error } = await client.from("requirement_templates").delete().eq("id", templateId).eq("org_id", orgId);
  if (error) throw new Error(`delete template: ${error.message}`);
}

async function clearDefault(client: Client, orgId: string) {
  const { error } = await client
    .from("requirement_templates")
    .update({ is_default: false })
    .eq("org_id", orgId)
    .eq("is_default", true);
  if (error) throw new Error(`clear default template: ${error.message}`);
}
