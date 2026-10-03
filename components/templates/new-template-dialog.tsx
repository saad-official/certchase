"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTemplateAction } from "@/app/(app)/templates/actions";
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
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionResult, type ActionResult } from "@/components/vendors/action-result";
import { Field, FieldShell, FormError, SubmitButton } from "@/components/vendors/form-parts";

const DEFAULTS = "__defaults";

export function NewTemplateDialog({ templates }: { templates: { id: string; name: string; isDefault: boolean }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionResult>(initialActionResult);
  const [pending, startTransition] = useTransition();
  const [copyFrom, setCopyFrom] = useState<string>(templates.find((t) => t.isDefault)?.id ?? DEFAULTS);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("copyFromId", copyFrom === DEFAULTS ? "" : copyFrom);
    startTransition(async () => {
      const result = await createTemplateAction(formData);
      setState(result);
      if (result.ok && result.id) {
        toast.success(result.message ?? "Template created.");
        setOpen(false);
        router.push(`/templates/${result.id}`);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialActionResult);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          New template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">New requirement template</DialogTitle>
          <DialogDescription>Start from an existing template or the standard defaults, then edit the rules.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormError message={state.error} />
          <Field id="template-name" name="name" label="Name" placeholder="Vendor, low risk" autoComplete="off" required error={state.fieldErrors?.name} />
          <FieldShell id="template-copy-from" label="Start from" error={state.fieldErrors?.copyFromId}>
            <Select value={copyFrom} onValueChange={setCopyFrom}>
              <SelectTrigger id="template-copy-from" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Copy of {t.name}
                  </SelectItem>
                ))}
                {templates.length > 0 ? <SelectSeparator /> : null}
                <SelectItem value={DEFAULTS}>Standard defaults (GL $1M/$2M, Auto $1M, WC $1M)</SelectItem>
              </SelectContent>
            </Select>
          </FieldShell>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <SubmitButton pending={pending} pendingLabel="Creating">
              Create and edit
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
