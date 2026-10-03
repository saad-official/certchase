import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { SectionLabel } from "@/components/marketing/section-label";
import { container } from "@/components/marketing/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free for up to 10 vendors with manual approval of every email. Pro is $39/month for unlimited vendors, auto-sent renewal reminders, email-in certificates and a weekly exposure digest. Stripe runs in test mode.",
};

const rows: { feature: string; free: string | null; pro: string | null; mono?: boolean }[] = [
  { feature: "Vendors", free: "10", pro: "Unlimited", mono: true },
  { feature: "Requirement templates", free: "Included", pro: "Included" },
  { feature: "Certificate reading (ACORD 25)", free: "Upload", pro: "Upload and email-in" },
  { feature: "Rule-based compliance checks", free: "Included", pro: "Included" },
  { feature: "Chase emails", free: "Every email approved by you", pro: "Renewal reminders can auto-send at 0.80 confidence" },
  { feature: "Exposure dashboard", free: "Included", pro: "Included" },
  { feature: "Weekly exposure digest", free: null, pro: "Included" },
  { feature: "Audit trail", free: "Included", pro: "Included" },
  { feature: "Demo vendors with synthetic certificates", free: "Included", pro: "Included" },
  { feature: "Price", free: "$0", pro: "$39/month, test mode", mono: true },
];

function Cell({ value, mono }: { value: string | null; mono?: boolean }) {
  if (value === null) {
    return (
      <>
        <span aria-hidden="true" className="text-muted-foreground">
          —
        </span>
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className={cn(mono && "data")}>{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <section aria-labelledby="pricing-title" className="drafting-grid border-b border-foreground/15">
        <div className={cn(container, "grid gap-12 pt-12 pb-20 sm:pt-16 sm:pb-24 lg:grid-cols-12")}>
          <div className="lg:col-span-4">
            <SectionLabel>Pricing</SectionLabel>
            <h1 id="pricing-title" className="mt-4 text-4xl leading-[1.08] tracking-[-0.03em] text-balance sm:text-5xl">
              Priced for a roster of tens, not hundreds.
            </h1>
            <p className="mt-5 max-w-xs text-[0.9375rem] leading-relaxed text-foreground/85">
              Two plans. Start on Free with the demo vendors, and move to Pro when renewal reminders should go out
              without you.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <PricingPlans headingLevel="h2" />
          </div>
        </div>
      </section>

      <section aria-labelledby="compare-title" className="bg-card">
        <div className={cn(container, "grid gap-10 py-20 sm:py-24 lg:grid-cols-12")}>
          <div className="lg:col-span-4">
            <h2 id="compare-title" className="text-3xl leading-tight sm:text-4xl">
              Side by side
            </h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Both plans use the same rule engine and the same guardrails. Pro adds volume and lets renewals send on
              their own.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Free and Pro plans compared</caption>
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[30%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-foreground/30">
                  <th scope="col" className="py-3 pr-3 font-mono text-xs font-medium text-muted-foreground uppercase">
                    Feature
                  </th>
                  <th scope="col" className="py-3 pr-3 text-base font-semibold">
                    Free
                  </th>
                  <th scope="col" className="py-3 text-base font-semibold">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.feature} className="border-b border-border align-top">
                    <th scope="row" className="py-3 pr-3 font-normal break-words text-muted-foreground">
                      {r.feature}
                    </th>
                    <td className="py-3 pr-3 break-words">
                      <Cell value={r.free} mono={r.mono} />
                    </td>
                    <td className="py-3 break-words">
                      <Cell value={r.pro} mono={r.mono} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-6 text-sm text-muted-foreground">
              Test mode. Checkout runs on Stripe&rsquo;s sandbox; no card is charged.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className={cn(container, "py-20 sm:py-24")}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 id="faq-title" className="text-3xl leading-tight sm:text-4xl">
              Questions
            </h2>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <Faq />
          </div>
        </div>
      </section>
    </>
  );
}
