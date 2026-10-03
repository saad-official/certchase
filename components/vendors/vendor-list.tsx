import Link from "next/link";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents } from "@/lib/domain/normalize";
import { cn } from "@/lib/utils";
import { describeCadence, daysUntil, formatCalendarDate, relativeDays } from "./format";
import { NeedsReviewChip, StatusChip } from "./status-chip";

export type VendorListRow = {
  id: string;
  name: string;
  trade: string | null;
  status: "missing" | "compliant" | "deficient" | "expiring" | "expired";
  earliestExpiration: string | null;
  contractValueCents: number;
  templateName: string | null;
  cadence: { kind: string | null; step: number | null; status: string | null; nextRunAt: string | null } | null;
  needsReview: boolean;
  latestCertificateId: string | null;
  certificateStatus: string | null;
  doNotContact: boolean;
};

function ExpirationCell({ iso, today }: { iso: string | null; today: string }) {
  if (!iso) return <span className="text-muted-foreground">—</span>;
  const days = daysUntil(iso, today);
  return (
    <div className="grid gap-0.5">
      <span className="data">{formatCalendarDate(iso)}</span>
      <span
        className={cn(
          "text-xs",
          days < 0 ? "text-oxblood" : days <= 30 ? "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_45%)]" : "text-muted-foreground",
        )}
      >
        {relativeDays(iso, today)}
      </span>
    </div>
  );
}

function CadenceCell({ row, timeZone, now }: { row: VendorListRow; timeZone: string; now: Date }) {
  if (row.doNotContact) return <span className="text-sm text-muted-foreground">Do not contact</span>;
  const state = describeCadence(row.cadence, timeZone, now);
  return (
    <span
      className={cn(
        "text-sm",
        state.tone === "muted" && "text-muted-foreground",
        state.tone === "attention" && "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_45%)]",
      )}
    >
      {state.label}
    </span>
  );
}

/** Missing with a newest certificate still being read (or failed) says so instead of a bare "Missing". */
function VendorStatusCell({ row }: { row: VendorListRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusChip status={row.status} />
      {row.status === "missing" && row.certificateStatus === "pending" ? (
        <span className="text-xs text-muted-foreground">reading…</span>
      ) : null}
      {row.status === "missing" && row.certificateStatus === "failed" ? (
        <span className="text-xs text-oxblood">read failed</span>
      ) : null}
    </div>
  );
}

export function VendorList({
  rows,
  today,
  timeZone,
  now,
}: {
  rows: VendorListRow[];
  today: string;
  timeZone: string;
  now: Date;
}) {
  return (
    <>
      {/* Phone: stacked cards. */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/vendors/${row.id}`}
              className="block rounded-xl bg-card p-3.5 shadow-card ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[row.trade, row.templateName].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="data shrink-0 text-sm">{formatCents(row.contractValueCents).replace(/\.00$/, "")}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <VendorStatusCell row={row} />
                {row.needsReview ? <NeedsReviewChip label="Review" /> : null}
                {row.earliestExpiration ? (
                  <span className="text-xs text-muted-foreground">
                    Exp. <span className="data">{formatCalendarDate(row.earliestExpiration)}</span> ·{" "}
                    {relativeDays(row.earliestExpiration, today)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5">
                <CadenceCell row={row} timeZone={timeZone} now={now} />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: dense table with a sticky header. */}
      <div className="hidden max-h-[calc(100svh-15rem)] min-h-64 overflow-auto rounded-xl bg-card shadow-card ring-1 ring-foreground/10 md:block">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-backdrop-filter:bg-muted/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Vendor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Earliest expiration</TableHead>
              <TableHead className="text-right">Contract value</TableHead>
              <TableHead className="hidden lg:table-cell">Requirements</TableHead>
              <TableHead>Chase</TableHead>
              <TableHead className="pr-4">
                <span className="sr-only">Review</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="relative">
                <TableCell className="max-w-64 pl-4">
                  <Link
                    href={`/vendors/${row.id}`}
                    className="block truncate font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">{row.trade ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <VendorStatusCell row={row} />
                </TableCell>
                <TableCell>
                  <ExpirationCell iso={row.earliestExpiration} today={today} />
                </TableCell>
                <TableCell className="data text-right">{formatCents(row.contractValueCents).replace(/\.00$/, "")}</TableCell>
                <TableCell className="hidden max-w-44 truncate text-muted-foreground lg:table-cell">
                  {row.templateName ?? "—"}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <CadenceCell row={row} timeZone={timeZone} now={now} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {row.needsReview ? <NeedsReviewChip label="Review" /> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </>
  );
}
