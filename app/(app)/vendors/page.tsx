import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { VendorHeaderActions } from "@/components/vendors/vendor-header-actions";
import { VendorList } from "@/components/vendors/vendor-list";
import { requireOrgContext } from "@/lib/db/queries";
import { formatCents } from "@/lib/domain/normalize";
import { cn } from "@/lib/utils";
import { FILTER_LABELS, loadVendorList, matchesFilter, STATUS_FILTERS, type StatusFilter } from "./data";

export const metadata: Metadata = { title: "Vendors" };
// The demo seed renders, uploads and reads 7 certificates in one action.
export const maxDuration = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function parseFilter(value: string | string[] | undefined): StatusFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return (STATUS_FILTERS as readonly string[]).includes(v ?? "") ? (v as StatusFilter) : "all";
}

const COUNT_TONE: Partial<Record<StatusFilter, string>> = {
  compliant: "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]",
  expiring: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_50%)]",
  review: "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_50%)]",
  deficient: "text-oxblood",
  expired: "text-oxblood",
};

export default async function VendorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { org, role } = await requireOrgContext();
  const status = parseFilter((await searchParams).status);
  const data = await loadVendorList(org);

  const counts = Object.fromEntries(
    STATUS_FILTERS.map((f) => [f, data.rows.filter((row) => matchesFilter(row, f)).length]),
  ) as Record<StatusFilter, number>;
  const rows = data.rows.filter((row) => matchesFilter(row, status));
  const atRiskCents = data.rows.filter((r) => r.status !== "compliant").reduce((sum, r) => sum + r.contractValueCents, 0);
  const { capacity } = data;

  return (
    <>
      <PageHeader
        title="Vendors"
        description={
          <>
            Every subcontractor and supplier, judged against its requirements from its latest certificate.
            <span className="mt-1 block text-xs">
              {data.rows.length > 0 ? (
                <>
                  <span className="data">{formatCents(atRiskCents).replace(/\.00$/, "")}</span> of contract value not
                  compliant.{" "}
                </>
              ) : null}
              {capacity.limit !== null ? (
                <>
                  Free plan: <span className="tabular">{capacity.used}</span> of{" "}
                  <span className="tabular">{capacity.limit}</span> vendors.
                </>
              ) : null}
            </span>
          </>
        }
        actions={
          <VendorHeaderActions
            templates={data.templates}
            atLimit={capacity.atLimit}
            limit={capacity.limit}
            hasDemoVendors={data.hasDemoVendors}
            canRemoveDemo={role === "owner"}
          />
        }
      />

      {capacity.atLimit ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-saffron/50 bg-saffron/10 px-4 py-3 text-sm text-[color-mix(in_oklch,var(--saffron),var(--graphite)_60%)]"
        >
          You&apos;ve reached the Free plan&apos;s {capacity.limit} vendors, so adding is paused.{" "}
          <Link href="/billing" className="font-medium underline underline-offset-3">
            Upgrade to Pro
          </Link>{" "}
          for unlimited vendors.
        </p>
      ) : null}

      {data.rows.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add a subcontractor with its contact and requirements, or load the demo roster: 8 vendors with synthetic ACORD 25 certificates covering every status."
        />
      ) : (
        <>
          <nav aria-label="Filter vendors by status" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-1 rounded-lg bg-muted p-[3px]">
              {STATUS_FILTERS.map((filter) => {
                const active = filter === status;
                const count = counts[filter];
                return (
                  <li key={filter}>
                    <Link
                      href={filter === "all" ? "/vendors" : `/vendors?status=${filter}`}
                      scroll={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                        active && "bg-background text-foreground shadow-sm",
                      )}
                    >
                      {FILTER_LABELS[filter]}
                      <span className={cn("data text-xs", count > 0 && COUNT_TONE[filter], count === 0 && "opacity-60")}>
                        {count}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {rows.length === 0 ? (
            <EmptyState
              className="py-10"
              title={`No ${FILTER_LABELS[status].toLowerCase()} vendors`}
              description={
                <Link href="/vendors" className="underline underline-offset-3">
                  Show all vendors
                </Link>
              }
            />
          ) : (
            <VendorList rows={rows} today={data.today} timeZone={org.timezone || "UTC"} now={data.now} />
          )}
        </>
      )}
    </>
  );
}
