import Link from "next/link";
import { formatCents } from "@/lib/domain/normalize";
import { cn } from "@/lib/utils";

export type DashboardTileData = {
  total: number;
  compliant: number;
  compliantRate: number | null;
  valueAtRiskCents: number;
  expiringWithin30: number;
  deficientOrExpired: number;
  missing: number;
  awaitingApproval: number;
};

type Tone = "default" | "good" | "attention" | "risk";

const TONE_CLASS: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_25%)]",
  attention: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_45%)]",
  risk: "text-oxblood",
};

const BAR_CLASS: Record<Tone, string> = {
  default: "bg-foreground/15",
  good: "bg-verdigris",
  attention: "bg-saffron",
  risk: "bg-oxblood",
};

function Tile({
  label,
  value,
  caption,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-card p-4 shadow-card ring-1 ring-foreground/10", className)}>
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-0.5", BAR_CLASS[tone])} />
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("data mt-2 text-[1.75rem] leading-none font-medium", TONE_CLASS[tone])}>{value}</p>
      {caption ? <p className="mt-2 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

function rate(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function MetricTiles({ data }: { data: DashboardTileData }) {
  const rateTone: Tone = data.compliantRate === null ? "default" : data.compliantRate >= 0.9 ? "good" : data.compliantRate >= 0.6 ? "attention" : "risk";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Tile
        label="Compliant"
        value={rate(data.compliantRate)}
        caption={`${data.compliant} of ${data.total} ${data.total === 1 ? "vendor" : "vendors"}; missing counts against it`}
        tone={rateTone}
      />
      <Tile
        label="Value at risk"
        value={formatCents(data.valueAtRiskCents)}
        caption="Contract value of every vendor that is not compliant"
        tone={data.valueAtRiskCents > 0 ? "risk" : "good"}
      />
      <Tile
        label="Expiring in 30 days"
        value={String(data.expiringWithin30)}
        caption="Earliest required policy ends within 30 days"
        tone={data.expiringWithin30 > 0 ? "attention" : "default"}
      />
      <Tile
        label="Deficient + expired"
        value={String(data.deficientOrExpired)}
        caption="Limits, endorsements or dates below requirements"
        tone={data.deficientOrExpired > 0 ? "risk" : "default"}
      />
      <Tile
        label="Missing certificates"
        value={String(data.missing)}
        caption="No evaluated certificate on file"
        tone={data.missing > 0 ? "attention" : "default"}
      />
      <Link
        href="/queue"
        className="rounded-lg outline-none transition-transform hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Awaiting approval: ${data.awaitingApproval} ${data.awaitingApproval === 1 ? "email" : "emails"}. Open the approval queue.`}
      >
        <Tile
          className="h-full hover:ring-foreground/20"
          label="Awaiting approval"
          value={String(data.awaitingApproval)}
          caption="Chase emails in your queue →"
          tone={data.awaitingApproval > 0 ? "attention" : "default"}
        />
      </Link>
    </div>
  );
}
