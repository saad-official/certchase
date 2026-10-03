import { cn } from "@/lib/utils";
import { MockFrame } from "./mock-frame";

type Tile = { label: string; value: string; detail: string; tone?: string; bar?: number };

const tiles: Tile[] = [
  { label: "Compliant", value: "71%", detail: "17 of 24 vendors", bar: 71 },
  {
    label: "Value at risk",
    value: "$184,500",
    detail: "contract value of the 7 vendors not compliant",
    tone: "text-oxblood",
  },
  { label: "Expiring in 30 days", value: "3", detail: "first on Nov 2, Harbor Mechanical" },
  { label: "Awaiting your approval", value: "2", detail: "1 correction request, 1 renewal reminder" },
];

/** Dashboard header tiles: contract dollars and days, not counts of emails sent. */
export function ExposureMock() {
  return (
    <MockFrame figure="6" caption="Dashboard for a 24-vendor roster. Synthetic data.">
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border shadow-card min-[440px]:grid-cols-2">
        {tiles.map((t) => (
          <li key={t.label} className="flex flex-col bg-card p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">{t.label}</p>
            <p
              className={cn(
                "data mt-3 text-[2.25rem] leading-none font-medium tracking-[-0.03em] sm:text-[2.75rem]",
                t.tone,
              )}
            >
              {t.value}
            </p>
            {t.bar ? (
              <span aria-hidden="true" className="mt-3 flex h-1.5 bg-muted">
                <span className="h-full bg-verdigris" style={{ width: `${t.bar}%` }} />
              </span>
            ) : null}
            <p className="mt-2.5 text-xs leading-snug text-muted-foreground">{t.detail}</p>
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}
