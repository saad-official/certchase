import type { Organization, Vendor } from "@/lib/domain/types";

export function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org_1",
    name: "Northgate Builders",
    legalName: "Northgate Builders LLC",
    timezone: "America/New_York",
    plan: "pro",
    autonomy: "auto_renewals",
    voice: {
      businessName: "Northgate Builders",
      signature: "Dana Ortiz, Northgate Builders",
      toneNotes: "plain, courteous, specific",
    },
    ...overrides,
  };
}

export function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: "ven_1",
    orgId: "org_1",
    name: "Bluestone Masonry LLC",
    contactEmail: "office@bluestonemasonry.example.com",
    brokerName: "Pioneer Risk Partners",
    brokerEmail: "service@pioneerrisk.example.com",
    trade: "Masonry",
    contractValueCents: 4_850_000,
    templateId: "tpl_1",
    doNotContact: false,
    ...overrides,
  };
}
