/**
 * Name normalisation for certificate-holder matching, and money/limit formatting
 * and parsing. All amounts are integer cents (USD).
 */

/** Legal-form and filler tokens removed wherever they appear in a name. */
const IGNORED_TOKENS: ReadonlySet<string> = new Set([
  "the",
  "inc",
  "incorporated",
  "llc",
  "llp",
  "pllc",
  "plc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "dba",
]);

/**
 * Lower-cases, strips accents and punctuation, turns "&" into "and", removes
 * legal suffixes / "the" / "dba" and collapses whitespace.
 * Periods and apostrophes are deleted (so "L.L.C." -> "llc", "O'Brien" -> "obrien");
 * other punctuation becomes a space ("Smith-Jones" -> "smith jones").
 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !IGNORED_TOKENS.has(token))
    .join(" ");
}

/**
 * True when the names are equal after normalisation, or when the shorter one
 * (with at least two tokens) appears inside the longer one as a whole-token run.
 * Empty names never match.
 */
export function namesMatch(a: string, b: string): boolean {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (na.length === 0 || nb.length === 0) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.split(" ").length <= nb.split(" ").length ? [na, nb] : [nb, na];
  if (shorter.split(" ").length < 2) return false;
  return ` ${longer} `.includes(` ${shorter} `);
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const USD_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "$1,234.50" */
export function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

/** Insurance limits read as whole dollars: "$1,000,000". Non-whole amounts keep their cents. */
export function formatLimit(cents: number): string {
  return cents % 100 === 0 ? USD_WHOLE.format(cents / 100) : formatCents(cents);
}

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mm: 1e6,
  mil: 1e6,
  million: 1e6,
};

const AMOUNT = /^(\d[\d.,]*)(k|thousand|mm|m|mil|million)?$/;

/** Validates "1,000,000"-style grouping: first group 1-3 digits, the rest exactly 3. */
function validGroups(integerPart: string, separator: string): boolean {
  const groups = integerPart.split(separator);
  return /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
}

/** Converts a number string using either "," or "." as thousands/decimal separators. */
function parseNumber(raw: string, hasSuffix: boolean): number | null {
  if (!/\d$/.test(raw)) return null;
  const dots = (raw.match(/\./g) ?? []).length;
  const commas = (raw.match(/,/g) ?? []).length;

  let thousands: string | null = null;
  let decimal: string | null = null;
  if (dots > 0 && commas > 0) {
    decimal = raw.lastIndexOf(".") > raw.lastIndexOf(",") ? "." : ",";
    thousands = decimal === "." ? "," : ".";
  } else if (dots + commas > 1) {
    thousands = dots > 0 ? "." : ",";
  } else if (dots + commas === 1) {
    const sep = dots > 0 ? "." : ",";
    const fraction = raw.slice(raw.indexOf(sep) + 1);
    const looksGrouped = fraction.length === 3 && (sep === "," || !hasSuffix);
    if (looksGrouped) thousands = sep;
    else decimal = sep;
  }

  let integerPart = raw;
  let fractionPart = "";
  if (decimal) {
    const parts = raw.split(decimal);
    if (parts.length !== 2) return null;
    [integerPart, fractionPart] = parts;
    if (!/^\d+$/.test(fractionPart)) return null;
  }
  if (thousands) {
    if (!validGroups(integerPart, thousands)) return null;
    integerPart = integerPart.split(thousands).join("");
  }
  if (!/^\d+$/.test(integerPart)) return null;
  return Number(fractionPart ? `${integerPart}.${fractionPart}` : integerPart);
}

/**
 * Parses a human-written limit into cents, or null when it is not a plain amount.
 * Accepts "$1,000,000", "1.000.000", "1 000 000", "$1M", "2m", "$2MM", "1.5M",
 * "500k", "1 million", "USD 1,000,000". A number is read as dollars.
 * A single separator followed by exactly three digits is a thousands separator
 * ("2.500" -> $2,500) unless a "." is followed by a suffix ("1.500M" -> $1.5M).
 */
export function parseLimitToCents(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  }
  const compact = input
    .toLowerCase()
    .replace(/usd|\$/g, "")
    .replace(/[\s  ]+/g, "");
  const match = AMOUNT.exec(compact);
  if (!match) return null;
  const suffix = match[2];
  const value = parseNumber(match[1], suffix !== undefined);
  if (value === null) return null;
  const multiplier = suffix ? MULTIPLIERS[suffix] : 1;
  return Math.round(value * multiplier * 100);
}
