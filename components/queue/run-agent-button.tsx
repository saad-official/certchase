"use client";

import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { runAgentNow } from "@/app/(app)/queue/actions";
import { Button } from "@/components/ui/button";

/** Runs one agent tick for this organization: re-checks expiries, drafts due chase steps, sends approved emails. */
export function RunAgentButton() {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runAgentNow();
      if (!result.ok) {
        toast.error("The agent could not run", { description: result.error });
        return;
      }
      const headline = `Agent run: ${result.drafted} drafted · ${result.sent} sent · ${result.skipped} skipped`;
      const detail = `${result.reevaluated} ${result.reevaluated === 1 ? "certificate" : "certificates"} re-checked in ${(result.durationMs / 1000).toFixed(1)}s.`;
      if (result.errors.length > 0) {
        toast.warning(headline, {
          description: `${result.errors.length} ${result.errors.length === 1 ? "error" : "errors"}: ${result.errors[0]}`,
        });
      } else if (result.drafted + result.sent + result.skipped === 0) {
        toast.message(headline, {
          description: `${detail} Nothing was due: chase steps run at day 0, +7 and +14, and renewals at 30, 14 and 7 days before expiry.`,
        });
      } else {
        toast.success(headline, { description: detail });
      }
    });
  }

  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      <Play aria-hidden />
      {pending ? "Running" : "Run agent now"}
    </Button>
  );
}
