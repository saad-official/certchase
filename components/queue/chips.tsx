import { cn } from "@/lib/utils";
import { kindLabel } from "./format";

/*
 * Status chips with a leading square (the `status-chip` utility). Border and
 * square take the status colour; the label is mixed toward graphite where the
 * hue alone is too light for small text (verdigris, saffron).
 */

export type StatusTone = "compliant" | "expiring" | "deficient" | "expired" | "missing" | "review" | "neutral";

const TONES: Record<StatusTone, { chip: string; label: string }> = {
  compliant: {
    chip: "text-verdigris bg-verdigris/8",
    label: "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]",
  },
  expiring: {
    chip: "text-saffron bg-saffron/10",
    label: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)]",
  },
  review: {
    chip: "text-saffron bg-saffron/10",
    label: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)]",
  },
  deficient: { chip: "text-oxblood bg-oxblood/6", label: "text-oxblood" },
  expired: { chip: "text-oxblood bg-oxblood/14", label: "text-oxblood font-semibold" },
  missing: { chip: "text-slate bg-muted", label: "text-muted-foreground" },
  neutral: { chip: "text-cobalt bg-cobalt/6", label: "text-cobalt" },
};

const STATUS_TEXT: Record<string, string> = {
  compliant: "Compliant",
  expiring: "Expiring",
  deficient: "Deficient",
  expired: "Expired",
  missing: "Missing",
};

export function StatusChip({
  tone,
  children,
  className,
  title,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const t = TONES[tone];
  return (
    <span className={cn("status-chip whitespace-nowrap", t.chip, className)} title={title}>
      <span className={t.label}>{children}</span>
    </span>
  );
}

/** Vendor / certificate evaluation status. */
export function EvaluationChip({ status, className }: { status: string; className?: string }) {
  const tone = (status in STATUS_TEXT ? status : "missing") as StatusTone;
  return (
    <StatusChip tone={tone} className={className}>
      {STATUS_TEXT[status] ?? status}
    </StatusChip>
  );
}

const KIND_TONES: Record<string, StatusTone> = {
  request_initial: "neutral",
  deficiency: "deficient",
  renewal: "expiring",
};

/** First request / Deficiency / Renewal. */
export function KindChip({ kind, className }: { kind: string; className?: string }) {
  return (
    <StatusChip tone={KIND_TONES[kind] ?? "neutral"} className={className}>
      {kindLabel(kind)}
    </StatusChip>
  );
}

/** A rule-engine gap code, set in mono. */
export function GapCodeChip({ code }: { code: string }) {
  return (
    <code className="status-chip max-w-full shrink-0 bg-oxblood/6 font-mono text-[0.72rem] text-oxblood">{code}</code>
  );
}
