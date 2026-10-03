import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./site";

const items: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does it decide compliance with AI?",
    a: (
      <>
        <p>
          No. A vision model reads the certificate and returns fields: policy numbers, dates, limits and which
          endorsement boxes are marked, each with a confidence and the words it read them from.
        </p>
        <p>
          Whether a vendor is compliant is decided by plain rules that compare those fields with your requirement
          template. The same certificate and template always give the same result, and every finding names the values
          it compared.
        </p>
      </>
    ),
  },
  {
    q: "What documents does it read?",
    a: (
      <p>
        ACORD 25 certificates of liability insurance, as PDFs or photos up to 10 MB. Endorsement pages, such as a
        separate additional-insured endorsement, are planned for later; for now the rules read what the ACORD 25
        itself shows.
      </p>
    ),
  },
  {
    q: "Does it email anyone without me?",
    a: (
      <>
        <p>
          Not unless you turn that on. On Free, every email waits in your approval queue until you approve, edit or
          reject it.
        </p>
        <p>
          On Pro you can let renewal reminders send on their own when the draft&rsquo;s confidence is 0.80 or higher.
          Correction requests and first requests still wait for you, and a draft that fails a guardrail check always
          waits.
        </p>
      </>
    ),
  },
  {
    q: "What about my data?",
    a: (
      <>
        <p>
          The public demo runs on synthetic vendors and generated certificates. Uploaded files sit in private storage
          scoped to your organisation, and no other account can read them.
        </p>
        <p>
          The demo uses Gemini&rsquo;s free tier, which is never given real certificates. Please don&rsquo;t upload
          real ones to it.
        </p>
      </>
    ),
  },
  {
    q: "Can I use my own requirements?",
    a: (
      <p>
        Yes. Build a requirement template for each kind of contract, for example &ldquo;Standard
        subcontractor&rdquo; and &ldquo;Vendor, low risk&rdquo;, with your own limits, endorsements and notice
        period, and point each vendor at the one that applies.
      </p>
    ),
  },
];

/** Native disclosure list: works without JavaScript and with find-in-page. */
export function Faq({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <div className="border-t border-foreground/20">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-border">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-start justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden",
              focusRing,
            )}
          >
            <Heading className="text-lg leading-snug font-medium">{item.q}</Heading>
            <Plus
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-muted-foreground group-open:rotate-45 motion-safe:transition-transform"
            />
          </summary>
          <div className="max-w-2xl space-y-3 pb-6 text-[0.9375rem] leading-relaxed text-foreground/85">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
