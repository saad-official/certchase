import { cn } from "@/lib/utils";
import type { VendorStatus } from "@/lib/domain/types";
import { CERTIFICATE_STATUS_LABELS, VENDOR_STATUS_LABELS } from "./format";

/*
 * Status chips use the `status-chip` utility: the border and the leading
 * square take the status colour (currentColor). Verdigris and saffron are too
 * light for small text on bone or white, so the label is set in the same hue
 * mixed toward graphite to keep it legible without changing the tokens.
 */
type Tone = "verdigris" | "saffron" | "oxblood" | "muted";

const TONES: Record<Tone, { chip: string; label: string }> = {
  verdigris: {
    chip: "text-verdigris bg-verdigris/8",
    label: "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]",
  },
  saffron: {
    chip: "text-saffron bg-saffron/10",
    label: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)]",
  },
  oxblood: { chip: "text-oxblood bg-oxblood/6", label: "text-oxblood" },
  muted: { chip: "text-muted-foreground bg-muted", label: "text-muted-foreground" },
};

const STATUS_TONE: Record<VendorStatus, Tone> = {
  compliant: "verdigris",
  expiring: "saffron",
  deficient: "oxblood",
  expired: "oxblood",
  missing: "muted",
};

function Chip({ tone, children, className, title }: { tone: Tone; children: React.ReactNode; className?: string; title?: string }) {
  const t = TONES[tone];
  return (
    <span className={cn("status-chip whitespace-nowrap", t.chip, className)} title={title}>
      <span className={t.label}>{children}</span>
    </span>
  );
}

export function StatusChip({
  status,
  children,
  className,
}: {
  status: VendorStatus;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Chip tone={STATUS_TONE[status]} className={className}>
      {children ?? VENDOR_STATUS_LABELS[status]}
    </Chip>
  );
}

export function NeedsReviewChip({ className, label = "Needs review" }: { className?: string; label?: string }) {
  return (
    <Chip tone="saffron" className={className} title="Some extracted fields are low confidence; confirm them before trusting the verdict.">
      {label}
    </Chip>
  );
}

/** Processing state of a certificate file (pending, extracted, failed, superseded). */
export function CertificateStatusChip({ status, className }: { status: string; className?: string }) {
  const tone: Tone = status === "failed" ? "oxblood" : "muted";
  return (
    <Chip tone={tone} className={className}>
      {CERTIFICATE_STATUS_LABELS[status] ?? status}
    </Chip>
  );
}

/** A rule-engine gap code, set in mono. */
export function CodeChip({ children, tone = "oxblood" }: { children: React.ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <code className={cn("status-chip data max-w-full text-[0.72rem]", t.chip)}>
      <span className={t.label}>{children}</span>
    </code>
  );
}
