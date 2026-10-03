"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { replanChaseAction } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";

export function ReplanChaseButton({ vendorId }: { vendorId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      className="w-fit"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await replanChaseAction(vendorId);
          if (result.ok) toast.success(result.message ?? "Chase re-planned.");
          else toast.error(result.error ?? "Could not re-plan the chase.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      Re-plan chase
    </Button>
  );
}
