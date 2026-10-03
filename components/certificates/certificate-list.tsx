import Link from "next/link";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCalendarDate, formatTimestamp, pluralize, relativeDays, SOURCE_LABELS } from "@/components/vendors/format";
import { CertificateStatusChip, NeedsReviewChip, StatusChip } from "@/components/vendors/status-chip";
import type { EvaluationStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export type CertificateListRow = {
  id: string;
  vendorId: string;
  vendorName: string;
  fileName: string;
  status: string;
  source: string;
  evaluationStatus: EvaluationStatus | null;
  gapCount: number;
  earliestExpiration: string | null;
  needsReview: boolean;
  createdAt: string;
};

function Evaluation({ row }: { row: CertificateListRow }) {
  if (!row.evaluationStatus) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusChip status={row.evaluationStatus} />
      {row.gapCount > 0 ? <span className="data text-xs text-muted-foreground">{pluralize(row.gapCount, "gap")}</span> : null}
    </span>
  );
}

export function CertificateList({ rows, today, timeZone }: { rows: CertificateListRow[]; today: string; timeZone: string }) {
  return (
    <>
      {/* Phone: stacked cards. */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/certificates/${row.id}`}
              className={cn(
                "block rounded-xl bg-card p-3.5 shadow-card ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                row.status === "superseded" && "opacity-75",
              )}
            >
              <p className="truncate font-medium">{row.vendorName}</p>
              <p className="data truncate text-xs text-muted-foreground">{row.fileName}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <CertificateStatusChip status={row.status} />
                <Evaluation row={row} />
                {row.needsReview ? <NeedsReviewChip label="Review" /> : null}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {formatTimestamp(row.createdAt, timeZone)}
                {row.earliestExpiration ? (
                  <>
                    {" "}
                    · exp. <span className="data">{formatCalendarDate(row.earliestExpiration)}</span>
                  </>
                ) : null}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: dense table with a sticky header. */}
      <div className="hidden max-h-[calc(100svh-14rem)] min-h-64 overflow-auto rounded-xl bg-card shadow-card ring-1 ring-foreground/10 md:block">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Vendor</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Evaluation</TableHead>
              <TableHead>Earliest expiration</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="pr-4 text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={cn("relative", row.status === "superseded" && "text-muted-foreground")}>
                <TableCell className="max-w-56 pl-4">
                  <Link
                    href={`/certificates/${row.id}`}
                    className="block truncate font-medium text-foreground outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                  >
                    {row.vendorName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{SOURCE_LABELS[row.source] ?? row.source}</span>
                </TableCell>
                <TableCell className="max-w-56">
                  <span className="data block truncate text-xs">{row.fileName}</span>
                  <CertificateStatusChip status={row.status} className="mt-1 text-[0.7rem]" />
                </TableCell>
                <TableCell>
                  <Evaluation row={row} />
                </TableCell>
                <TableCell>
                  {row.earliestExpiration ? (
                    <div className="grid gap-0.5">
                      <span className="data">{formatCalendarDate(row.earliestExpiration)}</span>
                      <span className="text-xs text-muted-foreground">{relativeDays(row.earliestExpiration, today)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="tabular text-xs text-muted-foreground">{formatTimestamp(row.createdAt, timeZone)}</TableCell>
                <TableCell className="pr-4 text-right">{row.needsReview ? <NeedsReviewChip label="Review" /> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </>
  );
}
