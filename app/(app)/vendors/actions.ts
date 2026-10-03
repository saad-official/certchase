"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/components/vendors/action-result";
import { describeCadence } from "@/components/vendors/format";
import { logAgentEvent } from "@/lib/ai/log";
import { parseEvaluation } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { clearDemoVendors, seedDemoVendors, type SeedResult } from "@/lib/demo/seed";
import { parseLimitToCents } from "@/lib/domain/normalize";
import { createCertificateFromUpload, reevaluateCertificate } from "@/lib/services/certificates";
import { ensureChaseCadence, latestCertificate, vendorStatusFromCertificate } from "@/lib/services/chasing";
import { FREE_VENDOR_LIMIT, getVendorCapacity } from "@/lib/services/plan-limits";
import type { Client } from "@/lib/services/shared";
import { ALLOWED_MIME_TYPES, MAX_CERTIFICATE_BYTES } from "@/lib/services/storage";
import { createVendor, getVendor, PlanLimitError, updateVendor } from "@/lib/services/vendors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * Vendor Server Actions. Each one calls requireOrgContext() first, then reads
 * and writes through the per-request client scoped to ctx.org.id (RLS enforces
 * the same boundary). The service client is used only for the demo seed and
 * demo removal, which write Storage objects, cadences and many rows at once.
 */

const FREE_LIMIT_ERROR = `The Free plan includes up to ${FREE_VENDOR_LIMIT} vendors. Upgrade to Pro on the Billing page to add more.`;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function firstErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function failure(error: unknown, fallback: string): ActionResult {
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

function revalidateVendorScreens(vendorId?: string) {
  revalidatePath("/vendors");
  revalidatePath("/certificates");
  revalidatePath("/dashboard");
  revalidatePath("/queue");
  revalidatePath("/templates");
  if (vendorId) revalidatePath(`/vendors/${vendorId}`);
}

async function templateBelongsToOrg(client: Client, orgId: string, templateId: string): Promise<boolean> {
  const { data, error } = await client
    .from("requirement_templates")
    .select("id")
    .eq("id", templateId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`check template: ${error.message}`);
  return Boolean(data);
}

// ---------------------------------------------------------------------------
// Add / edit vendor
// ---------------------------------------------------------------------------

const VendorFormSchema = z
  .object({
    name: z
      .string()
      .min(1, { error: "Enter the vendor's name." })
      .max(200, { error: "Keep the name under 200 characters." }),
    contactEmail: z.email({ error: "Enter a valid contact email." }),
    brokerName: z.string().max(200, { error: "Keep the broker name under 200 characters." }),
    brokerEmail: z.union([z.literal(""), z.email({ error: "Enter a valid broker email, or leave it blank." })]),
    trade: z.string().max(120, { error: "Keep the trade under 120 characters." }),
    contractValue: z.string().max(40),
    templateId: z.uuid({ error: "Choose a requirement template." }),
    doNotContact: z.boolean(),
    notes: z.string().max(2000, { error: "Keep notes under 2,000 characters." }).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.contractValue && parseLimitToCents(value.contractValue) === null) {
      ctx.addIssue({ code: "custom", path: ["contractValue"], message: "Enter an amount like 250,000 or $1.2M." });
    }
  });

type VendorForm = z.infer<typeof VendorFormSchema>;

function readVendorForm(formData: FormData, withNotes: boolean) {
  return VendorFormSchema.safeParse({
    name: text(formData, "name"),
    contactEmail: text(formData, "contactEmail"),
    brokerName: text(formData, "brokerName"),
    brokerEmail: text(formData, "brokerEmail"),
    trade: text(formData, "trade"),
    contractValue: text(formData, "contractValue"),
    templateId: text(formData, "templateId"),
    doNotContact: formData.get("doNotContact") === "on",
    notes: withNotes ? text(formData, "notes") : undefined,
  });
}

function toVendorInput(form: VendorForm) {
  return {
    name: form.name,
    contactEmail: form.contactEmail,
    brokerName: form.brokerName || null,
    brokerEmail: form.brokerEmail || null,
    trade: form.trade || null,
    contractValueCents: form.contractValue ? (parseLimitToCents(form.contractValue) ?? 0) : 0,
    doNotContact: form.doNotContact,
  };
}

export async function createVendorAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = readVendorForm(formData, false);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };

  const supabase = await createClient();
  try {
    const capacity = await getVendorCapacity(supabase, ctx.org.id, ctx.org.plan);
    if (capacity.atLimit) return { ok: false, error: FREE_LIMIT_ERROR };
    if (!(await templateBelongsToOrg(supabase, ctx.org.id, parsed.data.templateId))) {
      return { ok: false, fieldErrors: { templateId: "That template no longer exists." } };
    }

    // createVendor re-checks the plan limit, so a race cannot exceed it.
    const vendor = await createVendor(
      supabase,
      ctx.org,
      { ...toVendorInput(parsed.data), templateId: parsed.data.templateId },
      { kind: "user", userId: ctx.user.id },
    );

    // No certificate yet: plan the request ladder (day 0, +7, +14). Not fatal if it fails.
    let planned = false;
    try {
      const cadence = await ensureChaseCadence(supabase, ctx.org, vendor, "missing", null);
      planned = Boolean(cadence && cadence.status === "active");
    } catch (error) {
      console.error("plan request cadence failed", error);
    }

    revalidateVendorScreens(vendor.id);
    return {
      ok: true,
      id: vendor.id,
      message: planned
        ? `${vendor.name} added. A certificate request is planned.`
        : `${vendor.name} added.`,
    };
  } catch (error) {
    if (error instanceof PlanLimitError) return { ok: false, error: FREE_LIMIT_ERROR };
    return failure(error, "Could not add the vendor. Try again.");
  }
}

const VendorIdSchema = z.uuid({ error: "Unknown vendor." });

export async function updateVendorAction(vendorId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = VendorIdSchema.safeParse(vendorId);
  if (!id.success) return { ok: false, error: "Unknown vendor." };
  const parsed = readVendorForm(formData, true);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };

  const supabase = await createClient();
  try {
    const before = await getVendor(supabase, ctx.org.id, id.data);
    if (!before) return { ok: false, error: "Vendor not found." };
    if (!(await templateBelongsToOrg(supabase, ctx.org.id, parsed.data.templateId))) {
      return { ok: false, fieldErrors: { templateId: "That template no longer exists." } };
    }

    const updated = await updateVendor(
      supabase,
      ctx.org.id,
      before.id,
      { ...toVendorInput(parsed.data), templateId: parsed.data.templateId, notes: parsed.data.notes ?? null },
      ctx.user.id,
    );

    const templateChanged = before.template_id !== updated.template_id;
    const contactChanged = before.do_not_contact !== updated.do_not_contact;
    let note = "";
    if (templateChanged || contactChanged) {
      const latest = await latestCertificate(supabase, updated.id);
      if (templateChanged && latest?.status === "extracted") {
        // New requirements: judge the current certificate again (this also re-plans the chase).
        const { evaluation } = await reevaluateCertificate(supabase, latest.id, new Date(), "user");
        if (evaluation) note = ` Re-evaluated against the new template: ${evaluation.status}.`;
      } else {
        const evaluation = latest ? parseEvaluation(latest) : null;
        await ensureChaseCadence(
          supabase,
          ctx.org,
          updated,
          vendorStatusFromCertificate(latest),
          evaluation?.earliestExpiration ?? null,
        );
        if (contactChanged) note = updated.do_not_contact ? " Chasing is paused." : " Chasing re-planned.";
      }
    }

    revalidateVendorScreens(updated.id);
    return { ok: true, message: `Saved ${updated.name}.${note}` };
  } catch (error) {
    return failure(error, "Could not save the vendor. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Demo vendors
// ---------------------------------------------------------------------------

export type SeedActionResult = ActionResult & { seed?: SeedResult };

export async function seedDemoVendorsAction(): Promise<SeedActionResult> {
  const ctx = await requireOrgContext();
  try {
    // Service client: the seeder writes Storage objects, certificates, events and cadences in bulk.
    const service = createServiceClient();
    const seed = await seedDemoVendors(service, ctx.org);
    revalidateVendorScreens();
    if (seed.skipped) return { ok: false, error: "Demo vendors are already loaded.", seed };
    return {
      ok: seed.vendors > 0,
      seed,
      message: `Loaded ${seed.vendors} demo vendors and ${seed.certificates} certificates.`,
      error: seed.vendors === 0 ? "No demo vendors were added." : undefined,
    };
  } catch (error) {
    return failure(error, "Could not load the demo vendors. Try again.");
  }
}

export async function clearDemoVendorsAction(): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  // Deleting vendors and certificate files is owner-only under RLS; enforce it before using the service client.
  if (ctx.role !== "owner") {
    return { ok: false, error: "Only the organization owner can remove demo vendors." };
  }
  try {
    const service = createServiceClient();
    const removed = await clearDemoVendors(service, ctx.org.id);
    revalidateVendorScreens();
    revalidatePath("/outbox");
    return {
      ok: true,
      message:
        removed > 0
          ? `Removed ${removed} demo vendors with their certificates and chase emails.`
          : "There were no demo vendors to remove.",
    };
  } catch (error) {
    return failure(error, "Could not remove the demo vendors. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Certificate upload (step 1: store the file; step 2 is extractCertificateAction)
// ---------------------------------------------------------------------------

const MIME_BY_EXTENSION: Record<string, (typeof ALLOWED_MIME_TYPES)[number]> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const UploadSchema = z.object({
  vendorId: VendorIdSchema,
  file: z
    .file({ error: "Choose a certificate file." })
    .min(1, { error: "The file is empty." })
    .max(MAX_CERTIFICATE_BYTES, { error: "Certificates must be 10 MB or smaller." }),
  mimeType: z.enum(ALLOWED_MIME_TYPES, { error: "Upload a PDF, PNG or JPEG." }),
});

export async function uploadCertificateAction(formData: FormData): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const file = formData.get("file");
  const extension = file instanceof File ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const parsed = UploadSchema.safeParse({
    vendorId: text(formData, "vendorId"),
    file,
    mimeType: file instanceof File ? file.type || MIME_BY_EXTENSION[extension] || "" : "",
  });
  if (!parsed.success) {
    const errors = firstErrors(parsed.error);
    return { ok: false, error: errors.file ?? errors.mimeType ?? errors.vendorId ?? "Choose a certificate file." };
  }

  const supabase = await createClient();
  try {
    const vendor = await getVendor(supabase, ctx.org.id, parsed.data.vendorId);
    if (!vendor) return { ok: false, error: "Vendor not found." };

    const bytes = new Uint8Array(await parsed.data.file.arrayBuffer());
    // Per-request client: Storage RLS lets members write under their own org folder.
    const certificate = await createCertificateFromUpload(
      supabase,
      ctx.org,
      vendor,
      { fileName: parsed.data.file.name || "certificate.pdf", mimeType: parsed.data.mimeType, bytes, source: "upload" },
      { kind: "user", userId: ctx.user.id },
    );
    revalidateVendorScreens(vendor.id);
    return { ok: true, id: certificate.id, message: "Uploaded. Reading the certificate…" };
  } catch (error) {
    if (error instanceof Error && /accepted|empty|10 MB/.test(error.message)) {
      return { ok: false, error: error.message };
    }
    return failure(error, "Could not upload the certificate. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Chase cadence
// ---------------------------------------------------------------------------

export async function replanChaseAction(vendorId: string): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const id = VendorIdSchema.safeParse(vendorId);
  if (!id.success) return { ok: false, error: "Unknown vendor." };

  const supabase = await createClient();
  try {
    const vendor = await getVendor(supabase, ctx.org.id, id.data);
    if (!vendor) return { ok: false, error: "Vendor not found." };

    const readCadence = async () => {
      const { data, error } = await supabase
        .from("chase_cadences")
        .select("*")
        .eq("org_id", ctx.org.id)
        .eq("vendor_id", vendor.id)
        .maybeSingle();
      if (error) throw new Error(`load cadence: ${error.message}`);
      return data;
    };

    const before = await readCadence();
    const latest = await latestCertificate(supabase, vendor.id);
    const status = vendorStatusFromCertificate(latest);
    const evaluation = latest ? parseEvaluation(latest) : null;
    const now = new Date();
    await ensureChaseCadence(supabase, ctx.org, vendor, status, evaluation?.earliestExpiration ?? null, now);
    const after = await readCadence();

    const describe = (c: typeof after) =>
      describeCadence(
        c ? { kind: c.kind, step: c.step, status: c.status, nextRunAt: c.next_run_at, pauseReason: c.pause_reason } : null,
        ctx.org.timezone || "UTC",
        now,
      ).label;
    const unchanged =
      before?.kind === after?.kind &&
      before?.status === after?.status &&
      before?.step === after?.step &&
      before?.next_run_at === after?.next_run_at;

    await logAgentEvent(supabase, {
      orgId: ctx.org.id,
      actor: "user",
      type: "cadence.replanned",
      entityType: "vendor",
      entityId: vendor.id,
      input: { userId: ctx.user.id, status },
      output: { before: before ? describe(before) : null, after: after ? describe(after) : null, changed: !unchanged },
    });

    revalidateVendorScreens(vendor.id);
    return {
      ok: true,
      message: unchanged
        ? `Chase already matches the ${status} status: ${describe(after)}.`
        : `Chase re-planned for ${status}: ${describe(after)}.`,
    };
  } catch (error) {
    return failure(error, "Could not re-plan the chase. Try again.");
  }
}
