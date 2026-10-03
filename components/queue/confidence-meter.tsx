import { cn } from "@/lib/utils";
import { percent } from "./format";

/**
 * Confidence as a thin bar plus a percentage. Cobalt at or above the bulk /
 * auto-send threshold (80%), slate below it.
 */
export function ConfidenceMeter({
  value,
  threshold = 0.8,
  label = "Confidence",
  className,
}: {
  value: number;
  threshold?: number;
  label?: string;
  className?: string;
}) {
  const pct = percent(value);
  const high = value >= threshold;
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <span className="data text-sm font-semibold text-foreground">{pct}%</span>
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%${high ? ", at or above the 80% threshold" : ", below the 80% threshold"}`}
        className="relative mt-1.5 h-1.5 overflow-hidden rounded-sm bg-muted"
      >
        <div
          className={cn("h-full rounded-sm transition-[width]", high ? "bg-cobalt" : "bg-slate/60")}
          style={{ width: `${pct}%` }}
        />
        <div aria-hidden className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${threshold * 100}%` }} />
      </div>
    </div>
  );
}
