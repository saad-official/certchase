/**
 * Row (snake_case, ISO strings, jsonb) → domain model mapping. The pure
 * logic in lib/domain never sees a database row.
 */
import type {
  Certificate as CertificateRow,
  Organization as OrganizationRow,
  OrgVoiceJson,
  RequirementTemplate as TemplateRow,
  Vendor as VendorRow,
} from "@/lib/db/types";
import {
  DEFAULT_TEMPLATE_RULES,
  EvaluationSchema,
  ExtractionSchema,
  TemplateRulesSchema,
  type Evaluation,
  type Extraction,
  type Organization,
  type OrgVoice,
  type TemplateRules,
  type Vendor,
} from "@/lib/domain/types";

export function parseVoice(row: Pick<OrganizationRow, "name" | "voice">): OrgVoice {
  const v = (row.voice ?? {}) as OrgVoiceJson;
  return {
    businessName: v.business_name?.trim() || row.name,
    signature: v.signature?.trim() || `Regards,\n${row.name}`,
    toneNotes: v.tone_notes?.trim() ?? "",
  };
}

export function toDomainOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name?.trim() || row.name,
    timezone: row.timezone || "UTC",
    plan: row.plan,
    autonomy: row.autonomy,
    voice: parseVoice(row),
  };
}

export function toDomainVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    contactEmail: row.contact_email,
    brokerName: row.broker_name,
    brokerEmail: row.broker_email,
    trade: row.trade,
    contractValueCents: row.contract_value_cents,
    templateId: row.template_id,
    doNotContact: row.do_not_contact,
  };
}

/** Rules jsonb → validated TemplateRules; falls back to the defaults if corrupt. */
export function parseTemplateRules(row: Pick<TemplateRow, "rules">): TemplateRules {
  const parsed = TemplateRulesSchema.safeParse(row.rules);
  return parsed.success ? parsed.data : DEFAULT_TEMPLATE_RULES;
}

export function parseExtraction(row: Pick<CertificateRow, "extraction">): Extraction | null {
  if (!row.extraction) return null;
  const parsed = ExtractionSchema.safeParse(row.extraction);
  return parsed.success ? parsed.data : null;
}

export function parseEvaluation(row: Pick<CertificateRow, "evaluation">): Evaluation | null {
  if (!row.evaluation) return null;
  const parsed = EvaluationSchema.safeParse(row.evaluation);
  return parsed.success ? parsed.data : null;
}
