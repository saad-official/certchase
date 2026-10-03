import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { CertificateList, type CertificateListRow } from "@/components/certificates/certificate-list";
import { Button } from "@/components/ui/button";
import { todayInZone } from "@/components/vendors/format";
import { parseEvaluation } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificates" };

const LIST_LIMIT = 500;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { org } = await requireOrgContext();
  const review = (await searchParams).review;
  const reviewOnly = (Array.isArray(review) ? review[0] : review) === "1";

  const supabase = await createClient();
  const [certificatesRes, vendorsRes, reviewCountRes] = await Promise.all([
    (() => {
      let query = supabase
        .from("certificates")
        .select("id, vendor_id, file_name, status, source, evaluation, earliest_expiration, needs_review, created_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      if (reviewOnly) query = query.eq("needs_review", true).eq("status", "extracted");
      return query;
    })(),
    supabase.from("vendors").select("id, name").eq("org_id", org.id),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("needs_review", true)
      .eq("status", "extracted"),
  ]);
  if (certificatesRes.error) throw new Error(`list certificates: ${certificatesRes.error.message}`);
  if (vendorsRes.error) throw new Error(`list vendors: ${vendorsRes.error.message}`);

  const vendorNames = new Map(vendorsRes.data.map((v) => [v.id, v.name]));
  const rows: CertificateListRow[] = certificatesRes.data.map((c) => {
    const evaluation = parseEvaluation(c);
    return {
      id: c.id,
      vendorId: c.vendor_id,
      vendorName: vendorNames.get(c.vendor_id) ?? "Unknown vendor",
      fileName: c.file_name,
      status: c.status,
      source: c.source,
      evaluationStatus: evaluation?.status ?? null,
      gapCount: evaluation?.gaps.length ?? 0,
      earliestExpiration: c.earliest_expiration,
      needsReview: c.needs_review && c.status === "extracted",
      createdAt: c.created_at,
    };
  });
  const reviewCount = reviewCountRes.count ?? 0;
  const timeZone = org.timezone || "UTC";

  const tabs = [
    { href: "/certificates", label: "All", active: !reviewOnly, count: null as number | null },
    { href: "/certificates?review=1", label: "Needs review", active: reviewOnly, count: reviewCount },
  ];

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Every certificate on file, newest first. The newest one per vendor counts; older ones are superseded."
      />

      <nav aria-label="Filter certificates" className="mb-4">
        <ul className="flex w-max gap-1 rounded-lg bg-muted p-[3px]">
          {tabs.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                scroll={false}
                aria-current={tab.active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab.active && "bg-background text-foreground shadow-sm",
                )}
              >
                {tab.label}
                {tab.count !== null ? (
                  <span
                    className={cn(
                      "data text-xs",
                      tab.count > 0 ? "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_50%)]" : "opacity-60",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {rows.length === 0 ? (
        reviewOnly ? (
          <EmptyState
            className="py-10"
            title="Nothing to review"
            description="Every extracted field on current certificates is above the confidence threshold or already confirmed."
            action={
              <Button variant="outline" asChild>
                <Link href="/certificates">Show all certificates</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No certificates yet"
            description="Upload a certificate from a vendor's page, or load the demo vendors to see extraction and evaluation at work."
            action={
              <Button asChild>
                <Link href="/vendors">Go to vendors</Link>
              </Button>
            }
          />
        )
      ) : (
        <CertificateList rows={rows} today={todayInZone(new Date(), timeZone)} timeZone={timeZone} />
      )}
      {rows.length === LIST_LIMIT ? (
        <p className="mt-3 text-xs text-muted-foreground">Showing the newest {LIST_LIMIT} certificates.</p>
      ) : null}
    </>
  );
}
