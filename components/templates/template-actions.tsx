"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplateAction, makeDefaultTemplateAction } from "@/app/(app)/templates/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/vendors/confirm-dialog";

export function TemplateActions({
  templateId,
  name,
  isDefault,
  vendorCount,
  canDelete,
}: {
  templateId: string;
  name: string;
  isDefault: boolean;
  vendorCount: number;
  /** Owner role (RLS allows only owners to delete templates). */
  canDelete: boolean;
}) {
  const router = useRouter();
  const [defaulting, startDefault] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteBlocked = isDefault
    ? "The default template can't be deleted."
    : vendorCount > 0
      ? `Reassign the ${vendorCount} ${vendorCount === 1 ? "vendor" : "vendors"} using it first.`
      : !canDelete
        ? "Only the owner can delete templates."
        : null;

  return (
    <>
      {isDefault ? null : (
        <Button
          variant="outline"
          disabled={defaulting}
          onClick={() =>
            startDefault(async () => {
              const result = await makeDefaultTemplateAction(templateId);
              if (result.ok) toast.success(result.message ?? "Default changed.");
              else toast.error(result.error ?? "Could not change the default.");
            })
          }
        >
          {defaulting ? <Loader2 className="animate-spin" aria-hidden /> : <Star aria-hidden />}
          Make default
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={deleting || deleteBlocked !== null}
        title={deleteBlocked ?? undefined}
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${name}?`}
        description="No vendor uses this template, so nothing is re-evaluated. This cannot be undone."
        confirmLabel="Delete template"
        pendingLabel="Deleting"
        pending={deleting}
        destructive
        onConfirm={() =>
          startDelete(async () => {
            const result = await deleteTemplateAction(templateId);
            if (result.ok) {
              toast.success(result.message ?? "Template deleted.");
              setConfirmOpen(false);
              router.push("/templates");
            } else {
              toast.error(result.error ?? "Could not delete the template.");
            }
          })
        }
      />
    </>
  );
}
