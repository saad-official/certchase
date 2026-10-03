import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { MetricTiles } from "@/components/dashboard/metric-tiles";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatusDistribution } from "@/components/dashboard/status-distribution";
import { ExpiringSoon, NeedsReview } from "@/components/dashboard/vendor-lists";
import { Button } from "@/components/ui/button";
import { getQueueCount, requireOrgContext } from "@/lib/db/queries";
import { daysBetweenIsoDates, isoDateInZone } from "@/lib/domain/dates";
import { loadActivityFeed } from "@/lib/services/activity";
import { loadMetrics } from "@/lib/services/metrics";
import { loadNeedsReview } from "@/lib/services/review";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

function safeToday(now: Date, timezone: string): string {
  try {
    return isoDateInZone(now, timezone);
  } catch {
    return isoDateInZone(now, "UTC");
  }
}

export default async function DashboardPage() {
  const { org } = await requireOrgContext();
  const supabase = await createClient();
  const now = new Date();
  const today = safeToday(now, org.timezone || "UTC");

  const [{ metrics }, activity, queueCount, review] = await Promise.all([
    loadMetrics(supabase, org.id, today),
    loadActivityFeed(supabase, org.id, 15),
    getQueueCount(org.id),
    loadNeedsReview(supabase, org.id, 8),
  ]);

  const header = (
    <PageHeader
      title="Dashboard"
      description="Who is covered, who is not, and how much contract value sits on uncovered work."
    />
  );

  if (metrics.total === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="No vendors yet"
          description="Add your subcontractors and suppliers with the coverage each contract requires, or load eight demo vendors with synthetic ACORD 25 certificates covering every status."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/vendors">Add a vendor</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/vendors">Load demo vendors</Link>
              </Button>
            </div>
          }
        />
      </>
    );
  }

  const { counts } = metrics;

  return (
    <>
      {header}
      <MetricTiles
        data={{
          total: metrics.total,
          compliant: counts.compliant,
          compliantRate: metrics.compliantRate,
          valueAtRiskCents: metrics.valueAtRiskCents,
          expiringWithin30: metrics.expiringWithin30.length,
          deficientOrExpired: counts.deficient + counts.expired,
          missing: counts.missing,
          awaitingApproval: queueCount,
        }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Reported in contract dollars and days. Dates are read in {org.timezone || "UTC"}; today is{" "}
        <span className="data">{today}</span>.
      </p>

      <div className="mt-8">
        <StatusDistribution counts={counts} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ExpiringSoon
          rows={metrics.expiringWithin30.slice(0, 10).map((v) => ({
            id: v.id,
            name: v.name,
            trade: v.trade,
            earliestExpiration: v.earliestExpiration as string,
            days: daysBetweenIsoDates(today, v.earliestExpiration as string),
            contractValueCents: v.contractValueCents,
          }))}
        />
        <NeedsReview
          rows={review.map((r) => ({
            certificateId: r.certificateId,
            vendorName: r.vendorName,
            fileName: r.fileName,
            status: r.status,
            reviewFields: r.reviewFields,
          }))}
        />
      </div>

      <div className="mt-6">
        <RecentActivity events={activity} now={now} />
      </div>
    </>
  );
}
