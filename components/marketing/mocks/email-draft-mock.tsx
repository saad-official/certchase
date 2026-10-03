import { FauxButton, MockFrame, Panel, PanelHeader } from "./mock-frame";

/** Step 4: a deficiency email waiting for approval, quoting the rule findings verbatim. */
export function EmailDraftMock() {
  return (
    <MockFrame
      figure="5"
      caption="A correction request waiting in the approval queue. Nothing is sent until you approve it."
    >
      <Panel>
        <PanelHeader title="Approval queue" meta="1 of 2 waiting" />
        <article aria-label="Draft email to the broker for Northside Drywall" className="p-3.5 sm:p-4">
          <dl className="grid grid-cols-[3rem_minmax(0,1fr)] gap-y-1 text-xs">
            <dt className="text-muted-foreground">To</dt>
            <dd className="truncate">dana@harborline-brokers.test</dd>
            <dt className="text-muted-foreground">Subject</dt>
            <dd>Northside Drywall: two certificate corrections</dd>
          </dl>
          <div className="mt-3 space-y-2.5 rounded-sm border border-border bg-background p-3 text-sm leading-relaxed">
            <p>Hi Dana,</p>
            <p>
              Thanks for the certificate for Northside Drywall. Before their crew starts on the Elm Street job, we
              need two corrections:
            </p>
            <ul className="space-y-1.5 border-l-2 border-oxblood/50 pl-3">
              <li>
                General liability each occurrence is <span className="data">$500,000</span>; the contract requires{" "}
                <span className="data">$1,000,000</span>.
              </li>
              <li>Waiver of subrogation is required on the GL policy and is not marked.</li>
            </ul>
            <p>Could you send an updated certificate once these are in place?</p>
            <p>
              Thanks,
              <br />
              Maria Okafor, Okafor Builders
            </p>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <FauxButton tone="primary">Approve</FauxButton>
            <FauxButton>Edit</FauxButton>
            <FauxButton tone="ghost">Reject</FauxButton>
          </div>
        </article>
      </Panel>
    </MockFrame>
  );
}
