import "server-only";
import { logAgentEvent } from "@/lib/ai/log";
import { hasVision } from "@/lib/ai/model";
import { toDomainOrganization } from "@/lib/db/mappers";
import type { Organization as OrganizationRow } from "@/lib/db/types";
import { isoDateInZone } from "@/lib/domain/dates";
import type { Extraction } from "@/lib/domain/types";
import { DEMO_VENDORS } from "@/lib/demo/fixtures";
import { renderCertificatePdf } from "@/lib/pdf/acord25";
import { createCertificateFromUpload, extractAndEvaluate } from "@/lib/services/certificates";
import { ensureChaseCadence } from "@/lib/services/chasing";
import { unwrap, type Client } from "@/lib/services/shared";
import { removeCertificateFile } from "@/lib/services/storage";
import { createVendor, PlanLimitError } from "@/lib/services/vendors";

export type SeedResult = {
  skipped: boolean;
  vendors: number;
  certificates: number;
  usedModel: boolean;
  errors: string[];
};

export type SeedOptions = {
  /** Force fixture extractions even when a vision key exists (fast, no quota). */
  useFixtures?: boolean;
};

/**
 * Creates the demo roster: 8 vendors, 7 synthetic certificate PDFs rendered
 * from known extractions, each uploaded, read (by the model when a key is
 * configured, else from the fixture) and evaluated. Requires the service
 * client because it writes Storage objects and cadences across the org.
 */
export async function seedDemoVendors(client: Client, org: OrganizationRow, now = new Date(), options: SeedOptions = {}): Promise<SeedResult> {
  const emails = DEMO_VENDORS.map((d) => d.vendor.contactEmail);
  const existing = await client.from("vendors").select("id").eq("org_id", org.id).in("contact_email", emails).limit(1);
  if ((existing.data ?? []).length > 0) return { skipped: true, vendors: 0, certificates: 0, usedModel: false, errors: [] };

  const orgD = toDomainOrganization(org);
  const today = isoDateInZone(now, orgD.timezone);
  const useModel = !options.useFixtures && hasVision();
  const result: SeedResult = { skipped: false, vendors: 0, certificates: 0, usedModel: useModel, errors: [] };

  for (const demo of DEMO_VENDORS) {
    let vendor;
    try {
      vendor = await createVendor(client, org, { ...demo.vendor }, { kind: "system" });
      result.vendors++;
    } catch (error) {
      if (error instanceof PlanLimitError) {
        result.errors.push("Free plan vendor limit reached; stopped adding demo vendors.");
        break;
      }
      result.errors.push(`${demo.vendor.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (!demo.certificate) {
      await ensureChaseCadence(client, org, vendor, "missing", null, now);
      continue;
    }

    try {
      const doc = demo.certificate(today, orgD.legalName);
      if (demo.lowConfidenceFields) {
        for (const field of demo.lowConfidenceFields) doc.fieldConfidence[field] = 0.55;
      }
      const pdf = await renderCertificatePdf(doc);
      const certificate = await createCertificateFromUpload(
        client,
        org,
        vendor,
        { fileName: `COI-${demo.vendor.name.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`, mimeType: "application/pdf", bytes: pdf, source: "demo" },
        { kind: "system" },
      );
      const fixture: Extraction = stripDocumentOnlyFields(doc);
      // Keep the truth beside the row so the UI can compare model vs fixture.
      await client.from("certificates").update({ extraction_meta: { fixture } }).eq("id", certificate.id);
      await extractAndEvaluate(client, certificate.id, now, {
        fixtureExtraction: useModel ? null : fixture,
        actor: "system",
      });
      if (useModel) {
        const row = unwrap(await client.from("certificates").select("extraction_meta").eq("id", certificate.id).single(), "reload meta");
        const meta = (row.extraction_meta ?? {}) as Record<string, unknown>;
        await client.from("certificates").update({ extraction_meta: { ...meta, fixture } }).eq("id", certificate.id);
      }
      result.certificates++;
    } catch (error) {
      result.errors.push(`${demo.vendor.name} certificate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await logAgentEvent(client, {
    orgId: org.id,
    actor: "system",
    type: "demo.seeded",
    output: { vendors: result.vendors, certificates: result.certificates, usedModel: useModel, errors: result.errors.length },
  });
  return result;
}

/** Removes demo vendors, their certificates and the stored files. */
export async function clearDemoVendors(client: Client, orgId: string): Promise<number> {
  const emails = DEMO_VENDORS.map((d) => d.vendor.contactEmail);
  const vendors = await client.from("vendors").select("id").eq("org_id", orgId).in("contact_email", emails);
  const ids = (vendors.data ?? []).map((v) => v.id);
  if (ids.length === 0) return 0;
  const files = await client.from("certificates").select("storage_path").eq("org_id", orgId).in("vendor_id", ids);
  for (const f of files.data ?? []) {
    try {
      await removeCertificateFile(client, f.storage_path);
    } catch {
      // best effort; the row delete below still succeeds
    }
  }
  const { error } = await client.from("vendors").delete().eq("org_id", orgId).in("id", ids);
  if (error) throw new Error(`clear demo vendors: ${error.message}`);
  return ids.length;
}

function stripDocumentOnlyFields(doc: Extraction & Record<string, unknown>): Extraction {
  const {
    sampleLabel: _sampleLabel,
    insuredAddress: _insuredAddress,
    producerAddress: _producerAddress,
    certificateHolderAddress: _certificateHolderAddress,
    ...extraction
  } = doc;
  return extraction as Extraction;
}
