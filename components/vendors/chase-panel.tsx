import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { chaseKindLabel, describeCadence, formatTimestamp } from "./format";
import { ReplanChaseButton } from "./replan-chase-button";

export type ChasePanelCadence = {
  kind: string;
  step: number;
  status: string;
  nextRunAt: string | null;
  pauseReason: string | null;
};

export type ChasePanelDraft = {
  id: string;
  subject: string;
  kind: string;
  status: string;
  toEmail: string;
  confidence: number;
  createdAt: string;
};

const LADDER: Record<string, string[]> = {
  request_initial: ["Day 0", "+7 days", "+14 days"],
  deficiency: ["Day 0", "+7 days", "+14 days"],
  renewal: ["30 days before", "14 days before", "7 days before"],
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function ChasePanel({
  vendorId,
  cadence,
  draft,
  doNotContact,
  recipient,
  timeZone,
  now,
}: {
  vendorId: string;
  cadence: ChasePanelCadence | null;
  draft: ChasePanelDraft | null;
  doNotContact: boolean;
  recipient: string;
  timeZone: string;
  now: Date;
}) {
  const state = describeCadence(
    cadence ? { ...cadence, nextRunAt: cadence.nextRunAt } : null,
    timeZone,
    now,
  );
  const ladder = cadence ? LADDER[cadence.kind] ?? [] : [];

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle>Chase</CardTitle>
        <CardDescription>Emails go to the broker when known, after you approve them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="divide-y">
          <Row label="State">
            <span className={cn(state.tone === "muted" && "text-muted-foreground")}>
              {doNotContact ? "Do not contact" : state.label}
            </span>
          </Row>
          {cadence ? (
            <>
              <Row label="Kind">{chaseKindLabel(cadence.kind)}</Row>
              <Row label="Steps">
                <ol className="flex flex-wrap gap-1">
                  {ladder.map((label, i) => {
                    const sent = i < cadence.step;
                    const next = i === cadence.step && cadence.status === "active";
                    return (
                      <li
                        key={label}
                        className={cn(
                          "data rounded-sm border px-1.5 py-0.5 text-[0.7rem]",
                          sent && "border-verdigris/50 text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]",
                          next && "border-cobalt text-cobalt",
                          !sent && !next && "text-muted-foreground",
                        )}
                        title={sent ? "Sent" : next ? "Next" : "Planned"}
                      >
                        {i + 1}. {label}
                      </li>
                    );
                  })}
                </ol>
              </Row>
              <Row label="Next run">
                {cadence.nextRunAt ? (
                  <time dateTime={cadence.nextRunAt} className="data">
                    {formatTimestamp(cadence.nextRunAt, timeZone)}
                  </time>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Row>
              {cadence.pauseReason ? (
                <Row label="Reason">
                  <span className="data text-xs">{cadence.pauseReason}</span>
                </Row>
              ) : null}
            </>
          ) : null}
          <Row label="Recipient">
            <span className="data block truncate text-xs">{recipient}</span>
          </Row>
        </dl>

        {draft ? (
          <div className="grid gap-1.5 rounded-lg border border-saffron/50 bg-saffron/8 p-3">
            <p className="text-xs font-medium tracking-wide text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)] uppercase">
              {draft.status === "approved" ? "Approved, sending soon" : draft.status === "snoozed" ? "Snoozed draft" : "Draft awaiting approval"}
            </p>
            <p className="line-clamp-2 text-sm font-medium">{draft.subject}</p>
            <p className="text-xs text-muted-foreground">
              {chaseKindLabel(draft.kind)} · confidence <span className="data">{draft.confidence.toFixed(2)}</span>
            </p>
            <Button variant="outline" size="sm" asChild className="mt-1 w-fit">
              <Link href="/queue">
                Open the queue
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : null}

        <ReplanChaseButton vendorId={vendorId} />
      </CardContent>
    </Card>
  );
}
