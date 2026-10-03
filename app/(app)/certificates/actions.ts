"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EvaluationActionResult } from "@/components/vendors/action-result";
import { hasVision } from "@/lib/ai/model";
import { parseExtraction } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import type { Certificate } from "@/lib/db/types";
import { parseLimitToCents } from "@/lib/domain/normalize";
import { ExtractionSchema, PolicyTypeSchema, type Evaluation, type Policy, type PolicyLimits } from "@/lib/domain/types";
import {
  applyReview,
  extractAndEvaluate,
  reevaluateCertificate,
  type ReviewCorrections,
} from "@/lib/services/certificates";
import type { Client } from "@/lib/services/shared";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/*
 * Certificate Server Actions. requireOrgContext() first, then an org-scoped
 * ownership check through the per-request client (RLS applies). Only after
 * that check do extraction and review run on the service client, because
 * extraction downloads from Storage and both write cadences.
 */

const CertificateIdSchema = z.uuid({ error: "Unknown certificate." });

type OwnedCertificate = Pick<Certificate, "id" | "vendor_id" | "status" | "extraction" | "extraction_meta">;

async function loadOwnedCertificate(client: Client, orgId: string, certificateId: string): Promise<OwnedCertificate | null> {
  const { data, error } = await client
    .from("certificates")
    .select("id, vendor_id, status, extraction, extraction_meta")
    .eq("id", certificateId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`load certificate: ${error.message}`);
  return data;
}

function revalidateCertificateScreens(certificateId: string, vendorId: string) {
  revalidatePath("/certificates");
  revalidatePath(`/certificates/${certificateId}`);
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/dashboard");
  revalidatePath("/queue");
}

function summarize(certificate: Pick<Certificate, "status">, evaluation: Evaluation | null): EvaluationActionResult {
  return {
    ok: true,
    certificateStatus: certificate.status,
    evaluationStatus: evaluation?.status ?? null,
    gapCount: evaluation?.gaps.length ?? 0,
    needsReview: evaluation?.needsReview ?? false,
  };
}

function verdict(evaluation: Evaluation | null): string {
  if (!evaluation) return "no verdict";
  const gaps = evaluation.gaps.length;
  return `${evaluation.status}${gaps > 0 ? ` (${gaps} ${gaps === 1 ? "gap" : "gaps"})` : ""}`;
}

function failure(error: unknown, fallback: string): EvaluationActionResult {
  console.error(fallback, error);
  return { ok: false, error: fallback };
}

// ---------------------------------------------------------------------------
// Extraction (after upload, or retry after a failure)
// ---------------------------------------------------------------------------

export async function extractCertificateAction(certificateId: string): Promise<EvaluationActionResult> {
  const ctx = await requireOrgContext();
  const id = CertificateIdSchema.safeParse(certificateId);
  if (!id.success) return { ok: false, error: "Unknown certificate." };

  const supabase = await createClient();
  try {
    const owned = await loadOwnedCertificate(supabase, ctx.org.id, id.data);
    if (!owned) return { ok: false, error: "Certificate not found." };
    if (owned.status === "superseded") {
      return { ok: false, error: "A newer certificate replaced this one; upload again to re-read it." };
    }

    // Demo certificates carry the extraction that produced them; without a
    // vision key, a retry falls back to it so the demo still works.
    const meta = (owned.extraction_meta ?? {}) as Record<string, unknown>;
    const fixture = ExtractionSchema.safeParse(meta.fixture);
    const useFixture = !hasVision() && fixture.success;

    const service = createServiceClient();
    const { certificate, evaluation } = await extractAndEvaluate(service, owned.id, new Date(), {
      fixtureExtraction: useFixture ? fixture.data : null,
    });
    revalidateCertificateScreens(owned.id, owned.vendor_id);

    if (certificate.status === "failed") {
      const failedMeta = (certificate.extraction_meta ?? {}) as Record<string, unknown>;
      return {
        ok: false,
        certificateStatus: "failed",
        error: `Extraction failed: ${typeof failedMeta.error === "string" ? failedMeta.error : "the model could not read the document"}.`,
      };
    }
    return {
      ...summarize(certificate, evaluation),
      message: `Read and evaluated: ${verdict(evaluation)}${evaluation?.needsReview ? ", needs review" : ""}.`,
    };
  } catch (error) {
    return failure(error, "Could not read the certificate. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Re-evaluate (rules only)
// ---------------------------------------------------------------------------

export async function reevaluateCertificateAction(certificateId: string): Promise<EvaluationActionResult> {
  const ctx = await requireOrgContext();
  const id = CertificateIdSchema.safeParse(certificateId);
  if (!id.success) return { ok: false, error: "Unknown certificate." };

  const supabase = await createClient();
  try {
    const owned = await loadOwnedCertificate(supabase, ctx.org.id, id.data);
    if (!owned) return { ok: false, error: "Certificate not found." };
    if (!owned.extraction) return { ok: false, error: "This certificate has no extraction to evaluate yet." };

    // Rules only, within RLS: certificate, event and cadence writes are all member-permitted.
    const { certificate, evaluation } = await reevaluateCertificate(supabase, owned.id, new Date(), "user");
    revalidateCertificateScreens(owned.id, owned.vendor_id);
    if (!evaluation) return { ok: false, error: "The stored extraction could not be read; retry the extraction." };
    return { ...summarize(certificate, evaluation), message: `Re-evaluated: ${verdict(evaluation)}.` };
  } catch (error) {
    return failure(error, "Could not re-evaluate the certificate. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Review: confirm or correct low-confidence fields
// ---------------------------------------------------------------------------

const LIMIT_FIELDS = ["eachOccurrenceCents", "aggregateCents", "combinedSingleLimitCents", "eachAccidentCents"] as const;
const Tri = z.enum(["yes", "no", "blank"]);
const OptionalDate = z.union([z.literal(""), z.iso.date({ error: "Use a date like 2026-10-21." })]);

const PolicyPatchInputSchema = z.object({
  index: z.int().nonnegative().max(50),
  type: PolicyTypeSchema.optional(),
  insurer: z.string().trim().max(200).optional(),
  policyNumber: z.string().trim().max(100).optional(),
  effectiveDate: OptionalDate.optional(),
  expirationDate: OptionalDate.optional(),
  limits: z.partialRecord(z.enum(LIMIT_FIELDS), z.string().trim().max(40)).optional(),
  additionalInsured: Tri.optional(),
  waiverOfSubrogation: Tri.optional(),
  primaryNonContributory: Tri.optional(),
});

const ReviewInputSchema = z.object({
  insuredName: z.string().trim().min(1, { error: "Enter the insured's name." }).max(200).optional(),
  certificateHolderName: z.string().trim().max(200).optional(),
  noticeOfCancellationDays: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, { error: "Enter a whole number of days, or leave it blank." })
    .optional(),
  policies: z.array(PolicyPatchInputSchema).max(50).default([]),
});

export type ReviewInput = z.input<typeof ReviewInputSchema>;

function triToBoolean(value: z.infer<typeof Tri>): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null;
}

export async function confirmReviewAction(certificateId: string, input: ReviewInput): Promise<EvaluationActionResult> {
  const ctx = await requireOrgContext();
  const id = CertificateIdSchema.safeParse(certificateId);
  if (!id.success) return { ok: false, error: "Unknown certificate." };
  const parsed = ReviewInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Some corrections need fixing.", fieldErrors };
  }

  const supabase = await createClient();
  try {
    const owned = await loadOwnedCertificate(supabase, ctx.org.id, id.data);
    if (!owned) return { ok: false, error: "Certificate not found." };
    const current = owned.status === "extracted" ? parseExtraction(owned) : null;
    if (!current) return { ok: false, error: "This certificate has no extraction to review." };

    const corrections: ReviewCorrections = {};
    const fieldErrors: Record<string, string> = {};
    const data = parsed.data;
    if (data.insuredName !== undefined) corrections.insuredName = data.insuredName;
    if (data.certificateHolderName !== undefined) corrections.certificateHolderName = data.certificateHolderName || null;
    if (data.noticeOfCancellationDays !== undefined) {
      corrections.noticeOfCancellationDays =
        data.noticeOfCancellationDays === "" ? null : Number.parseInt(data.noticeOfCancellationDays, 10);
    }

    const policies: NonNullable<ReviewCorrections["policies"]> = [];
    for (const p of data.policies) {
      const existing = current.policies[p.index];
      if (!existing) continue;
      const patch: Partial<Policy> = {};
      if (p.type !== undefined) patch.type = p.type;
      if (p.insurer !== undefined) patch.insurer = p.insurer || null;
      if (p.policyNumber !== undefined) patch.policyNumber = p.policyNumber || null;
      if (p.effectiveDate !== undefined) patch.effectiveDate = p.effectiveDate || null;
      if (p.expirationDate !== undefined) patch.expirationDate = p.expirationDate || null;
      if (p.additionalInsured !== undefined) patch.additionalInsured = triToBoolean(p.additionalInsured);
      if (p.waiverOfSubrogation !== undefined) patch.waiverOfSubrogation = triToBoolean(p.waiverOfSubrogation);
      if (p.primaryNonContributory !== undefined) patch.primaryNonContributory = triToBoolean(p.primaryNonContributory);
      if (p.limits && Object.keys(p.limits).length > 0) {
        // applyReview assigns `limits` wholesale, so merge with the stored limits
        // to keep the ones the reviewer did not touch.
        const limits: PolicyLimits = { ...existing.limits };
        for (const [field, raw] of Object.entries(p.limits) as Array<[keyof PolicyLimits, string]>) {
          if (raw === "") {
            limits[field] = null;
            continue;
          }
          const cents = parseLimitToCents(raw);
          if (cents === null) fieldErrors[`policies.${p.index}.limits.${field}`] = "Enter an amount like 1,000,000 or $1M.";
          else limits[field] = cents;
        }
        patch.limits = limits;
      }
      if (Object.keys(patch).length > 0) policies.push({ index: p.index, patch });
    }
    if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Some corrections need fixing.", fieldErrors };
    if (policies.length > 0) corrections.policies = policies;

    const service = createServiceClient();
    const { certificate, evaluation } = await applyReview(service, owned.id, corrections, ctx.user.id);
    revalidateCertificateScreens(owned.id, owned.vendor_id);
    return { ...summarize(certificate, evaluation), message: `Review confirmed. Evaluation: ${verdict(evaluation)}.` };
  } catch (error) {
    return failure(error, "Could not save the review. Try again.");
  }
}
