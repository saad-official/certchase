import "server-only";
import { logAgentEvent } from "@/lib/ai/log";
import { addDaysToIsoDate, isoDateInZone } from "@/lib/domain/dates";
import { reevaluateCertificate } from "@/lib/services/certificates";
import { createChaseDraft, sendChaseTouch } from "@/lib/services/chasing";
import { unwrap, type Client } from "@/lib/services/shared";

export type TickSummary = {
  reevaluated: number;
  drafted: number;
  skipped: number;
  sent: number;
  errors: string[];
  durationMs: number;
};

const MAX_REEVALUATIONS = 200;
const MAX_DRAFTS = 15; // Groq free tier: 30 requests/minute
const MAX_SENDS = 25;

/**
 * Hourly heartbeat (pg_cron → /api/cron/tick).
 * 1. Re-run the rules on certificates that may have rolled into expiring/expired.
 * 2. Draft the next chase step for due cadences.
 * 3. Send approved touches.
 */
export async function runTick(client: Client, now = new Date(), orgId?: string): Promise<TickSummary> {
  const started = Date.now();
  const summary: TickSummary = { reevaluated: 0, drafted: 0, skipped: 0, sent: 0, errors: [], durationMs: 0 };
  const todayUtc = isoDateInZone(now, "UTC");

  // 1. Expiry roll-over: anything expiring within 31 days (UTC) or already past.
  let certQuery = client
    .from("certificates")
    .select("id, evaluation")
    .eq("status", "extracted")
    .not("earliest_expiration", "is", null)
    .lte("earliest_expiration", addDaysToIsoDate(todayUtc, 31))
    .limit(MAX_REEVALUATIONS);
  if (orgId) certQuery = certQuery.eq("org_id", orgId);
  const certs = await certQuery;
  if (certs.error) summary.errors.push(`load certificates: ${certs.error.message}`);
  for (const cert of certs.data ?? []) {
    const status = (cert.evaluation as { status?: string } | null)?.status;
    if (status === "expired") continue; // terminal until a new certificate arrives
    try {
      await reevaluateCertificate(client, cert.id, now, "cron");
      summary.reevaluated++;
    } catch (error) {
      summary.errors.push(`reevaluate ${cert.id}: ${message(error)}`);
    }
  }

  // 2. Due cadences
  let dueQuery = client
    .from("chase_cadences")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(MAX_DRAFTS * 2);
  if (orgId) dueQuery = dueQuery.eq("org_id", orgId);
  const due = await dueQuery;
  if (due.error) summary.errors.push(`load cadences: ${due.error.message}`);
  for (const cadence of due.data ?? []) {
    if (summary.drafted >= MAX_DRAFTS) break;
    try {
      const vendor = unwrap(await client.from("vendors").select("*").eq("id", cadence.vendor_id).maybeSingle(), "load vendor");
      const org = unwrap(await client.from("organizations").select("*").eq("id", cadence.org_id).maybeSingle(), "load org");
      const result = await createChaseDraft(client, org, vendor, cadence, now, orgId ? "user" : "cron");
      if (result.kind === "created") summary.drafted++;
      else summary.skipped++;
    } catch (error) {
      summary.errors.push(`draft ${cadence.id}: ${message(error)}`);
    }
  }

  // 3. Approved, unsent touches
  let approvedQuery = client
    .from("chase_touches")
    .select("id")
    .eq("status", "approved")
    .is("sent_at", null)
    .order("approved_at", { ascending: true })
    .limit(MAX_SENDS);
  if (orgId) approvedQuery = approvedQuery.eq("org_id", orgId);
  const approved = await approvedQuery;
  if (approved.error) summary.errors.push(`load approved: ${approved.error.message}`);
  for (const touch of approved.data ?? []) {
    try {
      const outcome = await sendChaseTouch(client, touch.id, { kind: orgId ? "user" : "cron" }, now);
      if (outcome.sent) summary.sent++;
      else summary.skipped++;
    } catch (error) {
      summary.errors.push(`send ${touch.id}: ${message(error)}`);
    }
  }

  summary.durationMs = Date.now() - started;
  if (orgId) {
    await logAgentEvent(client, { orgId, actor: "user", type: "agent.run", output: { ...summary } });
  }
  return summary;
}

export function runTickForOrg(client: Client, orgId: string, now = new Date()) {
  return runTick(client, now, orgId);
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
