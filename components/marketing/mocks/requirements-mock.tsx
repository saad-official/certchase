import { MockFrame, Panel, PanelHeader } from "./mock-frame";

const coverage = [
  { line: "General liability", value: "$1,000,000 / $2,000,000", hint: "each occurrence / aggregate" },
  { line: "Auto liability", value: "$1,000,000 CSL", hint: "combined single limit" },
  { line: "Workers’ comp", value: "Statutory", hint: "employer’s liability $1,000,000" },
];

const endorsements = ["Additional insured", "Waiver of subrogation", "30-day notice of cancellation"];

/** Step 1: a requirement template as a compact rules card. */
export function RequirementsMock() {
  return (
    <MockFrame figure="2" caption="A requirement template. Each vendor contract points at one.">
      <Panel>
        <PanelHeader title="Standard subcontractor" meta="template · default" />
        <dl className="divide-y divide-border text-sm">
          {coverage.map((c) => (
            <div key={c.line} className="grid gap-x-4 gap-y-0.5 px-3.5 py-2.5 sm:grid-cols-[9rem_1fr] sm:px-4">
              <dt className="text-muted-foreground">{c.line}</dt>
              <dd>
                <span className="data font-medium">{c.value}</span>
                <span className="block text-xs text-muted-foreground">{c.hint}</span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-border px-3.5 py-3 sm:px-4">
          <p className="text-xs text-muted-foreground">Also required</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {endorsements.map((e) => (
              <li
                key={e}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2 py-1 text-xs"
              >
                <span aria-hidden="true" className="size-1.5 bg-foreground/60" />
                {e}
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </MockFrame>
  );
}
