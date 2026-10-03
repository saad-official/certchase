import "server-only";
import { AiUnavailableError } from "@/lib/ai/generate";
import { logAgentEvent, type Actor } from "@/lib/ai/log";
import { writeChaseEmail } from "@/lib/ai/prompts/chase-writer";
import { parseEvaluation, parseVoice, toDomainOrganization, toDomainVendor } from "@/lib/db/mappers";
import type {
  Certificate as CertificateRow,
  ChaseCadence as CadenceRow,
  ChaseTouch as TouchRow,
  Organization as OrganizationRow,
  Vendor as VendorRow,
} from "@/lib/db/types";
import { getEmailProvider } from "@/lib/email/provider";
import { renderChaseEmail } from "@/lib/email/templates";
import {
  chaseKindForStatus,
  chaseRecipient,
  nextStep,
  planChase,
  shouldStopChasing,
  type PlannedStep,
} from "@/lib/domain/cadence";
import { isoDateInZone } from "@/lib/domain/dates";
import { decideAutonomy, type AutonomyDecision } from "@/lib/domain/guardrails";
import { statusForCertificate } from "@/lib/domain/metrics";
import type { ChaseKind, Gap, VendorStatus } from "@/lib/domain/types";
import { unwrap, type Client } from "@/lib/services/shared";

/** Latest certificate that counts for a vendor (newest, not superseded). */
export async function latestCertificate(client: Client, vendorId: string): Promise<CertificateRow | null> {
  const { data, error } = await client
    .from("certificates")
    .select("*")
    .eq("vendor_id", vendorId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`latest certificate: ${error.message}`);
  return data;
}

export function vendorStatusFromCertificate(certificate: CertificateRow | null): VendorStatus {
  if (!certificate || certificate.status !== "extracted") return "missing";
  return statusForCertificate(parseEvaluation(certificate));
}

function anchorFor(kind: ChaseKind, cadence: CadenceRow | null, earliestExpiration: string | null, today: string): string {
  if (kind === "renewal" && earliestExpiration) return earliestExpiration;
  // Relative ladders anchor on the day the condition was detected: the
  // cadence's creation when the kind is unchanged, otherwise today.
  if (cadence && cadence.kind === kind) return cadence.created_at.slice(0, 10);
  return today;
}

/**
 * Creates, re-plans or stops the vendor's chase cadence from its status.
 * Kind unchanged → keep step and schedule. Kind changed → restart at step 0.
 */
export async function ensureChaseCadence(
  client: Client,
  org: OrganizationRow,
  vendor: VendorRow,
  status: VendorStatus,
  earliestExpiration: string | null,
  now = new Date(),
): Promise<CadenceRow | null> {
  const orgD = toDomainOrganization(org);
  const vendorD = toDomainVendor(vendor);
  const existing = await client.from("chase_cadences").select("*").eq("vendor_id", vendor.id).maybeSingle();
  if (existing.error) throw new Error(`load cadence: ${existing.error.message}`);
  const cadence = existing.data;

  const stop = shouldStopChasing(status, vendorD);
  const kind = chaseKindForStatus(status);
  if (stop || !kind) {
    if (cadence && cadence.status !== "stopped") {
      await client
        .from("chase_cadences")
        .update({ status: "stopped", next_run_at: null, pause_reason: stop ?? "nothing_to_chase" })
        .eq("id", cadence.id);
    }
    return cadence;
  }

  const today = isoDateInZone(now, orgD.timezone);
  const sameKind = cadence?.kind === kind && cadence.status === "active";
  if (sameKind && cadence) return cadence; // keep its schedule

  const plan = planChase(kind, anchorFor(kind, cadence, earliestExpiration, today), now, { timezone: orgD.timezone });
  const first = nextStep(plan, 0);
  const row = {
    vendor_id: vendor.id,
    org_id: org.id,
    kind,
    step: 0,
    status: first ? ("active" as const) : ("completed" as const),
    next_run_at: first ? first.scheduledAt.toISOString() : null,
    pause_reason: null,
  };
  return unwrap(
    await client.from("chase_cadences").upsert(row, { onConflict: "vendor_id" }).select().single(),
    "upsert cadence",
  );
}

export type ChaseDraftResult =
  | { kind: "created"; touch: TouchRow; decision: AutonomyDecision }
  | { kind: "skipped"; reason: string };

export async function createChaseDraft(
  client: Client,
  org: OrganizationRow,
  vendor: VendorRow,
  cadence: CadenceRow,
  now = new Date(),
  actor: Actor = "cron",
): Promise<ChaseDraftResult> {
  const orgD = toDomainOrganization(org);
  const vendorD = toDomainVendor(vendor);
  const certificate = await latestCertificate(client, vendor.id);
  const evaluation = certificate ? parseEvaluation(certificate) : null;
  const status = vendorStatusFromCertificate(certificate);

  const stop = shouldStopChasing(status, vendorD);
  if (stop) {
    await ensureChaseCadence(client, org, vendor, status, evaluation?.earliestExpiration ?? null, now);
    return { kind: "skipped", reason: `blocked: ${stop}` };
  }
  const kind = chaseKindForStatus(status);
  if (!kind) return { kind: "skipped", reason: "nothing to chase" };
  if (kind !== cadence.kind) {
    await ensureChaseCadence(client, org, vendor, status, evaluation?.earliestExpiration ?? null, now);
    return { kind: "skipped", reason: "cadence kind changed; re-planned" };
  }

  const pending = await client
    .from("chase_touches")
    .select("id")
    .eq("vendor_id", vendor.id)
    .in("status", ["draft", "approved", "snoozed"])
    .limit(1);
  if (pending.error) throw new Error(`pending drafts: ${pending.error.message}`);
  if (pending.data.length > 0) return { kind: "skipped", reason: "a draft is already waiting" };

  const today = isoDateInZone(now, orgD.timezone);
  const plan: PlannedStep[] = planChase(
    kind,
    anchorFor(kind, cadence, evaluation?.earliestExpiration ?? null, today),
    now,
    { timezone: orgD.timezone },
  );
  const next = nextStep(plan, cadence.step);
  if (!next) {
    await client.from("chase_cadences").update({ status: "completed", next_run_at: null }).eq("id", cadence.id);
    return { kind: "skipped", reason: "ladder complete" };
  }

  const [priorRes, rejectedRes] = await Promise.all([
    client.from("chase_touches").select("subject").eq("vendor_id", vendor.id).eq("status", "sent").order("sent_at"),
    client
      .from("chase_touches")
      .select("reject_reason")
      .eq("org_id", org.id)
      .eq("status", "rejected")
      .not("reject_reason", "is", null)
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);
  const gaps: Gap[] = evaluation?.gaps ?? [];

  let written;
  try {
    written = await writeChaseEmail({
      kind,
      businessName: orgD.voice.businessName,
      legalName: orgD.legalName,
      signature: orgD.voice.signature,
      toneNotes: orgD.voice.toneNotes,
      vendorName: vendorD.name,
      recipientName: vendorD.brokerEmail ? vendorD.brokerName : null,
      recipientIsBroker: Boolean(vendorD.brokerEmail),
      trade: vendorD.trade,
      gaps,
      expirationDate: evaluation?.earliestExpiration ?? null,
      step: next.step,
      priorSubjects: (priorRes.data ?? []).map((t) => t.subject),
      rejectionReasons: (rejectedRes.data ?? []).map((r) => r.reject_reason).filter((r): r is string => Boolean(r)),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      await logAgentEvent(client, {
        orgId: org.id,
        actor: "system",
        type: "draft.unavailable",
        entityType: "vendor",
        entityId: vendor.id,
        output: { message: error.message },
      });
      return { kind: "skipped", reason: "no model provider configured" };
    }
    throw error;
  }

  const decision = decideAutonomy(orgD, kind, written.draft.confidence);
  const touch = unwrap(
    await client
      .from("chase_touches")
      .insert({
        org_id: org.id,
        vendor_id: vendor.id,
        certificate_id: certificate?.id ?? null,
        kind,
        to_email: chaseRecipient(vendorD),
        subject: written.draft.subject,
        body: written.draft.body,
        status: decision === "auto_send" ? "approved" : "draft",
        confidence: written.draft.confidence,
        rationale: written.draft.rationale,
        gaps,
        approved_at: decision === "auto_send" ? now.toISOString() : null,
      })
      .select()
      .single(),
    "insert chase touch",
  );
  await logAgentEvent(client, {
    orgId: org.id,
    actor,
    type: "draft.created",
    entityType: "touch",
    entityId: touch.id,
    input: { vendorId: vendor.id, kind, step: next.step, gapCodes: gaps.map((g) => g.code) },
    output: { decision, confidence: written.draft.confidence, violations: written.validation.violations.map((v) => v.code) },
    meta: written.meta,
  });
  return { kind: "created", touch, decision };
}

export type SendOutcome =
  | { sent: true; touchId: string; deliveredTo: string; demo: boolean }
  | { sent: false; touchId: string; reason: string };

/** Sends an approved touch and advances the cadence. Service client only (outbox is write-protected). */
export async function sendChaseTouch(
  client: Client,
  touchId: string,
  actor: { kind: Actor; userId?: string },
  now = new Date(),
): Promise<SendOutcome> {
  const touch = unwrap(await client.from("chase_touches").select("*").eq("id", touchId).maybeSingle(), "load touch");
  if (!["draft", "approved", "snoozed"].includes(touch.status)) return { sent: false, touchId, reason: `touch is ${touch.status}` };

  const vendor = unwrap(await client.from("vendors").select("*").eq("id", touch.vendor_id).maybeSingle(), "load vendor");
  const org = unwrap(await client.from("organizations").select("*").eq("id", touch.org_id).maybeSingle(), "load org");
  const certificate = await latestCertificate(client, vendor.id);
  const status = vendorStatusFromCertificate(certificate);
  const stop = shouldStopChasing(status, toDomainVendor(vendor));
  if (stop) {
    await client.from("chase_touches").update({ status: "cancelled", reject_reason: `blocked before send: ${stop}` }).eq("id", touch.id);
    await logAgentEvent(client, { orgId: org.id, actor: actor.kind, type: "touch.cancelled", entityType: "touch", entityId: touch.id, output: { reason: stop } });
    return { sent: false, touchId, reason: stop };
  }

  const voice = parseVoice(org);
  const rendered = renderChaseEmail({ subject: touch.subject, body: touch.body, businessName: voice.businessName });
  const provider = getEmailProvider();
  let result;
  try {
    result = await provider.send({ to: touch.to_email, subject: rendered.subject, text: rendered.text, html: rendered.html });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.from("chase_touches").update({ status: "failed", reject_reason: message.slice(0, 500) }).eq("id", touch.id);
    await client.from("outbox").insert({ org_id: org.id, touch_id: touch.id, to_email: touch.to_email, subject: rendered.subject, text: rendered.text, html: rendered.html, provider: provider.name, status: "failed" });
    await logAgentEvent(client, { orgId: org.id, actor: actor.kind, type: "touch.failed", entityType: "touch", entityId: touch.id, output: { message } });
    return { sent: false, touchId, reason: message };
  }

  await client.from("outbox").insert({
    org_id: org.id,
    touch_id: touch.id,
    to_email: result.deliveredTo,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    provider: result.provider,
    status: result.provider === "outbox" ? "queued" : "sent",
  });
  await client
    .from("chase_touches")
    .update({
      status: "sent",
      sent_at: now.toISOString(),
      provider_message_id: result.providerMessageId,
      approved_at: touch.approved_at ?? now.toISOString(),
      approved_by: touch.approved_by ?? actor.userId ?? null,
      snoozed_until: null,
    })
    .eq("id", touch.id);

  // Advance the cadence one step and schedule the next one.
  const cadenceRes = await client.from("chase_cadences").select("*").eq("vendor_id", vendor.id).maybeSingle();
  const cadence = cadenceRes.data;
  if (cadence && cadence.kind === touch.kind) {
    const orgD = toDomainOrganization(org);
    const today = isoDateInZone(now, orgD.timezone);
    const evaluation = certificate ? parseEvaluation(certificate) : null;
    const plan = planChase(touch.kind, anchorFor(touch.kind, cadence, evaluation?.earliestExpiration ?? null, today), now, {
      timezone: orgD.timezone,
    });
    const lastStep = Math.min(3, cadence.step + 1);
    const following = nextStep(plan, lastStep);
    await client
      .from("chase_cadences")
      .update(
        following
          ? { step: lastStep, status: "active", next_run_at: following.scheduledAt.toISOString() }
          : { step: lastStep, status: "completed", next_run_at: null },
      )
      .eq("id", cadence.id);
  }

  await logAgentEvent(client, {
    orgId: org.id,
    actor: actor.kind,
    type: "touch.sent",
    entityType: "touch",
    entityId: touch.id,
    output: { provider: result.provider, deliveredTo: result.deliveredTo, intendedRecipient: touch.to_email, demo: result.demo, kind: touch.kind },
  });
  return { sent: true, touchId, deliveredTo: result.deliveredTo, demo: result.demo };
}
