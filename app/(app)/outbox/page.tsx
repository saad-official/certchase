import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { KindChip, StatusChip, type StatusTone } from "@/components/queue/chips";
import { formatDateTime } from "@/components/queue/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOrgContext } from "@/lib/db/queries";
import { optionalEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { MessageSheet, type OutboxMessage } from "./message-sheet";

export const metadata: Metadata = { title: "Outbox" };

const PROVIDER_LABELS: Record<string, string> = {
  outbox: "Stored (demo)",
  resend: "Resend",
};

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  queued: { label: "Stored", tone: "missing" },
  sent: { label: "Sent", tone: "neutral" },
  delivered: { label: "Delivered", tone: "compliant" },
  failed: { label: "Failed", tone: "expired" },
};

function currentMode(): string {
  if (!optionalEnv("RESEND_API_KEY")) return "Right now nothing leaves the app: every approved email is stored here.";
  if (optionalEnv("EMAIL_DEMO_RECIPIENT")) {
    return "Right now Resend is on in demo mode: emails go to the owner's inbox, not to brokers or vendors.";
  }
  return "Right now Resend is on: emails go to brokers and vendor contacts.";
}

export default async function OutboxPage() {
  const { org } = await requireOrgContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outbox")
    .select("id, touch_id, to_email, subject, text, html, provider, status, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load the outbox: ${error.message}`);
  const rows = data ?? [];

  // Vendor and chase kind for each row: touches, then vendors, batch-loaded through RLS.
  const touchIds = [...new Set(rows.map((r) => r.touch_id))];
  const touchesRes =
    touchIds.length > 0
      ? await supabase.from("chase_touches").select("id, vendor_id, kind").eq("org_id", org.id).in("id", touchIds)
      : { data: [], error: null };
  if (touchesRes.error) throw new Error(`Could not load the outbox: ${touchesRes.error.message}`);
  const touches = new Map((touchesRes.data ?? []).map((t) => [t.id, t]));
  const vendorIds = [...new Set((touchesRes.data ?? []).map((t) => t.vendor_id))];
  const vendorsRes =
    vendorIds.length > 0
      ? await supabase.from("vendors").select("id, name").eq("org_id", org.id).in("id", vendorIds)
      : { data: [], error: null };
  if (vendorsRes.error) throw new Error(`Could not load the outbox: ${vendorsRes.error.message}`);
  const vendorNames = new Map((vendorsRes.data ?? []).map((v) => [v.id, v.name]));

  const timezone = org.timezone || "UTC";

  return (
    <>
      <PageHeader
        title="Outbox"
        description="Every chase email CertChase has sent for you, exactly as the broker or vendor received it."
      />

      <p className="-mt-2 mb-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Demo mode: no email leaves the app unless <code className="data text-foreground">RESEND_API_KEY</code> is set,
        and with <code className="data text-foreground">EMAIL_DEMO_RECIPIENT</code> also set every message goes to the
        owner&rsquo;s inbox instead of the broker. {currentMode()}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing sent yet"
          description="Approved chase emails are delivered and kept here, so you can always check what went out and when."
          action={
            <Button asChild variant="outline">
              <Link href="/queue">Open the queue</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg bg-card shadow-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden pl-4 md:table-cell">Vendor / to</TableHead>
                <TableHead className="pl-4 md:pl-2">Subject</TableHead>
                <TableHead className="hidden lg:table-cell">Provider</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="w-0 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const touch = touches.get(row.touch_id);
                const vendorName = touch ? (vendorNames.get(touch.vendor_id) ?? null) : null;
                const providerLabel = PROVIDER_LABELS[row.provider] ?? row.provider;
                const status = STATUS[row.status] ?? { label: row.status, tone: "missing" as const };
                const createdLabel = formatDateTime(row.created_at, timezone);
                const message: OutboxMessage = {
                  id: row.id,
                  vendorName,
                  toEmail: row.to_email,
                  subject: row.subject,
                  text: row.text,
                  html: row.html,
                  createdLabel,
                  providerLabel,
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell className="hidden max-w-56 py-3 pl-4 align-top whitespace-normal md:table-cell">
                      <p className="truncate font-medium">{vendorName ?? "Deleted vendor"}</p>
                      <p className="data truncate text-xs text-muted-foreground">{row.to_email}</p>
                    </TableCell>
                    <TableCell className="w-full max-w-0 py-3 pl-4 align-top whitespace-normal md:pl-2">
                      <p className="truncate">{row.subject}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {touch ? <KindChip kind={touch.kind} className="text-[0.7rem]" /> : null}
                        <span className="text-xs text-muted-foreground md:hidden">
                          {vendorName ?? "Deleted vendor"} · <span className="data">{row.to_email}</span>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                        {status.label} · <span className="data">{createdLabel}</span>
                      </p>
                    </TableCell>
                    <TableCell className="hidden align-top lg:table-cell">
                      <Badge variant={row.provider === "resend" ? "outline" : "secondary"} className="h-6 px-2.5">
                        {providerLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden align-top sm:table-cell">
                      <StatusChip tone={status.tone}>{status.label}</StatusChip>
                    </TableCell>
                    <TableCell className="data hidden align-top text-muted-foreground sm:table-cell">
                      {createdLabel}
                    </TableCell>
                    <TableCell className="pr-4 text-right align-top">
                      <MessageSheet message={message} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
