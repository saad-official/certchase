import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChasePanel } from "@/components/vendors/chase-panel";
import { formatCalendarDate, relativeDays } from "@/components/vendors/format";
import { NeedsReviewChip, StatusChip } from "@/components/vendors/status-chip";
import { UploadCertificate } from "@/components/vendors/upload-certificate";
import { VendorCertificates } from "@/components/vendors/vendor-certificates";
import { VendorDetailsCard } from "@/components/vendors/vendor-details-card";
import { VendorTimeline } from "@/components/vendors/vendor-timeline";
import { requireOrgContext } from "@/lib/db/queries";
import { formatCents } from "@/lib/domain/normalize";
import { loadVendorDetail } from "../data";

export const metadata: Metadata = { title: "Vendor" };
// Upload + extraction run as Server Actions on this page.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { org } = await requireOrgContext();
  const data = await loadVendorDetail(org, id);
  if (!data) notFound();

  const { vendor, overview, cadence, pendingDraft } = data;
  const timeZone = org.timezone || "UTC";
  const status = overview?.status ?? "missing";
  const templateName = data.templates.find((t) => t.id === vendor.template_id)?.name ?? overview?.templateName ?? "—";
  const latest = data.certificates.find((c) => c.status !== "superseded") ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/vendors"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Vendors
      </Link>

      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-3xl leading-tight tracking-tight break-words">{vendor.name}</h1>
          <StatusChip status={status} />
          {overview?.needsReview && latest ? (
            <Link href={`/certificates/${latest.id}`}>
              <NeedsReviewChip />
            </Link>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Trade">{vendor.trade ?? "—"}</Stat>
          <Stat label="Contract value">
            <span className="data">{formatCents(vendor.contract_value_cents).replace(/\.00$/, "")}</span>
          </Stat>
          <Stat label="Requirements">
            <Link href={`/templates/${vendor.template_id}`} className="block truncate hover:underline">
              {templateName}
            </Link>
          </Stat>
          <Stat label="Earliest expiration">
            {overview?.earliestExpiration ? (
              <>
                <span className="data">{formatCalendarDate(overview.earliestExpiration)}</span>{" "}
                <span className="text-xs text-muted-foreground">{relativeDays(overview.earliestExpiration, data.today)}</span>
              </>
            ) : (
              "—"
            )}
          </Stat>
          <Stat label="Contact">
            <span className="data block truncate text-xs">{vendor.contact_email}</span>
          </Stat>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <VendorCertificates certificates={data.certificates} today={data.today} timeZone={timeZone} />
          <UploadCertificate vendorId={vendor.id} />
          <VendorDetailsCard
            vendorId={vendor.id}
            templates={data.templates}
            defaults={{
              name: vendor.name,
              contactEmail: vendor.contact_email,
              brokerName: vendor.broker_name,
              brokerEmail: vendor.broker_email,
              trade: vendor.trade,
              contractValueCents: vendor.contract_value_cents,
              templateId: vendor.template_id,
              doNotContact: vendor.do_not_contact,
              notes: vendor.notes,
            }}
          />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <ChasePanel
            vendorId={vendor.id}
            cadence={
              cadence
                ? {
                    kind: cadence.kind,
                    step: cadence.step,
                    status: cadence.status,
                    nextRunAt: cadence.next_run_at,
                    pauseReason: cadence.pause_reason,
                  }
                : null
            }
            draft={
              pendingDraft
                ? {
                    id: pendingDraft.id,
                    subject: pendingDraft.subject,
                    kind: pendingDraft.kind,
                    status: pendingDraft.status,
                    toEmail: pendingDraft.to_email,
                    confidence: Number(pendingDraft.confidence),
                    createdAt: pendingDraft.created_at,
                  }
                : null
            }
            doNotContact={vendor.do_not_contact}
            recipient={vendor.broker_email ?? vendor.contact_email}
            timeZone={timeZone}
            now={data.now}
          />
          <VendorTimeline events={data.events} timeZone={timeZone} />
        </div>
      </div>
    </div>
  );
}
