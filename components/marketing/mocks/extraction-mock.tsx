import { cn } from "@/lib/utils";
import { MockFrame, Panel, PanelHeader } from "./mock-frame";

const fields = [
  { name: "Policy number", value: "GL-7781-0425", confidence: 98, evidence: "POLICY NUMBER GL-7781-0425" },
  { name: "Expiration", value: "2027-04-30", confidence: 96, evidence: "POLICY EXP 04/30/2027" },
  { name: "Each occurrence", value: "$500,000", confidence: 97, evidence: "EACH OCCURRENCE $500,000" },
  { name: "Waiver of subrogation", value: "Not marked", confidence: 64, evidence: "SUBR WVD [ ]" },
];

/**
 * Step 2: fields the model read from an ACORD 25, each with a confidence
 * and the exact words it read them from. Anything under 70% goes to review.
 */
export function ExtractionMock() {
  return (
    <MockFrame figure="3" caption="Fields read from an ACORD 25, each with the words it was read from.">
      <Panel>
        <PanelHeader title="Fields read" meta="northside_acord25.pdf" />
        <ul className="divide-y divide-border">
          {fields.map((f) => {
            const review = f.confidence < 70;
            return (
              <li key={f.name} className="px-3.5 py-3 sm:px-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{f.name}</p>
                  <p
                    className={cn(
                      "data text-xs",
                      review
                        ? "font-medium text-[color-mix(in_oklch,var(--saffron),var(--graphite)_55%)]"
                        : "text-muted-foreground",
                    )}
                  >
                    <span className="sr-only">Confidence </span>
                    {f.confidence}%{review ? " · needs review" : ""}
                  </p>
                </div>
                <p className="data mt-0.5 font-medium">{f.value}</p>
                <p className="mt-1.5 border-l-2 border-cobalt/60 bg-accent/60 py-0.5 pl-2 font-mono text-[0.6875rem] tracking-wide break-words text-accent-foreground">
                  <span className="sr-only">Evidence: </span>&ldquo;{f.evidence}&rdquo;
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </MockFrame>
  );
}
