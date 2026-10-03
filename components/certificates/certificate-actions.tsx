"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw, ScanText } from "lucide-react";
import { toast } from "sonner";
import { extractCertificateAction, reevaluateCertificateAction } from "@/app/(app)/certificates/actions";
import { Button } from "@/components/ui/button";

export function ReevaluateButton({ certificateId, disabled }: { certificateId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await reevaluateCertificateAction(certificateId);
          if (result.ok) toast.success(result.message ?? "Re-evaluated.");
          else toast.error(result.error ?? "Could not re-evaluate.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Re-evaluate
    </Button>
  );
}

export function RetryExtractionButton({ certificateId, label = "Retry extraction" }: { certificateId: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await extractCertificateAction(certificateId);
          if (result.ok) toast.success(result.message ?? "Certificate read.");
          else toast.error(result.error ?? "Extraction failed again.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ScanText aria-hidden />}
      {pending ? "Reading the certificate" : label}
    </Button>
  );
}
