"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateVendorAction } from "@/app/(app)/vendors/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { initialActionResult, type ActionResult } from "./action-result";
import { FormError, SubmitButton } from "./form-parts";
import { VendorFormFields, type TemplateChoice, type VendorFormDefaults } from "./vendor-form-fields";

export function VendorDetailsCard({
  vendorId,
  templates,
  defaults,
}: {
  vendorId: string;
  templates: TemplateChoice[];
  defaults: VendorFormDefaults;
}) {
  const [state, setState] = useState<ActionResult>(initialActionResult);
  const [pending, startTransition] = useTransition();
  // Remount the fields after a save so they pick up the stored (normalised) values.
  const [version, setVersion] = useState(0);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateVendorAction(vendorId, formData);
      setState(result);
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        setVersion((v) => v + 1);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Changing the requirements re-evaluates the current certificate; turning on do-not-contact pauses chasing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError message={state.error} />
          <VendorFormFields
            key={version}
            templates={templates}
            defaults={defaults}
            errors={state.fieldErrors}
            withNotes
            idPrefix="edit-vendor"
          />
          <div className="flex justify-end">
            <SubmitButton pending={pending} pendingLabel="Saving">
              Save details
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
