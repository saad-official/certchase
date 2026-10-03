"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatLimit, parseLimitToCents } from "@/lib/domain/normalize";
import { Field, FieldShell } from "./form-parts";

export type TemplateChoice = { id: string; name: string; isDefault: boolean };

export type VendorFormDefaults = {
  name?: string;
  contactEmail?: string;
  brokerName?: string | null;
  brokerEmail?: string | null;
  trade?: string | null;
  contractValueCents?: number;
  templateId?: string;
  doNotContact?: boolean;
  notes?: string | null;
};

/** Live "= $1,200,000" read-back so the owner sees how the amount was understood. */
function AmountReadback({ value }: { value: string }) {
  if (!value.trim()) return <>Whole dollars; used for value-at-risk.</>;
  const cents = parseLimitToCents(value);
  return cents === null ? (
    <span className="text-destructive">Not a plain amount.</span>
  ) : (
    <span className="data">= {formatLimit(cents)}</span>
  );
}

/** Fields shared by the Add vendor dialog and the vendor details card. Names match the Server Actions. */
export function VendorFormFields({
  templates,
  defaults = {},
  errors = {},
  withNotes = false,
  idPrefix = "vendor",
}: {
  templates: TemplateChoice[];
  defaults?: VendorFormDefaults;
  errors?: Record<string, string>;
  withNotes?: boolean;
  idPrefix?: string;
}) {
  const fallbackTemplate = templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? "";
  const [templateId, setTemplateId] = useState(defaults.templateId ?? fallbackTemplate);
  const [amount, setAmount] = useState(
    defaults.contractValueCents ? formatLimit(defaults.contractValueCents) : "",
  );
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id={id("name")}
        name="name"
        label="Vendor name"
        defaultValue={defaults.name ?? ""}
        autoComplete="off"
        required
        className="sm:col-span-2"
        error={errors.name}
      />
      <Field
        id={id("contactEmail")}
        name="contactEmail"
        label="Contact email"
        type="email"
        inputMode="email"
        autoComplete="off"
        defaultValue={defaults.contactEmail ?? ""}
        required
        error={errors.contactEmail}
      />
      <Field
        id={id("trade")}
        name="trade"
        label="Trade"
        placeholder="Electrical"
        autoComplete="off"
        defaultValue={defaults.trade ?? ""}
        error={errors.trade}
      />
      <Field
        id={id("brokerName")}
        name="brokerName"
        label="Broker name"
        autoComplete="off"
        defaultValue={defaults.brokerName ?? ""}
        error={errors.brokerName}
      />
      <Field
        id={id("brokerEmail")}
        name="brokerEmail"
        label="Broker email"
        type="email"
        inputMode="email"
        autoComplete="off"
        defaultValue={defaults.brokerEmail ?? ""}
        hint="Chase emails go to the broker when known."
        error={errors.brokerEmail}
      />
      <Field
        id={id("contractValue")}
        name="contractValue"
        label="Contract value (USD)"
        inputMode="decimal"
        placeholder="250,000"
        autoComplete="off"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputClassName="data"
        hint={<AmountReadback value={amount} />}
        error={errors.contractValue}
      />
      <FieldShell id={id("templateId")} label="Requirements" error={errors.templateId}>
        <Select name="templateId" value={templateId || undefined} onValueChange={setTemplateId}>
          <SelectTrigger id={id("templateId")} className="w-full" aria-invalid={errors.templateId ? true : undefined}>
            <SelectValue placeholder="Choose a template" />
          </SelectTrigger>
          <SelectContent position="popper">
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
                {t.isDefault ? <span className="text-xs text-muted-foreground">default</span> : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldShell>
      {withNotes ? (
        <FieldShell id={id("notes")} label="Notes" error={errors.notes} className="sm:col-span-2">
          <Textarea id={id("notes")} name="notes" defaultValue={defaults.notes ?? ""} rows={2} maxLength={2000} />
        </FieldShell>
      ) : null}
      <div className="flex items-start gap-3 rounded-lg border border-dashed p-3 sm:col-span-2">
        <Switch id={id("doNotContact")} name="doNotContact" defaultChecked={defaults.doNotContact ?? false} className="mt-0.5" />
        <div className="grid gap-1">
          <Label htmlFor={id("doNotContact")}>Do not contact</Label>
          <p className="text-xs text-muted-foreground">
            CertChase tracks the certificate but never drafts chase emails for this vendor.
          </p>
        </div>
      </div>
    </div>
  );
}
