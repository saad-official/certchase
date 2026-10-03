import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatLimit,
  namesMatch,
  normalizeCompanyName,
  parseLimitToCents,
} from "@/lib/domain/normalize";

describe("normalizeCompanyName", () => {
  it.each([
    ["Northgate Builders, LLC", "northgate builders"],
    ["NORTHGATE BUILDERS L.L.C.", "northgate builders"],
    ["The Northgate Builders Company", "northgate builders"],
    ["Ridgeline Electric, Inc.", "ridgeline electric"],
    ["Acme Corp", "acme"],
    ["Acme Corporation", "acme"],
    ["Acme Co.", "acme"],
    ["Harbor Holdings Ltd", "harbor holdings"],
    ["Harbor Holdings Limited", "harbor holdings"],
    ["Bluestone Masonry LLC dba Bluestone Stoneworks", "bluestone masonry bluestone stoneworks"],
    ["O'Brien & Sons, Inc.", "obrien and sons"],
    ["Smith-Jones   Paving", "smith jones paving"],
    ["Café Électrique Inc", "cafe electrique"],
    ["  ", ""],
  ])("normalises %j to %j", (input, expected) => {
    expect(normalizeCompanyName(input)).toBe(expected);
  });

  it("keeps suffix letters inside longer words", () => {
    expect(normalizeCompanyName("Incline Corrugated Cobalt")).toBe("incline corrugated cobalt");
  });
});

describe("namesMatch", () => {
  it.each([
    ["Northgate Builders LLC", "Northgate Builders, L.L.C."],
    ["Northgate Builders LLC", "NORTHGATE BUILDERS"],
    ["The Acme Company", "acme corp"],
    // Containment when the shorter name has at least two tokens.
    ["Northgate Builders LLC", "Northgate Builders Group LLC"],
    ["Northgate Builders", "Northgate Builders of New Hampshire, LLC"],
    ["Northgate Builders LLC", "Northgate Builders LLC, its officers and employees"],
  ])("matches %j and %j", (a, b) => {
    expect(namesMatch(a, b)).toBe(true);
    expect(namesMatch(b, a)).toBe(true);
  });

  it.each([
    ["Northgate Builders LLC", "Southgate Builders LLC"],
    // Single-token containment is too weak.
    ["Acme LLC", "Acme Roofing Supply"],
    // Containment is token-bounded, not substring.
    ["Ace Builders", "Grace Builders Inc"],
    ["Northgate Builders", "Builders Northgate"],
    ["", "Northgate Builders"],
    ["LLC", "Inc."],
  ])("does not match %j and %j", (a, b) => {
    expect(namesMatch(a, b)).toBe(false);
    expect(namesMatch(b, a)).toBe(false);
  });
});

describe("formatCents / formatLimit", () => {
  it("formats cents as US dollars with two decimals", () => {
    expect(formatCents(123_450)).toBe("$1,234.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(100_000_000)).toBe("$1,000,000.00");
  });

  it("formats limits as whole dollars", () => {
    expect(formatLimit(100_000_000)).toBe("$1,000,000");
    expect(formatLimit(50_000_000)).toBe("$500,000");
    expect(formatLimit(0)).toBe("$0");
  });

  it("keeps cents on a limit that is not whole dollars rather than rounding it up", () => {
    expect(formatLimit(99_999_999)).toBe("$999,999.99");
  });
});

describe("parseLimitToCents", () => {
  it.each([
    ["1,000,000", 100_000_000],
    ["$1,000,000", 100_000_000],
    ["$ 1,000,000.00", 100_000_000],
    ["1000000", 100_000_000],
    ["1 000 000", 100_000_000],
    ["1.000.000", 100_000_000],
    ["1.000.000,00", 100_000_000],
    ["2.500", 250_000],
    ["$1M", 100_000_000],
    ["2m", 200_000_000],
    ["1.5M", 150_000_000],
    ["$2MM", 200_000_000],
    ["1 million", 100_000_000],
    ["500k", 50_000_000],
    ["500K", 50_000_000],
    ["$250 thousand", 25_000_000],
    ["USD 1,000,000", 100_000_000],
    ["1,234.56", 123_456],
    ["1234,56", 123_456],
    ["0", 0],
  ])("parses %j as %d cents", (input, cents) => {
    expect(parseLimitToCents(input)).toBe(cents);
  });

  it("treats a number as dollars", () => {
    expect(parseLimitToCents(1_000_000)).toBe(100_000_000);
    expect(parseLimitToCents(0.5)).toBe(50);
  });

  it.each(["", "   ", "N/A", "statutory", "1,00,0,000x", "-1,000,000", "$", "1M2", "1.2.3,4.5"])(
    "returns null for %j",
    (input) => {
      expect(parseLimitToCents(input)).toBeNull();
    },
  );

  it("returns null for non-finite or negative numbers", () => {
    expect(parseLimitToCents(Number.NaN)).toBeNull();
    expect(parseLimitToCents(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseLimitToCents(-5)).toBeNull();
  });
});
