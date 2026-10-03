import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { RetryExtractionButton } from "@/components/certificates/certificate-actions";
import { DocumentPane } from "@/components/certificates/document-pane";
import { EvaluationCard } from "@/components/certificates/evaluation-card";
import { ExtractionReview } from "@/components/certificates/extraction-review";
import { FixtureComparison } from "@/components/certificates/fixture-comparison";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp, SOURCE_LABELS, todayInZone } from "@/components/vendors/format";
import { CertificateStatusChip, NeedsReviewChip, StatusChip } from "@/components/vendors/status-chip";
import { parseEvaluation, parseExtraction } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { ExtractionSchema } from "@/lib/domain/types";
import { signedCertificateUrl } from "@/lib/services/storage";
import { getVendor } from "@/lib/services/vendors";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certificate" };
// Retry extraction and review run as Server Actions on this page.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** "gemini-3.5-flash-lite · extract-acord25/v1 · 2,140 → 610 tokens · 3.4 s" */
function describeMeta(meta: Record<string, unknown>): string | null {
  if (meta.source === "fixture") return "Fixture extraction (no vision model configured when it was loaded)";
  const tokensIn = num(meta.tokensIn);
  const tokensOut = num(meta.tokensOut);
  const latencyMs = num(meta.latencyMs);
  const parts = [
    str(meta.model),
    str(meta.promptVersion),
    tokensIn !== undefined && tokensOut !== undefined
      ? `${tokensIn.toLocaleString("en-US")} → ${tokensOut.toLocaleString("en-US")} tokens`
      : undefined,
    latencyMs !== undefined ? `${(latencyMs / 1000).toFixed(1)} s` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? `Read by ${parts.join(" · ")}` : null;
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { org } = await requireOrgContext();
  const supabase = await createClient();

  const { data: certificate, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (error) throw new Error(`load certificate: ${error.message}`);
  if (!certificate) notFound();

  const vendor = await getVendor(supabase, org.id, certificate.vendor_id);
  if (!vendor) notFound();
  const [templateRes, url] = await Promise.all([
    supabase
      .from("requirement_templates")
      .select("id, name")
      .eq("id", vendor.template_id)
      .eq("org_id", org.id)
      .maybeSingle(),
    signedCertificateUrl(supabase, certificate.storage_path).catch((e: unknown) => {
      console.error("sign certificate url failed", e);
      return null;
    }),
  ]);

  const timeZone = org.timezone || "UTC";
  const today = todayInZone(new Date(), timeZone);
  const extraction = parseExtraction(certificate);
  const evaluation = parseEvaluation(certificate);
  const meta = (certificate.extraction_meta ?? {}) as Record<string, unknown>;
  const fixture = ExtractionSchema.safeParse(meta.fixture);
  const metaLine = describeMeta(meta);
  const status = certificate.status;
  const canReview = status === "extracted" && extraction !== null;

  return (
    <div className="space-y-6">
      <Link
        href={`/vendors/${vendor.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {vendor.name}
      </Link>

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl leading-tight tracking-tight break-words sm:text-3xl">Certificate of insurance</h1>
          {status === "extracted" && evaluation ? <StatusChip status={evaluation.status} /> : <CertificateStatusChip status={status} />}
          {status === "superseded" ? <CertificateStatusChip status="superseded" /> : null}
          {certificate.needs_review && status === "extracted" ? <NeedsReviewChip /> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="data">{certificate.file_name}</span> · {SOURCE_LABELS[certificate.source] ?? certificate.source} ·{" "}
          uploaded{" "}
          <time dateTime={certificate.created_at} className="tabular">
            {formatTimestamp(certificate.created_at, timeZone)}
          </time>
        </p>
        {metaLine ? <p className="data text-xs text-muted-foreground">{metaLine}</p> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-6">
          {status === "failed" ? (
            <Card className="ring-oxblood/30">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-oxblood">
                  <TriangleAlert className="size-4" aria-hidden />
                  Extraction failed
                </CardTitle>
                <CardDescription>No verdict yet: the vendor reads as missing until this certificate is read.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <pre className="data overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs whitespace-pre-wrap text-oxblood">
                  {str(meta.error) ?? "The model returned no usable extraction."}
                </pre>
                <RetryExtractionButton certificateId={certificate.id} />
              </CardContent>
            </Card>
          ) : null}

          {status === "pending" ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Not read yet</CardTitle>
                <CardDescription>
                  The certificate was stored but extraction has not finished. If it does not complete, read it now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RetryExtractionButton certificateId={certificate.id} label="Read certificate" />
              </CardContent>
            </Card>
          ) : null}

          {evaluation && templateRes.data ? (
            <EvaluationCard
              certificateId={certificate.id}
              evaluation={evaluation}
              needsReview={certificate.needs_review}
              templateId={templateRes.data.id}
              templateName={templateRes.data.name}
              today={today}
              superseded={status === "superseded"}
            />
          ) : null}

          {extraction && fixture.success ? (
            <FixtureComparison model={extraction} fixture={fixture.data} reviewed={Boolean(certificate.reviewed_at)} />
          ) : null}

          {extraction ? (
            <ExtractionReview
              key={certificate.updated_at}
              certificateId={certificate.id}
              extraction={extraction}
              reviewFields={evaluation?.reviewFields ?? []}
              canReview={canReview}
              reviewedAt={certificate.reviewed_at}
              timeZone={timeZone}
            />
          ) : null}
        </div>

        <DocumentPane
          url={url}
          mimeType={certificate.mime_type}
          fileName={certificate.file_name}
          sizeBytes={certificate.size_bytes}
        />
      </div>
    </div>
  );
}
