import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { links, textLink } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How the CertChase demo handles data: synthetic certificates, private storage per organisation, logged model calls, and no real payments. Not legal advice.",
};

export default function PrivacyPage() {
  return (
    <LegalPage label="Privacy" title="Privacy" updated="2026-10-03">
      <h2>The short version</h2>
      <p>
        CertChase is a portfolio demo. It is built to run on synthetic vendors and generated certificates, and you
        should not upload real certificates of insurance or real contact details to it.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>Your account: email address and a password hash, held by Supabase Auth.</li>
        <li>Your organisation: its name, requirement templates, vendors and settings.</li>
        <li>
          Certificates you upload, in a private storage bucket under a path that begins with your
          organisation&rsquo;s id. Database policies check that path, so other accounts cannot read your files.
        </li>
        <li>What was read from each certificate, the rule results, and the chase emails drafted from them.</li>
        <li>
          An append-only log of every model call (model, prompt version, token counts, latency) and every approval,
          edit or rejection.
        </li>
      </ul>

      <h2>Who processes it</h2>
      <ul>
        <li>
          <strong>Supabase</strong> hosts the database, authentication and file storage.
        </li>
        <li>
          <strong>Google Gemini</strong> reads certificate images and PDFs. The public demo uses the free tier, whose
          inputs may be used by Google to improve its products, which is why it must never be given a real
          certificate.
        </li>
        <li>
          <strong>Groq</strong> may draft chase emails from the rule findings.
        </li>
        <li>
          <strong>Stripe</strong> runs checkout in test mode. No real card is charged and no real payment is taken.
        </li>
        <li>
          <strong>Resend</strong> delivers email only when demo delivery is switched on. By default, outgoing email
          lands in an in-app outbox and is not sent.
        </li>
        <li>
          <strong>Vercel</strong> hosts the site and records anonymous page-view analytics.
        </li>
      </ul>

      <h2>What is not done</h2>
      <ul>
        <li>CertChase does not train models on your data.</li>
        <li>Data is not sold or shared for advertising.</li>
        <li>No compliance decision is made by a language model; plain rules make it.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Demo data may be reset at any time. To have an account and its files removed sooner, open an issue on the{" "}
        <a href={links.issues} className={textLink}>
          GitHub repository
        </a>{" "}
        without including any personal details, and the maintainer will follow up.
      </p>

      <h2>Related</h2>
      <p>
        The rules for using the demo are on the{" "}
        <Link href={links.terms} className={textLink}>
          terms page
        </Link>
        .
      </p>
    </LegalPage>
  );
}
