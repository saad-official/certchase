import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { BulkApproveButton } from "@/components/queue/bulk-approve-button";
import { QueueCard } from "@/components/queue/queue-card";
import { QueueKeyboard } from "@/components/queue/queue-keyboard";
import { RunAgentButton } from "@/components/queue/run-agent-button";
import { Button } from "@/components/ui/button";
import { requireOrgContext } from "@/lib/db/queries";
import type { Organization } from "@/lib/db/types";
import { BULK_APPROVE_LIMIT, BULK_APPROVE_MIN_CONFIDENCE, loadQueue } from "@/lib/services/queue";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Queue" };

function autonomyStatus(org: Pick<Organization, "plan" | "autonomy">): string {
  if (org.plan !== "pro") return "You're on Free, so every draft waits here.";
  if (org.autonomy === "auto_renewals") return "On for your organization.";
  return "Off: every draft waits here.";
}

export default async function QueuePage() {
  const { org } = await requireOrgContext();
  const supabase = await createClient();
  const items = await loadQueue(supabase, org.id);
  const confident = items.filter((item) => item.confidence >= BULK_APPROVE_MIN_CONFIDENCE).length;

  return (
    <>
      <PageHeader
        title="Queue"
        description="Chase emails the agent drafted from the rule engine's findings. Approve, edit, reject with a reason, or snooze."
        actions={
          <>
            <RunAgentButton />
            {items.length > 0 ? <BulkApproveButton count={confident} limit={BULK_APPROVE_LIMIT} /> : null}
          </>
        }
      />

      <p className="-mt-2 mb-6 text-xs text-muted-foreground">
        Renewal reminders auto-send on Pro at ≥ 80% confidence when enabled. {autonomyStatus(org)}{" "}
        <Link href="/settings" className="font-medium text-cobalt underline underline-offset-4 hover:text-cobalt/80">
          Autonomy settings
        </Link>
      </p>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing to approve"
          description="Drafts appear here when a chase step comes due: a first request for a missing certificate, a deficiency notice, or a renewal reminder."
          action={
            <Button asChild variant="outline">
              <Link href="/vendors">View vendors</Link>
            </Button>
          }
        />
      ) : (
        <section aria-label="Drafts awaiting approval" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="tabular font-medium text-foreground">{items.length}</span>{" "}
              {items.length === 1 ? "draft" : "drafts"} waiting, oldest first
            </p>
            <QueueKeyboard />
          </div>
          <ol className="space-y-4">
            {items.map((item) => (
              <li key={item.id}>
                <QueueCard item={item} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
