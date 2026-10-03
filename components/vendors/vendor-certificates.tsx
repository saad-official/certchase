import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCalendarDate, formatTimestamp, pluralize, relativeDays, SOURCE_LABELS } from "./format";
import { CertificateStatusChip, NeedsReviewChip, StatusChip } from "./status-chip";

export type VendorCertificateRow = {
  id: string;
  fileName: string;
  status: string;
  source: string;
  evaluationStatus: "missing" | "compliant" | "deficient" | "expiring" | "expired" | null;
  gapCount: number;
  earliestExpiration: string | null;
  needsReview: boolean;
  createdAt: string;
};

/** The vendor's certificates, newest first; the first non-superseded one is the one that counts. */
export function VendorCertificates({
  certificates,
  today,
  timeZone,
}: {
  certificates: VendorCertificateRow[];
  today: string;
  timeZone: string;
}) {
  const currentId = certificates.find((c) => c.status !== "superseded")?.id;
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Certificates</CardTitle>
        <CardDescription>{pluralize(certificates.length, "certificate")} on file, newest first.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {certificates.length === 0 ? (
          <p className="px-4 py-2 text-sm text-muted-foreground">No certificate yet. Upload one, or let the chase request it.</p>
        ) : (
          <ul className="divide-y">
            {certificates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/certificates/${c.id}`}
                  className={cn(
                    "grid gap-1.5 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                    c.status === "superseded" && "opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="data truncate text-sm">
                      {c.fileName}
                      {c.id === currentId ? (
                        <span className="ml-2 font-sans text-[0.7rem] font-medium tracking-wide text-cobalt uppercase">current</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[c.source] ?? c.source} ·{" "}
                      <time dateTime={c.createdAt} className="tabular">
                        {formatTimestamp(c.createdAt, timeZone)}
                      </time>
                      {c.earliestExpiration ? (
                        <>
                          {" "}
                          · exp. <span className="data">{formatCalendarDate(c.earliestExpiration)}</span> (
                          {relativeDays(c.earliestExpiration, today)})
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    {c.status === "extracted" && c.evaluationStatus ? (
                      <StatusChip status={c.evaluationStatus} />
                    ) : (
                      <CertificateStatusChip status={c.status} />
                    )}
                    {c.status === "superseded" && c.evaluationStatus ? <StatusChip status={c.evaluationStatus} /> : null}
                    {c.gapCount > 0 ? <span className="data text-xs text-muted-foreground">{pluralize(c.gapCount, "gap")}</span> : null}
                    {c.needsReview && c.status === "extracted" ? <NeedsReviewChip label="Review" /> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
