"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveTemplateAction, type RulesFormInput } from "@/app/(app)/templates/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Field, FormError } from "@/components/vendors/form-parts";
import { formatLimit, parseLimitToCents } from "@/lib/domain/normalize";
import { DEFAULT_TEMPLATE_RULES, type TemplateRules } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type FormState = Required<RulesFormInput>;

function limitText(cents: number | undefined): string {
  return cents === undefined ? "" : formatLimit(cents);
}

function toForm(name: string, rules: TemplateRules): FormState {
  const d = DEFAULT_TEMPLATE_RULES;
  // Disabled coverages keep sensible starting limits so switching one on is one click.
  const gl = rules.generalLiability ?? d.generalLiability;
  const auto = rules.autoLiability ?? d.autoLiability;
  const wc = rules.workersComp ?? d.workersComp;
  const umbrella = rules.umbrella ?? { eachOccurrenceCents: 500_000_000 };
  return {
    name,
    generalLiability: {
      enabled: rules.generalLiability !== null,
      eachOccurrence: limitText(gl?.eachOccurrenceCents),
      aggregate: limitText(gl?.aggregateCents),
    },
    autoLiability: { enabled: rules.autoLiability !== null, combinedSingleLimit: limitText(auto?.combinedSingleLimitCents) },
    workersComp: { enabled: rules.workersComp !== null, eachAccident: limitText(wc?.eachAccidentCents) },
    umbrella: { enabled: rules.umbrella !== null, eachOccurrence: limitText(umbrella.eachOccurrenceCents) },
    additionalInsured: rules.additionalInsured,
    waiverOfSubrogation: rules.waiverOfSubrogation,
    primaryNonContributory: rules.primaryNonContributory,
    noticeOfCancellationDays: String(rules.noticeOfCancellationDays),
    certificateHolderMustMatch: rules.certificateHolderMustMatch,
  };
}

function LimitInput({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
}) {
  const cents = value.trim() ? parseLimitToCents(value) : null;
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="1,000,000"
        className="data"
        aria-invalid={error ? true : undefined}
      />
      <span className={cn("data text-[0.7rem]", error || (value.trim() && cents === null) ? "text-destructive" : "text-muted-foreground")}>
        {error ?? (value.trim() ? (cents === null ? "not a plain amount" : `= ${formatLimit(cents)}`) : "e.g. 1,000,000 or $1M")}
      </span>
    </div>
  );
}

function CoverageBlock({
  id,
  title,
  description,
  enabled,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-3 rounded-lg border p-3 transition-colors", enabled ? "bg-card" : "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <Switch id={id} checked={enabled} onCheckedChange={onToggle} className="mt-0.5" />
        <div className="grid gap-0.5">
          <Label htmlFor={id}>{title}</Label>
          <p className="text-xs text-muted-foreground">{enabled ? description : "Not required."}</p>
        </div>
      </div>
      {enabled ? <div className="grid gap-3 sm:grid-cols-2">{children}</div> : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function RulesEditor({
  templateId,
  name,
  rules,
  legalName,
  vendorCount,
}: {
  templateId: string;
  name: string;
  rules: TemplateRules;
  /** The org's legal name, matched against the certificate holder. */
  legalName: string;
  vendorCount: number;
}) {
  const initial = useMemo(() => toForm(name, rules), [name, rules]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setIn = <K extends "generalLiability" | "autoLiability" | "workersComp" | "umbrella">(
    key: K,
    patch: Partial<FormState[K]>,
  ) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveTemplateAction(templateId, form);
      if (result.ok) {
        toast.success(result.message ?? "Template saved.", { duration: 8000 });
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        toast.error(result.error ?? "Could not save the template.");
      }
    });
  }

  return (
    <form onSubmit={save} className="grid gap-6" noValidate>
      <FormError message={formError} />
      <Field
        id="template-name"
        label="Template name"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        error={errors.name}
        className="max-w-md"
        autoComplete="off"
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Coverage</CardTitle>
          <CardDescription>
            Each required policy must be present, unexpired and at or above these limits. Amounts in US dollars.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <CoverageBlock
            id="rule-gl"
            title="General liability"
            description="Each occurrence and general aggregate."
            enabled={form.generalLiability.enabled}
            onToggle={(enabled) => setIn("generalLiability", { enabled })}
          >
            <LimitInput
              id="rule-gl-each"
              label="Each occurrence"
              value={form.generalLiability.eachOccurrence}
              onChange={(eachOccurrence) => setIn("generalLiability", { eachOccurrence })}
              disabled={!form.generalLiability.enabled}
              error={errors["generalLiability.eachOccurrence"]}
            />
            <LimitInput
              id="rule-gl-agg"
              label="General aggregate"
              value={form.generalLiability.aggregate}
              onChange={(aggregate) => setIn("generalLiability", { aggregate })}
              disabled={!form.generalLiability.enabled}
              error={errors["generalLiability.aggregate"]}
            />
          </CoverageBlock>
          <CoverageBlock
            id="rule-auto"
            title="Automobile liability"
            description="Combined single limit."
            enabled={form.autoLiability.enabled}
            onToggle={(enabled) => setIn("autoLiability", { enabled })}
          >
            <LimitInput
              id="rule-auto-csl"
              label="Combined single limit"
              value={form.autoLiability.combinedSingleLimit}
              onChange={(combinedSingleLimit) => setIn("autoLiability", { combinedSingleLimit })}
              disabled={!form.autoLiability.enabled}
              error={errors["autoLiability.combinedSingleLimit"]}
            />
          </CoverageBlock>
          <CoverageBlock
            id="rule-wc"
            title="Workers' compensation"
            description="Statutory coverage plus employer's liability each accident."
            enabled={form.workersComp.enabled}
            onToggle={(enabled) => setIn("workersComp", { enabled })}
          >
            <LimitInput
              id="rule-wc-each"
              label="E.L. each accident"
              value={form.workersComp.eachAccident}
              onChange={(eachAccident) => setIn("workersComp", { eachAccident })}
              disabled={!form.workersComp.enabled}
              error={errors["workersComp.eachAccident"]}
            />
          </CoverageBlock>
          <CoverageBlock
            id="rule-umbrella"
            title="Umbrella / excess"
            description="Each occurrence."
            enabled={form.umbrella.enabled}
            onToggle={(enabled) => setIn("umbrella", { enabled })}
          >
            <LimitInput
              id="rule-umbrella-each"
              label="Each occurrence"
              value={form.umbrella.eachOccurrence}
              onChange={(eachOccurrence) => setIn("umbrella", { eachOccurrence })}
              disabled={!form.umbrella.enabled}
              error={errors["umbrella.eachOccurrence"]}
            />
          </CoverageBlock>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Endorsements</CardTitle>
            <CardDescription>Checked on the general liability policy.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <ToggleRow
              id="rule-ai"
              label="Additional insured"
              description="The certificate holder is named as additional insured."
              checked={form.additionalInsured}
              onChange={(v) => set("additionalInsured", v)}
            />
            <ToggleRow
              id="rule-wos"
              label="Waiver of subrogation"
              description="The insurer waives subrogation in favour of the holder."
              checked={form.waiverOfSubrogation}
              onChange={(v) => set("waiverOfSubrogation", v)}
            />
            <ToggleRow
              id="rule-pnc"
              label="Primary and non-contributory"
              description="The vendor's policy pays first, without contribution from yours."
              checked={form.primaryNonContributory}
              onChange={(v) => set("primaryNonContributory", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Terms</CardTitle>
            <CardDescription>Notice of cancellation and the certificate holder.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field
              id="rule-notice"
              label="Notice of cancellation (days)"
              inputMode="numeric"
              value={form.noticeOfCancellationDays}
              onChange={(e) => set("noticeOfCancellationDays", e.target.value)}
              inputClassName="data max-w-28"
              hint="0 = not required."
              error={errors.noticeOfCancellationDays}
            />
            <ToggleRow
              id="rule-holder"
              label="Holder must match"
              description={
                <>
                  The certificate holder must match <span className="data">{legalName}</span> (normalised: case,
                  punctuation and legal suffixes ignored).
                </>
              }
              checked={form.certificateHolderMustMatch}
              onChange={(v) => set("certificateHolderMustMatch", v)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? "Unsaved changes. " : ""}
          Saving re-evaluates the current certificate of{" "}
          <span className="tabular">{vendorCount}</span> {vendorCount === 1 ? "vendor" : "vendors"} on this template (up to 50).
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={() => setForm(initial)}>
            Discard
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
            {pending ? "Saving and re-evaluating" : "Save rules"}
          </Button>
        </div>
      </div>
    </form>
  );
}
