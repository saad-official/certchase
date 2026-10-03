"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createVendorAction } from "@/app/(app)/vendors/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialActionResult, type ActionResult } from "./action-result";
import { FormError, SubmitButton } from "./form-parts";
import { VendorFormFields, type TemplateChoice } from "./vendor-form-fields";

export function AddVendorDialog({ templates, disabled }: { templates: TemplateChoice[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        <Button disabled={disabled}>
          <Plus aria-hidden />
          Add vendor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Add a vendor</DialogTitle>
          <DialogDescription>
            The vendor starts as missing. CertChase plans a certificate request as soon as you save.
          </DialogDescription>
        </DialogHeader>
        <AddVendorForm templates={templates} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AddVendorForm({ templates, onDone }: { templates: TemplateChoice[]; onDone: () => void }) {
  const [state, setState] = useState<ActionResult>(initialActionResult);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createVendorAction(formData);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Vendor added.");
        onDone();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError message={state.error} />
      <VendorFormFields templates={templates} errors={state.fieldErrors} idPrefix="new-vendor" />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <SubmitButton pending={pending} pendingLabel="Adding" disabled={templates.length === 0}>
          Add vendor
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
