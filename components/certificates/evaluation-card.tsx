import Link from "next/link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCalendarDate, pluralize, relativeDays } from "@/components/vendors/format";
import { CodeChip, NeedsReviewChip, StatusChip } from "@/components/vendors/status-chip";
import type { Evaluation, Gap } from "@/lib/domain/types";
import { ReevaluateButton } from "./certificate-actions";
import { POLICY_TYPE_SHORT } from "./fields";

const GAP_TONE: Partial<Record<Gap["code"], "saffron" | "oxblood" | "muted">> = {
  policy_expiring: "saffron",
  unreadable_field: "saffron",
};

function GapRow({ gap }: { gap: Gap }) {
  return (
    <li className="grid gap-1.5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <CodeChip tone={GAP_TONE[gap.code] ?? "oxblood"}>{gap.code}</CodeChip>
        {gap.policyType ? (
          <span className="data rounded-sm px-1.5 py-0.5 text-[0.7rem] text-muted-foreground ring-1 ring-foreground/10">
            {POLICY_TYPE_SHORT[gap.policyType]}
          </span>
        ) : null}
      </div>
      <p className="text-sm">{gap.message}</p>
      {gap.required !== undefined || gap.actual !== undefined ? (
        <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
          {gap.required !== undefined ? (
            <>
              <dt className="text-muted-foreground">Required</dt>
              <dd className="data break-words">{gap.required}</dd>
            </>
          ) : null}
          {gap.actual !== undefined ? (
            <>
              <dt className="text-muted-foreground">Actual</dt>
              <dd className="data break-words text-oxblood">{gap.actual}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

export function EvaluationCard({
  certificateId,
  evaluation,
  needsReview,
  templateId,
  templateName,
  today,
  superseded,
}: {
  certificateId: string;
  evaluation: Evaluation;
  needsReview: boolean;
  templateId: string;
  templateName: string;
  today: string;
  superseded: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          Evaluation
          <StatusChip status={evaluation.status} />
          {needsReview ? <NeedsReviewChip /> : null}
        </CardTitle>
        <CardDescription>
          Judged by the rules against{" "}
          <Link href={`/templates/${templateId}`} className="underline underline-offset-3 hover:text-foreground">
            {templateName}
          </Link>
          {evaluation.earliestExpiration ? (
            <>
              . Earliest expiration <span className="data">{formatCalendarDate(evaluation.earliestExpiration)}</span> (
              {relativeDays(evaluation.earliestExpiration, today)})
            </>
          ) : null}
          .{superseded ? " A newer certificate has replaced this one." : null}
        </CardDescription>
        <CardAction>
          <ReevaluateButton certificateId={certificateId} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {evaluation.gaps.length === 0 ? (
          <p className="px-4 text-sm text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]">
            No gaps: every required coverage, limit, endorsement and term is met.
          </p>
        ) : (
          <>
            <p className="px-4 pb-1 text-xs text-muted-foreground">{pluralize(evaluation.gaps.length, "gap")}, in rule order.</p>
            <ul className="divide-y">
              {evaluation.gaps.map((gap, i) => (
                <GapRow key={`${gap.code}-${i}`} gap={gap} />
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
