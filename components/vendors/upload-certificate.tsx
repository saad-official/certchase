"use client";

import { useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { extractCertificateAction } from "@/app/(app)/certificates/actions";
import { uploadCertificateAction } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { EvaluationActionResult } from "./action-result";
import { formatBytes, pluralize } from "./format";
import { NeedsReviewChip, StatusChip } from "./status-chip";

const ACCEPT = "application/pdf,image/png,image/jpeg";
const ACCEPTED = new Set(ACCEPT.split(","));
const MAX_BYTES = 10 * 1024 * 1024;

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "reading"; certificateId: string }
  | { kind: "done"; certificateId: string; result: EvaluationActionResult }
  | { kind: "failed"; certificateId?: string; message: string };

function checkFile(file: File): string | null {
  const typeOk = ACCEPTED.has(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
  if (!typeOk) return "Upload a PDF, PNG or JPEG certificate.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_BYTES) return "Certificates must be 10 MB or smaller.";
  return null;
}

/**
 * Two Server Actions so the progress is real: the first stores the file and
 * the certificate row, the second has the model read it and the rules judge it.
 */
export function UploadCertificate({ vendorId }: { vendorId: string }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [, startTransition] = useTransition();
  const busy = phase.kind === "uploading" || phase.kind === "reading";

  function choose(next: File | null) {
    if (!next) return;
    const problem = checkFile(next);
    if (problem) {
      toast.error(problem);
      return;
    }
    setFile(next);
    setPhase({ kind: "idle" });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    const formData = new FormData();
    formData.set("vendorId", vendorId);
    formData.set("file", file);
    setPhase({ kind: "uploading" });
    startTransition(async () => {
      let uploaded;
      try {
        uploaded = await uploadCertificateAction(formData);
      } catch (error) {
        // The request itself failed, most often the Server Action body limit.
        console.error(error);
        setPhase({
          kind: "failed",
          message: "The upload was rejected before it reached CertChase (the file may exceed the server's upload size limit).",
        });
        return;
      }
      if (!uploaded.ok || !uploaded.id) {
        setPhase({ kind: "failed", message: uploaded.error ?? "Could not upload the certificate." });
        return;
      }
      const certificateId = uploaded.id;
      setPhase({ kind: "reading", certificateId });
      const result = await extractCertificateAction(certificateId);
      if (result.ok) {
        setPhase({ kind: "done", certificateId, result });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        toast.success(result.message ?? "Certificate read.");
      } else {
        setPhase({ kind: "failed", certificateId, message: result.error ?? "Could not read the certificate." });
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Upload certificate</CardTitle>
        <CardDescription>ACORD 25 or similar. PDF, PNG or JPEG, up to 10 MB. The newest certificate counts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) choose(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors outline-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              dragging ? "border-cobalt bg-accent" : "hover:bg-muted/50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <FileUp className="size-5 text-muted-foreground" aria-hidden />
            {file ? (
              <span className="max-w-full truncate">
                <span className="data">{file.name}</span>{" "}
                <span className="text-muted-foreground">· {formatBytes(file.size)}</span>
              </span>
            ) : (
              <span>
                <span className="font-medium text-cobalt">Choose a file</span>{" "}
                <span className="text-muted-foreground">or drop it here</span>
              </span>
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              name="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </label>

          {busy ? (
            <div className="grid gap-1.5" role="status" aria-live="polite">
              <Progress value={phase.kind === "uploading" ? 35 : 75} className="h-1.5" />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {phase.kind === "uploading"
                  ? "Uploading to secure storage…"
                  : "Reading the certificate with the vision model and checking the rules…"}
              </p>
            </div>
          ) : null}

          {phase.kind === "done" ? <UploadResult certificateId={phase.certificateId} result={phase.result} /> : null}
          {phase.kind === "failed" ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-oxblood/30 bg-oxblood/5 px-3 py-2 text-sm text-oxblood">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="grid gap-1">
                <span>{phase.message}</span>
                {phase.certificateId ? (
                  <Link href={`/certificates/${phase.certificateId}`} className="text-xs underline underline-offset-3">
                    Open the certificate to retry
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={!file || busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}
              {phase.kind === "uploading" ? "Uploading" : phase.kind === "reading" ? "Reading" : "Upload and read"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UploadResult({ certificateId, result }: { certificateId: string; result: EvaluationActionResult }) {
  return (
    <div role="status" className="grid gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-verdigris" aria-hidden />
        Certificate read and evaluated
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {result.evaluationStatus ? <StatusChip status={result.evaluationStatus} /> : null}
        {result.gapCount ? <span className="text-xs text-muted-foreground">{pluralize(result.gapCount, "gap")}</span> : null}
        {result.needsReview ? <NeedsReviewChip /> : null}
        <Link href={`/certificates/${certificateId}`} className="ml-auto text-xs font-medium text-cobalt underline-offset-3 hover:underline">
          {result.needsReview ? "Review fields" : "View certificate"}
        </Link>
      </div>
    </div>
  );
}
