import { formatLimit } from "@/lib/domain/normalize";
import type { TemplateRules } from "@/lib/domain/types";

/** "$1M" style for compact summaries; falls back to the full figure when not a round million/thousand. */
export function compactLimit(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000 && dollars % 100_000 === 0) return `$${dollars / 1_000_000}M`;
  if (dollars >= 1_000 && dollars % 1_000 === 0) return `$${dollars / 1_000}K`;
  return formatLimit(cents);
}

/** Short tokens describing a rule set, e.g. ["GL $1M/$2M", "Auto $1M", "WC $1M", "AI", "WOS", "30d notice"]. */
export function summarizeRules(rules: TemplateRules): string[] {
  const out: string[] = [];
  if (rules.generalLiability) {
    out.push(`GL ${compactLimit(rules.generalLiability.eachOccurrenceCents)}/${compactLimit(rules.generalLiability.aggregateCents)}`);
  }
  if (rules.autoLiability) out.push(`Auto ${compactLimit(rules.autoLiability.combinedSingleLimitCents)}`);
  if (rules.workersComp) out.push(`WC ${compactLimit(rules.workersComp.eachAccidentCents)}`);
  if (rules.umbrella) out.push(`Umb ${compactLimit(rules.umbrella.eachOccurrenceCents)}`);
  if (rules.additionalInsured) out.push("AI");
  if (rules.waiverOfSubrogation) out.push("WOS");
  if (rules.primaryNonContributory) out.push("P&NC");
  if (rules.noticeOfCancellationDays > 0) out.push(`${rules.noticeOfCancellationDays}d notice`);
  if (rules.certificateHolderMustMatch) out.push("Holder match");
  return out;
}
