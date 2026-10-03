import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { links, textLink } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms for using the CertChase demo: a portfolio project with test-mode billing, synthetic data and no warranty. Not legal advice.",
};

export default function TermsPage() {
  return (
    <LegalPage label="Terms" title="Terms of use" updated="2026-10-03">
      <h2>What this is</h2>
      <p>
        CertChase is a portfolio demo built in public. It is not a commercial service or an insurance product, and
        these terms are written to be honest rather than to be a contract a lawyer would draft.
      </p>

      <h2>It is not insurance or legal advice</h2>
      <p>
        CertChase compares what a certificate shows with the requirements you enter. A certificate of insurance is
        evidence of coverage, not the policy itself, and a &ldquo;compliant&rdquo; status means only that the
        certificate met your template. Confirm anything that matters with the broker or insurer.
      </p>

      <h2>Billing is test mode</h2>
      <p>
        Stripe runs in test mode. The Pro plan can be &ldquo;bought&rdquo; with Stripe&rsquo;s published test cards,
        and no real payment is ever taken. Never enter a real card number.
      </p>

      <h2>Using it</h2>
      <ul>
        <li>Use synthetic vendors and certificates. Do not upload real certificates to the public demo.</li>
        <li>
          The model reads and drafts; you decide. You are responsible for any email you approve or allow to send.
        </li>
        <li>Only contact brokers and vendors you actually work with.</li>
        <li>Don&rsquo;t use it to harass anyone, to try to reach other accounts, or to overload the service.</li>
      </ul>

      <h2>Email</h2>
      <p>
        By default, outgoing email lands in an in-app outbox and is not delivered. If demo delivery is turned on,
        messages go to your own inbox with a note naming the intended recipient.
      </p>

      <h2>No warranty</h2>
      <p>
        The demo is provided as it is. Data may be reset, accounts may be removed, and the service may stop at any
        time. Extraction can be wrong, which is why low-confidence fields are held for review; read each finding
        before acting on it.
      </p>

      <h2>Questions and changes</h2>
      <p>
        Ask by opening an issue on the{" "}
        <a href={links.issues} className={textLink}>
          GitHub repository
        </a>
        . Changes to these terms are made there, in the open. How data is handled is described on the{" "}
        <Link href={links.privacy} className={textLink}>
          privacy page
        </Link>
        .
      </p>
    </LegalPage>
  );
}
