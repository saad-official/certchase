"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/vendors/action-result";
import { parseTemplateRules } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { parseLimitToCents } from "@/lib/domain/normalize";
import { DEFAULT_TEMPLATE_RULES, TemplateRulesSchema, type TemplateRules } from "@/lib/domain/types";
import type { Client } from "@/lib/services/shared";
import {
  latestExtractedCertificateIdsForTemplate,
  reevaluateCertificates,
  TEMPLATE_REEVALUATION_CAP,
} from "@/lib/services/template-reevaluation";
import { createTemplate, deleteTemplate, updateTemplate } from "@/lib/services/templates";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * Requirement template Server Actions. requireOrgContext() first, then every
 * read and write goes through the per-request client scoped to ctx.org.id.
 * The bulk re-evaluation after a rules change runs on the service client,
 * but only for certificate ids read through the per-request client.
 */

const TemplateIdSchema = z.uuid({ error: "Unknown template." });
const NameSchema = z
  .string()
  .trim()
  .min(1, { error: "Name the template." })
  .max(120, { error: "Keep the name under 120 characters." });

function revalidateTemplateScreens(templateId?: string) {
  revalidatePath("/templates");
  if (templateId) revalidatePath(`/templates/${templateId}`);
  revalidatePath("/vendors");
  revalidatePath("/certificates");
  revalidatePath("/dashboard");
}

function failure(error: unknown, fallback: string): ActionResult {
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /duplicate key|unique/i.test(error.message);
}

async function loadOwnedTemplate(client: Client, orgId: string, templateId: string) {
  const { data, error } = await client
    .from("requirement_templates")
    .select("*")
    .eq("id", templateId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`load template: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const CreateSchema = z.object({
  name: NameSchema,
  /** Template to copy rules from; empty = the spec defaults. */
  copyFromId: z.union([z.literal(""), z.uuid()]),
});

export async function createTemplateAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = CreateSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    copyFromId: String(formData.get("copyFromId") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0]?.message ?? "Name the template." } };
  }

  const supabase = await createClient();
  try {
    let rules: TemplateRules = DEFAULT_TEMPLATE_RULES;
    if (parsed.data.copyFromId) {
      const source = await loadOwnedTemplate(supabase, ctx.org.id, parsed.data.copyFromId);
      if (!source) return { ok: false, fieldErrors: { copyFromId: "That template no longer exists." } };
      rules = parseTemplateRules(source);
    }
    const row = await createTemplate(supabase, ctx.org.id, { name: parsed.data.name, rules }, ctx.user.id);
    revalidateTemplateScreens(row.id);
    return { ok: true, id: row.id, message: `Created ${row.name}.` };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, fieldErrors: { name: "A template with this name already exists." } };
    return failure(error, "Could not create the template. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Save rules (then re-evaluate the vendors on this template)
// ---------------------------------------------------------------------------

const LimitInput = z.string().trim().max(40);

/** What the rules editor posts: limits as human-written dollar strings. */
const RulesFormSchema = z.object({
  name: NameSchema,
  generalLiability: z.object({ enabled: z.boolean(), eachOccurrence: LimitInput, aggregate: LimitInput }),
  autoLiability: z.object({ enabled: z.boolean(), combinedSingleLimit: LimitInput }),
  workersComp: z.object({ enabled: z.boolean(), eachAccident: LimitInput }),
  umbrella: z.object({ enabled: z.boolean(), eachOccurrence: LimitInput }),
  additionalInsured: z.boolean(),
  waiverOfSubrogation: z.boolean(),
  primaryNonContributory: z.boolean(),
  noticeOfCancellationDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, { error: "Enter a whole number of days (0 = not required)." }),
  certificateHolderMustMatch: z.boolean(),
});

export type RulesFormInput = z.input<typeof RulesFormSchema>;

export type SaveTemplateResult = ActionResult & { reevaluated?: number; skipped?: number };

export async function saveTemplateAction(templateId: string, input: RulesFormInput): Promise<SaveTemplateResult> {
  const ctx = await requireOrgContext();
  const id = TemplateIdSchema.safeParse(templateId);
  if (!id.success) return { ok: false, error: "Unknown template." };

  const parsed = RulesFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Some rules need fixing.", fieldErrors };
  }
  const form = parsed.data;

  // Dollars → cents. Each enabled coverage needs every limit.
  const fieldErrors: Record<string, string> = {};
  const cents = (path: string, raw: string): number => {
    const value = parseLimitToCents(raw);
    if (value === null || raw === "") {
      fieldErrors[path] = "Enter a limit like 1,000,000 or $1M.";
      return 0;
    }
    return value;
  };
  const candidate = {
    generalLiability: form.generalLiability.enabled
      ? {
          eachOccurrenceCents: cents("generalLiability.eachOccurrence", form.generalLiability.eachOccurrence),
          aggregateCents: cents("generalLiability.aggregate", form.generalLiability.aggregate),
        }
      : null,
    autoLiability: form.autoLiability.enabled
      ? { combinedSingleLimitCents: cents("autoLiability.combinedSingleLimit", form.autoLiability.combinedSingleLimit) }
      : null,
    workersComp: form.workersComp.enabled
      ? { required: true as const, eachAccidentCents: cents("workersComp.eachAccident", form.workersComp.eachAccident) }
      : null,
    umbrella: form.umbrella.enabled
      ? { eachOccurrenceCents: cents("umbrella.eachOccurrence", form.umbrella.eachOccurrence) }
      : null,
    additionalInsured: form.additionalInsured,
    waiverOfSubrogation: form.waiverOfSubrogation,
    primaryNonContributory: form.primaryNonContributory,
    noticeOfCancellationDays: Number.parseInt(form.noticeOfCancellationDays, 10),
    certificateHolderMustMatch: form.certificateHolderMustMatch,
  };
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Some rules need fixing.", fieldErrors };
  const rules = TemplateRulesSchema.safeParse(candidate);
  if (!rules.success) return { ok: false, error: rules.error.issues[0]?.message ?? "Those rules are not valid." };

  const supabase = await createClient();
  try {
    const existing = await loadOwnedTemplate(supabase, ctx.org.id, id.data);
    if (!existing) return { ok: false, error: "Template not found." };
    const row = await updateTemplate(
      supabase,
      ctx.org.id,
      existing.id,
      { name: form.name, rules: rules.data },
      ctx.user.id,
    );

    // New rules: judge each vendor's current certificate again (capped).
    const { certificateIds, vendorsOnTemplate } = await latestExtractedCertificateIdsForTemplate(
      supabase,
      ctx.org.id,
      row.id,
    );
    let reevaluated = 0;
    let failed = 0;
    if (certificateIds.length > 0) {
      const service = createServiceClient();
      ({ reevaluated, failed } = await reevaluateCertificates(service, certificateIds));
    }
    revalidateTemplateScreens(row.id);
    revalidatePath("/queue");

    const parts = [`Saved ${row.name}.`];
    if (vendorsOnTemplate === 0) parts.push("No vendors use it yet.");
    else {
      parts.push(`Re-evaluated ${reevaluated} ${reevaluated === 1 ? "certificate" : "certificates"}.`);
      if (failed > 0) parts.push(`${failed} could not be re-evaluated.`);
      if (certificateIds.length === TEMPLATE_REEVALUATION_CAP) {
        parts.push(`Stopped at ${TEMPLATE_REEVALUATION_CAP}; the hourly job covers the rest.`);
      }
    }
    return { ok: true, message: parts.join(" "), reevaluated, skipped: failed };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, fieldErrors: { name: "A template with this name already exists." } };
    return failure(error, "Could not save the template. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Make default / delete
// ---------------------------------------------------------------------------

export async function makeDefaultTemplateAction(templateId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = TemplateIdSchema.safeParse(templateId);
  if (!id.success) return { ok: false, error: "Unknown template." };

  const supabase = await createClient();
  try {
    const existing = await loadOwnedTemplate(supabase, ctx.org.id, id.data);
    if (!existing) return { ok: false, error: "Template not found." };
    if (existing.is_default) return { ok: true, message: `${existing.name} is already the default.` };
    await updateTemplate(supabase, ctx.org.id, existing.id, { isDefault: true }, ctx.user.id);
    revalidateTemplateScreens(existing.id);
    return { ok: true, message: `${existing.name} is now the default for new vendors.` };
  } catch (error) {
    return failure(error, "Could not change the default template. Try again.");
  }
}

export async function deleteTemplateAction(templateId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  // RLS lets only owners delete templates; say so instead of silently deleting nothing.
  if (ctx.role !== "owner") return { ok: false, error: "Only the organization owner can delete templates." };
  const id = TemplateIdSchema.safeParse(templateId);
  if (!id.success) return { ok: false, error: "Unknown template." };

  const supabase = await createClient();
  try {
    const existing = await loadOwnedTemplate(supabase, ctx.org.id, id.data);
    if (!existing) return { ok: false, error: "Template not found." };
    if (existing.is_default) {
      return { ok: false, error: "This is the default template. Make another template the default first." };
    }
    await deleteTemplate(supabase, ctx.org.id, existing.id);
    revalidateTemplateScreens();
    return { ok: true, message: `Deleted ${existing.name}.` };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Reassign")) return { ok: false, error: error.message };
    return failure(error, "Could not delete the template. Try again.");
  }
}
