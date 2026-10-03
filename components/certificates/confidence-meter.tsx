import { cn } from "@/lib/utils";
import { LOW_CONFIDENCE } from "./fields";

/** Thin bar plus the two-decimal value; saffron under the review threshold. */
export function ConfidenceMeter({ value, className }: { value: number | undefined; className?: string }) {
  if (value === undefined) {
    return <span className={cn("data text-[0.7rem] text-muted-foreground", className)}>conf. —</span>;
  }
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const low = value < LOW_CONFIDENCE;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        role="meter"
        aria-label="Extraction confidence"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
        className="relative h-1 w-10 overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn("absolute inset-y-0 left-0", low ? "bg-saffron" : value >= 0.9 ? "bg-verdigris" : "bg-slate")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span
        className={cn(
          "data text-[0.7rem]",
          low ? "font-medium text-[color-mix(in_oklch,var(--saffron),var(--graphite)_50%)]" : "text-muted-foreground",
        )}
      >
        {value.toFixed(2)}
      </span>
    </span>
  );
}
