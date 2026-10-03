import "server-only";
import { AiUnavailableError } from "@/lib/ai/generate";
import { logAgentEvent, type Actor } from "@/lib/ai/log";
import { extractAcord25 } from "@/lib/ai/prompts/extract-acord25";
import { parseExtraction, parseTemplateRules, toDomainOrganization } from "@/lib/db/mappers";
import type {
  Certificate as CertificateRow,
  Json,
  Organization as OrganizationRow,
  RequirementTemplate as TemplateRow,
  Vendor as VendorRow,
} from "@/lib/db/types";
import { isoDateInZone } from "@/lib/domain/dates";
import { statusForCertificate } from "@/lib/domain/metrics";
import { evaluateCertificate } from "@/lib/domain/rules";
import { ExtractionSchema, type Evaluation, type Extraction, type Policy } from "@/lib/domain/types";
import { ensureChaseCadence } from "@/lib/services/chasing";
import { unwrap, type Client } from "@/lib/services/shared";
import {
  certificateObjectPath,
  downloadCertificateFile,
  isAllowedMimeType,
  MAX_CERTIFICATE_BYTES,
  uploadCertificateFile,
  type AllowedMimeType,
} from "@/lib/services/storage";

export type UploadInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  source?: "upload" | "email" | "demo";
};

export type CertificateBundle = {
  org: OrganizationRow;
  vendor: VendorRow;
  template: TemplateRow;
  certificate: CertificateRow;
};

export async function loadCertificateBundle(client: Client, certificateId: string): Promise<CertificateBundle> {
  const certificate = unwrap(
    await client.from("certificates").select("*").eq("id", certificateId).maybeSingle(),
    "load certificate",
  );
  const vendor = unwrap(
    await client.from("vendors").select("*").eq("id", certificate.vendor_id).maybeSingle(),
    "load vendor",
  );
  const [org, template] = await Promise.all([
    client.from("organizations").select("*").eq("id", certificate.org_id).maybeSingle(),
    client.from("requirement_templates").select("*").eq("id", vendor.template_id).maybeSingle(),
  ]);
  return {
    org: unwrap(org, "load organization"),
    vendor,
    template: unwrap(template, "load template"),
    certificate,
  };
}

/**
 * Stores the file and the certificate row. The row id is generated first
 * because the storage path (checked by the database) must start with
 * `<org_id>/<certificate_id>/`.
 */
export async function createCertificateFromUpload(
  client: Client,
  org: OrganizationRow,
  vendor: VendorRow,
  input: UploadInput,
  actor: { kind: Actor; userId?: string },
): Promise<CertificateRow> {
  if (!isAllowedMimeType(input.mimeType)) throw new Error("Only PDF, PNG and JPEG certificates are accepted.");
  if (input.bytes.byteLength === 0) throw new Error("The uploaded file is empty.");
  if (input.bytes.byteLength > MAX_CERTIFICATE_BYTES) throw new Error("Certificates must be 10 MB or smaller.");

  const id = crypto.randomUUID();
  const path = certificateObjectPath(org.id, id, input.fileName);
  await uploadCertificateFile(client, path, input.bytes, input.mimeType as AllowedMimeType);

  const row = unwrap(
    await client
      .from("certificates")
      .insert({
        id,
        org_id: org.id,
        vendor_id: vendor.id,
        storage_path: path,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.bytes.byteLength,
        source: input.source ?? "upload",
        status: "pending",
      })
      .select()
      .single(),
    "insert certificate",
  );
  await logAgentEvent(client, {
    orgId: org.id,
    actor: actor.kind,
    type: "certificate.uploaded",
    entityType: "certificate",
    entityId: row.id,
    input: { vendorId: vendor.id, fileName: input.fileName, sizeBytes: input.bytes.byteLength, source: row.source },
  });
  return row;
}

export type ExtractOptions = {
  /** Skip the model and use this extraction (demo seed, tests). */
  fixtureExtraction?: Extraction | null;
  actor?: Actor;
};

/**
 * Reads the document with the vision model (or a fixture), evaluates it
 * against the vendor's template, supersedes older certificates and updates
 * the chase cadence. Never lets a model failure leave the row in limbo.
 */
export async function extractAndEvaluate(
  client: Client,
  certificateId: string,
  now = new Date(),
  options: ExtractOptions = {},
): Promise<{ certificate: CertificateRow; evaluation: Evaluation | null }> {
  const bundle = await loadCertificateBundle(client, certificateId);
  const { org, vendor, template, certificate } = bundle;
  const orgD = toDomainOrganization(org);

  let extraction: Extraction;
  let meta: Record<string, unknown> = {};
  if (options.fixtureExtraction) {
    extraction = ExtractionSchema.parse(options.fixtureExtraction);
    meta = { source: "fixture" };
  } else {
    try {
      const bytes = await downloadCertificateFile(client, certificate.storage_path);
      const result = await extractAcord25({
        data: bytes,
        mediaType: certificate.mime_type as AllowedMimeType,
        filename: certificate.file_name,
      });
      extraction = result.extraction;
      meta = { source: "model", ...result.meta };
      await logAgentEvent(client, {
        orgId: org.id,
        actor: options.actor ?? "agent",
        type: "certificate.extracted",
        entityType: "certificate",
        entityId: certificate.id,
        output: { policies: extraction.policies.length, lowConfidence: lowConfidenceKeys(extraction) },
        meta: result.meta,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = unwrap(
        await client
          .from("certificates")
          .update({ status: "failed", extraction_meta: { source: "model", error: message } })
          .eq("id", certificate.id)
          .select()
          .single(),
        "mark certificate failed",
      );
      await logAgentEvent(client, {
        orgId: org.id,
        actor: options.actor ?? "agent",
        type: error instanceof AiUnavailableError ? "certificate.extraction_unavailable" : "certificate.extraction_failed",
        entityType: "certificate",
        entityId: certificate.id,
        output: { message },
      });
      return { certificate: failed, evaluation: null };
    }
  }

  return finishEvaluation(client, bundle, extraction, meta, now, options.actor ?? "agent");
}

/** Re-runs the rules only (expiry roll-over, template edits, after corrections). */
export async function reevaluateCertificate(
  client: Client,
  certificateId: string,
  now = new Date(),
  actor: Actor = "cron",
): Promise<{ certificate: CertificateRow; evaluation: Evaluation | null }> {
  const bundle = await loadCertificateBundle(client, certificateId);
  const extraction = parseExtraction(bundle.certificate);
  if (!extraction) return { certificate: bundle.certificate, evaluation: null };
  const meta = (bundle.certificate.extraction_meta ?? {}) as Record<string, unknown>;
  return finishEvaluation(client, bundle, extraction, meta, now, actor);
}

async function finishEvaluation(
  client: Client,
  bundle: CertificateBundle,
  extraction: Extraction,
  meta: Record<string, unknown>,
  now: Date,
  actor: Actor,
) {
  const { org, vendor, template, certificate } = bundle;
  const orgD = toDomainOrganization(org);
  const today = isoDateInZone(now, orgD.timezone);
  const evaluation = evaluateCertificate(extraction, parseTemplateRules(template), today, {
    holderName: orgD.legalName,
  });

  const updated = unwrap(
    await client
      .from("certificates")
      .update({
        extraction,
        extraction_meta: meta as Json,
        evaluation,
        status: "extracted",
        earliest_expiration: evaluation.earliestExpiration,
        needs_review: evaluation.needsReview && !certificate.reviewed_at,
      })
      .eq("id", certificate.id)
      .select()
      .single(),
    "store evaluation",
  );

  // The newest extracted certificate is the one that counts.
  await client
    .from("certificates")
    .update({ status: "superseded" })
    .eq("vendor_id", vendor.id)
    .neq("id", certificate.id)
    .in("status", ["extracted", "pending", "failed"])
    .lt("created_at", certificate.created_at);

  await logAgentEvent(client, {
    orgId: org.id,
    actor,
    type: "certificate.evaluated",
    entityType: "certificate",
    entityId: certificate.id,
    output: {
      status: evaluation.status,
      gaps: evaluation.gaps.map((g) => g.code),
      earliestExpiration: evaluation.earliestExpiration,
      needsReview: evaluation.needsReview,
    },
  });

  await ensureChaseCadence(client, org, vendor, statusForCertificate(evaluation), evaluation.earliestExpiration, now);
  return { certificate: updated, evaluation };
}

export type ReviewCorrections = {
  certificateHolderName?: string | null;
  noticeOfCancellationDays?: number | null;
  insuredName?: string;
  policies?: Array<{ index: number; patch: Partial<Policy> }>;
};

/** Owner confirms or corrects low-confidence fields; corrected fields become confidence 1. */
export async function applyReview(
  client: Client,
  certificateId: string,
  corrections: ReviewCorrections,
  userId: string,
  now = new Date(),
) {
  const bundle = await loadCertificateBundle(client, certificateId);
  const current = parseExtraction(bundle.certificate);
  if (!current) throw new Error("This certificate has no extraction to review.");

  const next: Extraction = structuredClone(current);
  const confidence = { ...(next.fieldConfidence ?? {}) };
  if (corrections.certificateHolderName !== undefined) {
    next.certificateHolderName = corrections.certificateHolderName;
    confidence.certificateHolderName = 1;
  }
  if (corrections.noticeOfCancellationDays !== undefined) {
    next.noticeOfCancellationDays = corrections.noticeOfCancellationDays;
    confidence.noticeOfCancellationDays = 1;
  }
  if (corrections.insuredName !== undefined) {
    next.insuredName = corrections.insuredName;
    confidence.insuredName = 1;
  }
  for (const { index, patch } of corrections.policies ?? []) {
    const policy = next.policies[index];
    if (!policy) continue;
    Object.assign(policy, patch);
    for (const key of Object.keys(patch)) {
      if (key === "limits" && patch.limits) {
        for (const limitKey of Object.keys(patch.limits)) confidence[`policies.${index}.limits.${limitKey}`] = 1;
      } else {
        confidence[`policies.${index}.${key}`] = 1;
      }
    }
  }
  next.fieldConfidence = confidence;

  await client
    .from("certificates")
    .update({ extraction: ExtractionSchema.parse(next), reviewed_at: now.toISOString(), needs_review: false })
    .eq("id", certificateId);
  await logAgentEvent(client, {
    orgId: bundle.org.id,
    actor: "user",
    type: "certificate.reviewed",
    entityType: "certificate",
    entityId: certificateId,
    input: { userId, corrected: Object.keys(corrections) },
  });
  return reevaluateCertificate(client, certificateId, now, "user");
}

export function lowConfidenceKeys(extraction: Extraction, threshold = 0.7): string[] {
  return Object.entries(extraction.fieldConfidence ?? {})
    .filter(([, v]) => v < threshold)
    .map(([k]) => k);
}
