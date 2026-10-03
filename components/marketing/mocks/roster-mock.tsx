import { StatusChip, type Status } from "../status-chip";
import { MockFrame, Panel, PanelHeader } from "./mock-frame";

type Row = {
  vendor: string;
  trade: string;
  contract: string;
  status: Status;
  /** What the rules found, in the app's own words. */
  note: string;
  /** Earliest required expiration, or a dash when there is no certificate. */
  expires: string;
};

const rows: Row[] = [
  {
    vendor: "Northside Drywall",
    trade: "Drywall",
    contract: "$52,500",
    status: "deficient",
    note: "GL $500,000 below $1,000,000; waiver missing",
    expires: "2027-04-30",
  },
  {
    vendor: "Alder Street Roofing",
    trade: "Roofing",
    contract: "$46,000",
    status: "missing",
    note: "No certificate on file; request sent Sep 28",
    expires: "—",
  },
  {
    vendor: "Harbor Mechanical",
    trade: "HVAC",
    contract: "$86,000",
    status: "expiring",
    note: "GL expires Nov 2; renewal reminder drafted",
    expires: "2026-11-02",
  },
  {
    vendor: "Ridgeline Electric",
    trade: "Electrical",
    contract: "$248,000",
    status: "compliant",
    note: "All six requirements met",
    expires: "2027-03-14",
  },
  {
    vendor: "Kestrel Site Services",
    trade: "Excavation",
    contract: "$131,750",
    status: "compliant",
    note: "All six requirements met",
    expires: "2027-01-09",
  },
  {
    vendor: "Cedar & Pine Carpentry",
    trade: "Finish carpentry",
    contract: "$38,200",
    status: "compliant",
    note: "All six requirements met",
    expires: "2027-06-21",
  },
];

/**
 * The vendor roster as it appears in the app, sorted with the vendors that
 * need attention first. On phones the trade and expiry columns fold into
 * the vendor cell so the table never scrolls sideways.
 */
export function RosterMock() {
  return (
    <MockFrame
      figure="1"
      caption="Vendor roster, sorted by what needs attention. Synthetic vendors and certificates."
    >
      <Panel>
        <PanelHeader title="Vendors" meta={<span>6 of 24 shown</span>} />
        <table className="w-full table-fixed text-left text-sm">
          <caption className="sr-only">Example vendor roster with certificate status</caption>
          <colgroup>
            <col />
            <col className="w-[5.5rem] sm:w-[6.5rem]" />
            <col className="hidden sm:table-column sm:w-[7.5rem]" />
            <col className="hidden sm:table-column sm:w-[6.5rem]" />
          </colgroup>
          <thead className="border-b border-border text-[0.6875rem] tracking-[0.06em] text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-3.5 py-2 font-medium sm:px-4">
                Vendor
              </th>
              <th scope="col" className="py-2 pr-3.5 pl-2 text-right font-medium sm:pr-2">
                Contract
              </th>
              <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">
                Status
              </th>
              <th scope="col" className="hidden py-2 pr-4 pl-2 font-medium sm:table-cell">
                Expires
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vendor} className="border-b border-border align-top last:border-b-0">
                <th scope="row" className="min-w-0 px-3.5 py-3 font-normal sm:px-4">
                  <span className="block truncate font-medium">{r.vendor}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{r.trade}</span>
                  {/* Phones: status and expiry fold into this cell. */}
                  <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
                    <StatusChip status={r.status} />
                    {r.expires !== "—" ? (
                      <span className="text-xs text-muted-foreground">
                        exp <span className="data">{r.expires}</span>
                      </span>
                    ) : null}
                  </span>
                  {r.status !== "compliant" ? (
                    <span className="mt-1.5 block text-xs leading-snug text-foreground/80">{r.note}</span>
                  ) : null}
                </th>
                <td className="data py-3 pr-3.5 pl-2 text-right sm:pr-2">{r.contract}</td>
                <td className="hidden px-2 py-2.5 sm:table-cell">
                  <StatusChip status={r.status} />
                </td>
                <td className="data hidden py-3 pr-4 pl-2 text-muted-foreground sm:table-cell">{r.expires}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </MockFrame>
  );
}
