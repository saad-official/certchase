import { CodeChip, StatusChip } from "../status-chip";
import { MockFrame, Panel, PanelHeader } from "./mock-frame";

const findings = [
  {
    code: "limit_below_required",
    sentence: "General liability each occurrence is $500,000; the contract requires $1,000,000.",
    compared: [
      ["found", "$500,000"],
      ["required", "$1,000,000"],
    ],
  },
  {
    code: "missing_waiver",
    sentence: "Waiver of subrogation is required on the GL policy and is not marked.",
    compared: [
      ["found", "false"],
      ["required", "true"],
    ],
  },
];

/** Step 3: the rule engine's output for one certificate. */
export function FindingsMock() {
  return (
    <MockFrame figure="4" caption="Rule engine output for one certificate. The same input gives the same result every time.">
      <Panel>
        <PanelHeader title="Northside Drywall" meta={<StatusChip status="deficient" />} />
        <ol className="divide-y divide-border">
          {findings.map((f) => (
            <li key={f.code} className="px-3.5 py-3.5 sm:px-4">
              <CodeChip>{f.code}</CodeChip>
              <p className="mt-2 text-sm leading-snug">{f.sentence}</p>
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                {f.compared.map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="data">{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
        <p className="overflow-hidden border-t border-border bg-muted/60 px-3.5 py-2.5 font-mono text-[0.6875rem] text-ellipsis whitespace-nowrap text-muted-foreground sm:px-4">
          evaluateCertificate(extraction, template, today)
        </p>
      </Panel>
    </MockFrame>
  );
}
