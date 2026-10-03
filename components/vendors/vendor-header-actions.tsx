"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearDemoVendorsAction, seedDemoVendorsAction } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddVendorDialog } from "./add-vendor-dialog";
import { ConfirmDialog } from "./confirm-dialog";
import type { TemplateChoice } from "./vendor-form-fields";

/** Disabled buttons swallow pointer events, so the tooltip hangs off a focusable wrapper. */
function DisabledHint({ hint, children }: { hint: React.ReactNode; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function VendorHeaderActions({
  templates,
  atLimit,
  limit,
  hasDemoVendors,
  canRemoveDemo,
}: {
  templates: TemplateChoice[];
  atLimit: boolean;
  limit: number | null;
  hasDemoVendors: boolean;
  canRemoveDemo: boolean;
}) {
  const add = <AddVendorDialog templates={templates} disabled={atLimit || templates.length === 0} />;
  return (
    <TooltipProvider>
      {atLimit ? (
        <DisabledHint hint={`Free plan limit reached (${limit ?? 10} vendors). Upgrade on Billing to add more.`}>
          {add}
        </DisabledHint>
      ) : templates.length === 0 ? (
        <DisabledHint hint="Create a requirement template first.">{add}</DisabledHint>
      ) : (
        add
      )}
      {atLimit ? (
        <Button variant="outline" asChild>
          <Link href="/billing">Upgrade</Link>
        </Button>
      ) : null}
      <DemoVendorControls hasDemoVendors={hasDemoVendors} canRemoveDemo={canRemoveDemo} />
    </TooltipProvider>
  );
}

function DemoVendorControls({ hasDemoVendors, canRemoveDemo }: { hasDemoVendors: boolean; canRemoveDemo: boolean }) {
  const [seeding, startSeed] = useTransition();
  const [clearing, startClear] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function seed() {
    startSeed(async () => {
      const result = await seedDemoVendorsAction();
      const s = result.seed;
      const how = s ? (s.usedModel ? "Read by the vision model." : "No vision key: fixture extractions stored.") : "";
      const errors = s?.errors ?? [];
      const description = (
        <div className="grid gap-1">
          {how ? <span>{how}</span> : null}
          {errors.length > 0 ? (
            <ul className="list-disc pl-4">
              {errors.slice(0, 4).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {errors.length > 4 ? <li>…and {errors.length - 4} more</li> : null}
            </ul>
          ) : null}
        </div>
      );
      if (result.ok && errors.length === 0) toast.success(result.message ?? "Demo vendors loaded.", { description });
      else if (result.ok) toast.warning(result.message ?? "Demo vendors loaded with errors.", { description, duration: 12000 });
      else toast.error(result.error ?? "Could not load the demo vendors.", { description: s ? description : undefined });
    });
  }

  function clear() {
    startClear(async () => {
      const result = await clearDemoVendorsAction();
      if (result.ok) {
        toast.success(result.message ?? "Demo vendors removed.");
        setConfirmOpen(false);
      } else {
        toast.error(result.error ?? "Could not remove the demo vendors.");
      }
    });
  }

  const loadButton = (
    <Button variant="secondary" onClick={seed} disabled={hasDemoVendors || seeding}>
      {seeding ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
      {seeding ? "Loading demo vendors" : "Load demo vendors"}
    </Button>
  );

  return (
    <>
      {hasDemoVendors ? <DisabledHint hint="Demo vendors are already loaded.">{loadButton}</DisabledHint> : loadButton}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More vendor actions">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem
            variant="destructive"
            disabled={!hasDemoVendors || !canRemoveDemo}
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            Remove demo vendors
            {!canRemoveDemo ? <span className="ml-auto text-xs text-muted-foreground">owner only</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove demo vendors?"
        description="This deletes the 8 demo vendors with their certificates, stored files, chase cadences and drafts. Your own vendors are not touched. The activity log keeps its history."
        confirmLabel="Remove demo vendors"
        pendingLabel="Removing"
        pending={clearing}
        destructive
        onConfirm={clear}
      />
    </>
  );
}
