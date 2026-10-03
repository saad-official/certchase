import Link from "next/link";
import { EvaluationChip, StatusChip } from "@/components/queue/chips";
import { daysLabel, formatCalendarDate } from "@/components/queue/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/domain/normalize";
import { cn } from "@/lib/utils";

export type ExpiringRow = {
  id: string;
  name: string;
  trade: string | null;
  earliestExpiration: string;
  /** Days from today (org timezone) to the expiration date. */
  days: number;
  contractValueCents: number;
};

export type ReviewRow = {
  certificateId: string;
  vendorName: string;
  fileName: string;
  status: string;
  reviewFields: string[];
};

const linkClass =
  "font-medium underline-offset-4 outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50";

export function ExpiringSoon({ rows }: { rows: ExpiringRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Expiring soon</CardTitle>
        <CardDescription>Earliest required policy ends within 30 days, soonest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing expires in the next 30 days.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th scope="col">Vendor</th>
                <th scope="col">Expires</th>
                <th scope="col">Days left</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <Link href={`/vendors/${row.id}`} className={linkClass}>
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.trade ? <>{row.trade} · </> : null}
                      <span className="data">{formatCents(row.contractValueCents)}</span> contract
                    </p>
                  </th>
                  <td className="data py-2.5 pr-3 text-right whitespace-nowrap text-muted-foreground">
                    {formatCalendarDate(row.earliestExpiration)}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <span
                      className={cn(
                        "data font-medium",
                        row.days <= 7
                          ? "text-oxblood"
                          : "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_45%)]",
                      )}
                    >
                      {row.days}d
                    </span>
                    <span className="sr-only"> ({daysLabel(row.days)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function NeedsReview({ rows }: { rows: ReviewRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Needs review</CardTitle>
        <CardDescription>
          Certificates with fields read under 70% confidence. Confirm them before trusting the verdict.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Every current certificate reads cleanly.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.certificateId} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <Link href={`/certificates/${row.certificateId}`} className={cn(linkClass, "text-sm")}>
                    {row.vendorName}
                  </Link>
                  <p className="data truncate text-xs text-muted-foreground" title={row.fileName}>
                    {row.fileName}
                  </p>
                  {row.reviewFields.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.reviewFields.length} {row.reviewFields.length === 1 ? "field" : "fields"} to confirm
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <EvaluationChip status={row.status} />
                  <StatusChip tone="review">Review</StatusChip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
