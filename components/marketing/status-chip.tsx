import { cn } from "@/lib/utils";

export type Status = "compliant" | "expiring" | "deficient" | "missing";

/*
 * The chip's border and leading square take the status colour (currentColor
 * via the `status-chip` utility). Verdigris and saffron are too light for
 * small text on bone or white, so the label is set in the same hue mixed
 * toward graphite, which keeps it at 4.5:1 or better without changing tokens.
 */
const tone: Record<Status, { chip: string; label: string; text: string }> = {
  compliant: {
    chip: "text-verdigris bg-verdigris/8",
    label: "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]",
    text: "Compliant",
  },
  expiring: {
    chip: "text-saffron bg-saffron/10",
    label: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)]",
    text: "Expiring",
  },
  deficient: {
    chip: "text-oxblood bg-oxblood/6",
    label: "text-oxblood",
    text: "Deficient",
  },
  missing: {
    chip: "text-muted-foreground bg-muted",
    label: "text-muted-foreground",
    text: "Missing",
  },
};

export function StatusChip({
  status,
  children,
  className,
}: {
  status: Status;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = tone[status];
  return (
    <span className={cn("status-chip whitespace-nowrap", t.chip, className)}>
      <span className={t.label}>{children ?? t.text}</span>
    </span>
  );
}

/** A rule-engine finding code, set as a mono chip in oxblood. */
export function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="status-chip max-w-full bg-oxblood/6 font-mono text-[0.75rem] text-oxblood">
      {children}
    </code>
  );
}
