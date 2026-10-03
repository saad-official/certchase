import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatusCounts = {
  compliant: number;
  expiring: number;
  deficient: number;
  expired: number;
  missing: number;
};

/*
 * One stacked bar, five statuses in the fixed brand colours. Deficient and
 * expired share the oxblood hue (both are "not covered"); expired is the
 * solid one and deficient is lighter, and the legend names both, so colour
 * is never the only cue.
 */
const SEGMENTS: { key: keyof StatusCounts; label: string; fill: string; swatch: string }[] = [
  { key: "compliant", label: "Compliant", fill: "bg-verdigris", swatch: "bg-verdigris" },
  { key: "expiring", label: "Expiring", fill: "bg-saffron", swatch: "bg-saffron" },
  {
    key: "deficient",
    label: "Deficient",
    fill: "bg-[color-mix(in_oklch,var(--oxblood),var(--card)_45%)]",
    swatch: "bg-[color-mix(in_oklch,var(--oxblood),var(--card)_45%)]",
  },
  { key: "expired", label: "Expired", fill: "bg-oxblood", swatch: "bg-oxblood" },
  { key: "missing", label: "Missing", fill: "bg-slate/45", swatch: "bg-slate/45" },
];

function pct(n: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

export function StatusDistribution({ counts }: { counts: StatusCounts }) {
  const total = SEGMENTS.reduce((sum, s) => sum + counts[s.key], 0);
  const titleId = "status-distribution-title";

  return (
    <Card>
      <CardHeader>
        <CardTitle id={titleId} className="text-lg">
          Status board
        </CardTitle>
        <CardDescription>
          Every vendor by the status of its latest evaluated certificate.{" "}
          <span className="data text-foreground">{total}</span> {total === 1 ? "vendor" : "vendors"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <figure aria-labelledby={titleId} className="m-0">
          <div aria-hidden className="flex h-4 w-full gap-0.5 overflow-hidden rounded-sm bg-muted">
            {SEGMENTS.map((s) =>
              counts[s.key] > 0 ? (
                <div
                  key={s.key}
                  className={cn("h-full first:rounded-l-sm last:rounded-r-sm", s.fill)}
                  style={{ flexGrow: counts[s.key], flexBasis: 0, minWidth: "0.375rem" }}
                  title={`${s.label}: ${counts[s.key]} (${pct(counts[s.key], total)})`}
                />
              ) : null,
            )}
          </div>
          <ul aria-hidden className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="flex items-baseline gap-2">
                <span className={cn("size-2.5 shrink-0 translate-y-px rounded-[2px]", s.swatch)} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="data ml-auto font-medium sm:ml-0">{counts[s.key]}</span>
              </li>
            ))}
          </ul>
          <table className="sr-only">
            <caption>Vendors by compliance status</caption>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Vendors</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {SEGMENTS.map((s) => (
                <tr key={s.key}>
                  <th scope="row">{s.label}</th>
                  <td>{counts[s.key]}</td>
                  <td>{pct(counts[s.key], total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </CardContent>
    </Card>
  );
}
