import type { Metadata } from "next";
import Link from "next/link";
import { CtaLink } from "@/components/marketing/cta-link";
import { Faq } from "@/components/marketing/faq";
import { EmailDraftMock } from "@/components/marketing/mocks/email-draft-mock";
import { ExposureMock } from "@/components/marketing/mocks/exposure-mock";
import { ExtractionMock } from "@/components/marketing/mocks/extraction-mock";
import { FindingsMock } from "@/components/marketing/mocks/findings-mock";
import { RequirementsMock } from "@/components/marketing/mocks/requirements-mock";
import { RosterMock } from "@/components/marketing/mocks/roster-mock";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { SectionLabel } from "@/components/marketing/section-label";
import { container, links, textLink } from "@/components/marketing/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "CertChase · Certificates of insurance, tracked and chased" },
  description:
    "CertChase reads each subcontractor's certificate of insurance, checks it against what the contract requires using plain rules, and chases brokers for corrections and renewals with emails you approve.",
};

const stats = [
  {
    ref: "1",
    figure: "7 in 10",
    text: "collected certificates are non-compliant in some way.",
    source: "Jones Insurance, cited by Expiration Reminder",
  },
  {
    ref: "2",
    figure: "<50%",
    text: "of small firms have an alert when a certificate expires.",
    source: "Jones Insurance, cited by Expiration Reminder",
  },
  {
    ref: "3",
    figure: "$1,000+",
    text: "per year is where incumbent trackers start.",
    source: "SmartCompliance pricing, 2026",
  },
];

const steps = [
  {
    title: "Write down what the contract requires",
    actor: "you",
    body: "A requirement template holds the limits, endorsements and notice period a contract asks for. Start from the default for small contractors, or build one per kind of job.",
    visual: <RequirementsMock />,
  },
  {
    title: "The model reads the certificate",
    actor: "vision model",
    body: "Upload an ACORD 25, or on Pro forward it by email. A vision model returns each field with a confidence and the exact words it read. Anything under 70% is held for you to confirm.",
    visual: <ExtractionMock />,
  },
  {
    title: "Plain rules decide",
    actor: "rule engine",
    body: "Each field is compared with the template: coverage present, limits at or above what is required, dates in force, endorsements marked. Every gap gets a code and the two values compared. No compliance verdict ever comes from a language model.",
    visual: <FindingsMock />,
  },
  {
    title: "The broker gets chased",
    actor: "model drafts, you approve",
    body: "A correction request or renewal reminder is drafted from the findings, quoting them word for word, and waits for your approval. Follow-ups are scheduled at 7 and 14 days, and 30, 14 and 7 days before an expiry.",
    visual: <EmailDraftMock />,
  },
];

const trust = [
  {
    title: "An audit trail you can read",
    body: (
      <p>
        Every model call and every decision is written to an append-only log: the model, the prompt version, tokens
        and latency, what came back, and who approved what and when. Entries are never edited afterwards.
      </p>
    ),
  },
  {
    title: "Guardrails on every draft",
    body: (
      <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
        <li>Never threatens, and never makes legal claims.</li>
        <li>Never contacts a vendor marked do-not-contact.</li>
        <li>Quotes the rule findings verbatim, so the broker sees the exact gap.</li>
        <li>Must name the vendor and carry a sign-off. A draft that fails any check always waits for you.</li>
      </ul>
    ),
  },
  {
    title: "Storage scoped per organisation",
    body: (
      <p>
        Certificates live in a private bucket under your organisation&rsquo;s own path. Database policies check that
        path on every read, so one account cannot open another&rsquo;s files.
      </p>
    ),
  },
  {
    title: "Synthetic demo data only",
    body: (
      <p>
        The demo loads eight invented vendors with generated ACORD 25 certificates covering every status. Please
        don&rsquo;t upload real certificates to the public demo.
      </p>
    ),
  },
];

export default function HomePage() {
  return (
    <>
      {/* a. Hero */}
      <section aria-labelledby="hero-title" className="drafting-grid border-b border-foreground/15">
        <div className={cn(container, "grid items-start gap-12 pt-12 pb-16 sm:pt-16 lg:grid-cols-12 lg:gap-10 lg:pt-20 lg:pb-24")}>
          <div className="lg:col-span-5 lg:pt-4">
            <SectionLabel>COI compliance for small contractors, property managers and venues</SectionLabel>
            <h1
              id="hero-title"
              className="mt-6 text-[2.375rem] leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.5rem]"
            >
              Certificates of insurance, tracked and chased.
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-foreground/85">
              CertChase reads each subcontractor&rsquo;s certificate, checks it against what the contract requires
              using plain rules, and chases brokers for corrections and renewals with emails you approve.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaLink href={links.signUp}>Start free</CtaLink>
              <CtaLink href="#how-it-works" tone="outline">
                See how it works
              </CtaLink>
            </div>
            <p className="mt-5 font-mono text-xs text-muted-foreground">Free for up to 10 vendors. No card needed.</p>
          </div>
          <div className="min-w-0 lg:col-span-7">
            <RosterMock />
          </div>
        </div>
      </section>

      {/* b. Problem strip */}
      <section aria-labelledby="problem-title" className="border-b border-foreground/15 bg-card">
        <div className={cn(container, "py-14 sm:py-16")}>
          <h2 id="problem-title" className="text-sm font-medium text-muted-foreground">
            Why certificates slip
          </h2>
          <ul className="mt-8 grid border-t border-foreground/20 md:grid-cols-3">
            {stats.map((s, i) => (
              <li
                key={s.ref}
                className={cn(
                  "flex flex-col border-b border-border py-7 md:border-b-0 md:py-8",
                  i > 0 && "md:border-l md:pl-8",
                  i < 2 && "md:pr-8",
                )}
              >
                <p className="data text-[3.25rem] leading-none font-medium tracking-[-0.04em] sm:text-6xl md:text-5xl lg:text-6xl">
                  {s.figure}
                </p>
                <p className="mt-4 max-w-[19rem] text-[0.9375rem] leading-snug">{s.text}</p>
                <p className="mt-auto pt-4 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
                  <span aria-hidden="true">[{s.ref}] </span>
                  Source: <cite className="not-italic">{s.source}</cite>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* c. How it works */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-4">
        <div className={cn(container, "py-20 sm:py-28")}>
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <SectionLabel index="01">How it works</SectionLabel>
              <h2 id="how-title" className="mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl">
                The model extracts. The rules decide.
              </h2>
            </div>
            <p className="max-w-md text-[0.9375rem] leading-relaxed text-foreground/85 lg:col-span-5 lg:col-start-8 lg:self-end">
              Four steps, and each one says who does it. The language model reads documents and drafts emails. It
              never decides whether a vendor is covered.
            </p>
          </div>

          <ol className="mt-14 border-t border-foreground/20">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-8 border-b border-border py-10 md:grid-cols-12 md:gap-8 md:py-14"
              >
                <div className="md:col-span-5 lg:col-span-4">
                  <p className="flex items-baseline gap-3 font-mono text-xs text-muted-foreground">
                    <span aria-hidden="true" className="tabular text-2xl font-medium text-cobalt">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="sr-only">Done by: </span>
                      <span aria-hidden="true">done by </span>
                      <span className="text-foreground">{step.actor}</span>
                    </span>
                  </p>
                  <h3 className="mt-4 text-2xl leading-snug">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-foreground/85">{step.body}</p>
                </div>
                <div className="min-w-0 md:col-span-7 lg:col-span-6 lg:col-start-7">{step.visual}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* d. Exposure */}
      <section aria-labelledby="exposure-title" className="drafting-grid border-y border-foreground/15">
        <div className={cn(container, "grid gap-10 py-20 sm:py-28 lg:grid-cols-12")}>
          <div className="lg:col-span-4">
            <SectionLabel index="02">Exposure</SectionLabel>
            <h2 id="exposure-title" className="mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl">
              What is uncovered, in dollars and days.
            </h2>
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed text-foreground/85">
              The dashboard reports in contract dollars and days to expiry: how much work is running under vendors
              who are not covered, and how soon the next certificate lapses.
            </p>
          </div>
          <div className="min-w-0 lg:col-span-7 lg:col-start-6 lg:pt-12">
            <ExposureMock />
          </div>
        </div>
      </section>

      {/* e. Trust */}
      <section aria-labelledby="trust-title" className={cn(container, "py-20 sm:py-28")}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="03">Trust</SectionLabel>
            <h2 id="trust-title" className="mt-4 text-4xl leading-[1.08] text-balance sm:text-5xl">
              Every step is on the record.
            </h2>
          </div>
          <ul className="grid gap-x-10 border-t border-foreground/20 sm:grid-cols-2 lg:col-span-8">
            {trust.map((t) => (
              <li key={t.title} className="border-b border-border py-8">
                <h3 className="text-lg">{t.title}</h3>
                <div className="mt-3 text-[0.9375rem] leading-relaxed text-foreground/85">{t.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* f. Pricing */}
      <section
        id="pricing"
        aria-labelledby="pricing-title"
        className="scroll-mt-4 border-y border-foreground/15 bg-muted/60"
      >
        <div className={cn(container, "grid gap-12 py-20 sm:py-28 lg:grid-cols-12")}>
          <div className="lg:col-span-4">
            <SectionLabel index="04">Pricing</SectionLabel>
            <h2 id="pricing-title" className="mt-4 text-4xl leading-[1.08] sm:text-5xl">
              Two plans. One is free.
            </h2>
            <p className="mt-5 max-w-xs text-[0.9375rem] leading-relaxed text-foreground/85">
              Start with the demo vendors. Move to Pro when renewals should go out without you.{" "}
              <Link href={links.pricing} className={textLink}>
                Compare plans
              </Link>
              .
            </p>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <PricingPlans />
          </div>
        </div>
      </section>

      {/* g. FAQ */}
      <section aria-labelledby="faq-title" className={cn(container, "py-20 sm:py-28")}>
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionLabel index="05">Questions</SectionLabel>
            <h2 id="faq-title" className="mt-4 text-4xl leading-[1.08] sm:text-5xl">
              Answered plainly.
            </h2>
          </div>
          <div className="min-w-0 lg:col-span-8">
            <Faq />
          </div>
        </div>
      </section>

      {/* h. Final CTA */}
      <section aria-labelledby="cta-title" className="drafting-grid border-t border-foreground/15 bg-card">
        <div className={cn(container, "grid gap-8 py-16 sm:py-20 md:grid-cols-12 md:items-end")}>
          <div className="md:col-span-7">
            <h2 id="cta-title" className="text-4xl leading-[1.08] text-balance sm:text-5xl">
              Know which vendors are covered before the job starts.
            </h2>
          </div>
          <div className="md:col-span-5 md:justify-self-end">
            <div className="flex flex-wrap gap-3">
              <CtaLink href={links.signUp}>Start free</CtaLink>
              <CtaLink href={links.pricing} tone="outline">
                See pricing
              </CtaLink>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Load the demo vendors and read a first certificate. No card needed.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
