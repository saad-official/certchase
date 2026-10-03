"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCheck, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { confirmReviewAction, type ReviewInput } from "@/app/(app)/certificates/actions";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatTimestamp, pluralize } from "@/components/vendors/format";
import { formatLimit, parseLimitToCents } from "@/lib/domain/normalize";
import { POLICY_TYPES, type Extraction, type LimitField, type PolicyType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { ConfidenceMeter } from "./confidence-meter";
import {
  ENDORSEMENT_FIELDS,
  ENDORSEMENT_LABELS,
  formatBool,
  formatMaybeDate,
  formatMaybeLimit,
  LIMIT_LABELS,
  limitFieldsFor,
  lookup,
  LOW_CONFIDENCE,
  normalizeConfidence,
  normalizeEvidence,
  POLICY_TYPE_LABELS,
  POLICY_TYPE_SHORT,
} from "./fields";

type FieldKind = "text" | "number" | "date" | "money" | "tri" | "type";

type FieldDef = {
  path: string;
  label: string;
  kind: FieldKind;
  /** ReviewCorrections can change it (producer and issue date are read-only). */
  correctable: boolean;
  display: string;
  initial: string;
  mono?: boolean;
};

const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30";

function tri(value: boolean | null | undefined): string {
  return value === true ? "yes" : value === false ? "no" : "blank";
}

function buildDefs(extraction: Extraction) {
  const parties: FieldDef[] = [
    { path: "insuredName", label: "Insured", kind: "text", correctable: true, display: extraction.insuredName, initial: extraction.insuredName },
    { path: "producerName", label: "Producer", kind: "text", correctable: false, display: extraction.producerName, initial: extraction.producerName },
    {
      path: "certificateHolderName",
      label: "Certificate holder",
      kind: "text",
      correctable: true,
      display: extraction.certificateHolderName ?? "Not shown",
      initial: extraction.certificateHolderName ?? "",
    },
    {
      path: "issueDate",
      label: "Issue date",
      kind: "date",
      correctable: false,
      display: formatMaybeDate(extraction.issueDate),
      initial: extraction.issueDate ?? "",
      mono: true,
    },
    {
      path: "noticeOfCancellationDays",
      label: "Notice of cancellation (days)",
      kind: "number",
      correctable: true,
      display: extraction.noticeOfCancellationDays === null ? "Not shown" : `${extraction.noticeOfCancellationDays} days`,
      initial: extraction.noticeOfCancellationDays === null ? "" : String(extraction.noticeOfCancellationDays),
      mono: true,
    },
  ];
  if (extraction.producerEmail) {
    parties.splice(2, 0, {
      path: "producerEmail",
      label: "Producer email",
      kind: "text",
      correctable: false,
      display: extraction.producerEmail,
      initial: extraction.producerEmail,
      mono: true,
    });
  }

  const policies = extraction.policies.map((policy, i) => {
    const base = `policies.${i}`;
    const typeDef: FieldDef = {
      path: `${base}.type`,
      label: "Coverage",
      kind: "type",
      correctable: true,
      display: POLICY_TYPE_LABELS[policy.type],
      initial: policy.type,
    };
    const fields: FieldDef[] = [
      { path: `${base}.insurer`, label: "Insurer", kind: "text", correctable: true, display: policy.insurer ?? "Not shown", initial: policy.insurer ?? "" },
      {
        path: `${base}.policyNumber`,
        label: "Policy number",
        kind: "text",
        correctable: true,
        display: policy.policyNumber ?? "Not shown",
        initial: policy.policyNumber ?? "",
        mono: true,
      },
      {
        path: `${base}.effectiveDate`,
        label: "Effective",
        kind: "date",
        correctable: true,
        display: formatMaybeDate(policy.effectiveDate),
        initial: policy.effectiveDate ?? "",
        mono: true,
      },
      {
        path: `${base}.expirationDate`,
        label: "Expiration",
        kind: "date",
        correctable: true,
        display: formatMaybeDate(policy.expirationDate),
        initial: policy.expirationDate ?? "",
        mono: true,
      },
      ...limitFieldsFor(policy).map(
        (field): FieldDef => ({
          path: `${base}.limits.${field}`,
          label: LIMIT_LABELS[field],
          kind: "money",
          correctable: true,
          display: formatMaybeLimit(policy.limits[field]),
          initial: policy.limits[field] === null || policy.limits[field] === undefined ? "" : formatLimit(policy.limits[field]),
          mono: true,
        }),
      ),
      ...ENDORSEMENT_FIELDS.map(
        (field): FieldDef => ({
          path: `${base}.${field}`,
          label: ENDORSEMENT_LABELS[field],
          kind: "tri",
          correctable: true,
          display: formatBool(policy[field]),
          initial: tri(policy[field]),
        }),
      ),
    ];
    return { index: i, type: policy.type, typeDef, fields };
  });
  return { parties, policies };
}

/** Writes one field value into the review payload by its dotted path. */
function assign(input: ReviewInput & { policies: NonNullable<ReviewInput["policies"]> }, path: string, value: string) {
  const parts = path.split(".");
  if (parts[0] !== "policies") {
    if (path === "insuredName") input.insuredName = value;
    else if (path === "certificateHolderName") input.certificateHolderName = value;
    else if (path === "noticeOfCancellationDays") input.noticeOfCancellationDays = value;
    return;
  }
  const entry = input.policies[Number(parts[1])];
  if (!entry) return;
  if (parts[2] === "limits") {
    entry.limits = { ...(entry.limits ?? {}), [parts[3] as LimitField]: value };
    return;
  }
  switch (parts[2]) {
    case "type":
      entry.type = value as PolicyType;
      break;
    case "insurer":
      entry.insurer = value;
      break;
    case "policyNumber":
      entry.policyNumber = value;
      break;
    case "effectiveDate":
      entry.effectiveDate = value;
      break;
    case "expirationDate":
      entry.expirationDate = value;
      break;
    case "additionalInsured":
    case "waiverOfSubrogation":
    case "primaryNonContributory":
      entry[parts[2]] = value as "yes" | "no" | "blank";
      break;
  }
}

export function ExtractionReview({
  certificateId,
  extraction,
  reviewFields,
  canReview,
  reviewedAt,
  timeZone,
}: {
  certificateId: string;
  extraction: Extraction;
  /** Field paths the rule engine flagged (blank where it matters, or low confidence). */
  reviewFields: string[];
  canReview: boolean;
  reviewedAt: string | null;
  timeZone: string;
}) {
  const defs = useMemo(() => buildDefs(extraction), [extraction]);
  const confidence = useMemo(() => normalizeConfidence(extraction.fieldConfidence), [extraction]);
  const evidence = useMemo(() => normalizeEvidence(extraction.evidence), [extraction]);
  const reviewSet = useMemo(() => new Set(reviewFields.map((f) => f.replace(/\[(\d+)\]/g, ".$1"))), [reviewFields]);

  const allDefs = useMemo(
    () => [...defs.parties, ...defs.policies.flatMap((p) => [p.typeDef, ...p.fields])],
    [defs],
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allDefs.map((d) => [d.path, d.initial])),
  );
  const [editAll, setEditAll] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const confidenceOf = (path: string) => lookup(confidence, path);
  const isFlagged = (path: string) => {
    const c = confidenceOf(path);
    return (c !== undefined && c < LOW_CONFIDENCE) || reviewSet.has(path);
  };
  const flagged = allDefs.filter((d) => isFlagged(d.path));
  const changed = allDefs.filter((d) => d.correctable && values[d.path] !== d.initial);
  const isEditing = (def: FieldDef) => canReview && def.correctable && (editAll || isFlagged(def.path));

  function submit() {
    const input: ReviewInput & { policies: NonNullable<ReviewInput["policies"]> } = {
      // One entry per policy so server error paths ("policies.1.expirationDate") line up with ours.
      policies: extraction.policies.map((_, index) => ({ index })),
    };
    for (const def of allDefs) {
      if (!def.correctable) continue;
      // Flagged fields are confirmed as shown (or as corrected); others only when changed.
      if (isFlagged(def.path) || values[def.path] !== def.initial) assign(input, def.path, values[def.path]);
    }
    setErrors({});
    setFormError(undefined);
    startTransition(async () => {
      const result = await confirmReviewAction(certificateId, input);
      if (result.ok) {
        toast.success(result.message ?? "Review confirmed.");
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        toast.error(result.error ?? "Could not save the review.");
      }
    });
  }

  const renderField = (def: FieldDef, className?: string) => {
    const path = def.path;
    const flaggedField = isFlagged(path);
    const editing = isEditing(def);
    const quote = lookup(evidence, path);
    const error = errors[path];
    const inputId = `field-${path.replace(/\./g, "-")}`;
    const value = values[path] ?? "";
    const set = (next: string) => setValues((prev) => ({ ...prev, [path]: next }));

    let control: React.ReactNode = null;
    if (editing) {
      if (def.kind === "tri") {
        control = (
          <select id={inputId} className={SELECT_CLASS} value={value} onChange={(e) => set(e.target.value)} aria-invalid={error ? true : undefined}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="blank">Not shown</option>
          </select>
        );
      } else if (def.kind === "type") {
        control = (
          <select id={inputId} className={SELECT_CLASS} value={value} onChange={(e) => set(e.target.value)}>
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>
                {POLICY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        );
      } else {
        const cents = def.kind === "money" && value.trim() ? parseLimitToCents(value) : undefined;
        control = (
          <>
            <Input
              id={inputId}
              type={def.kind === "date" ? "date" : "text"}
              inputMode={def.kind === "number" ? "numeric" : def.kind === "money" ? "decimal" : undefined}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={def.kind === "money" ? "1,000,000" : def.kind === "number" ? "30" : undefined}
              className={cn("h-7", def.mono && "data")}
              aria-invalid={error ? true : undefined}
            />
            {def.kind === "money" && value.trim() ? (
              <span className={cn("data text-[0.7rem]", cents === null ? "text-destructive" : "text-muted-foreground")}>
                {cents === null || cents === undefined ? "not a plain amount" : `= ${formatLimit(cents)}`}
              </span>
            ) : null}
          </>
        );
      }
    }

    return (
      <div
        key={path}
        className={cn(
          "grid min-w-0 content-start gap-1 rounded-md border px-2.5 py-2",
          flaggedField ? "border-saffron/60 bg-saffron/8" : "border-border/70",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {editing ? (
            <Label htmlFor={inputId} className="text-xs font-normal text-muted-foreground">
              {def.label}
            </Label>
          ) : (
            <span className="text-xs text-muted-foreground">{def.label}</span>
          )}
          <ConfidenceMeter value={confidenceOf(path)} />
        </div>
        {editing ? control : <span className={cn("min-w-0 break-words text-sm", def.mono && "data")}>{def.display}</span>}
        {quote ? (
          <q className="data line-clamp-2 text-[0.7rem] text-muted-foreground before:content-['“'] after:content-['”']" title={quote}>
            {quote}
          </q>
        ) : null}
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    );
  };

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b">
        <CardTitle>Extracted fields</CardTitle>
        <CardDescription>
          The model reads; the rules decide. Fields under {LOW_CONFIDENCE.toFixed(1)} confidence are highlighted for review.
        </CardDescription>
        {canReview ? (
          <CardAction>
            <div className="flex items-center gap-2">
              <Switch id="edit-all-fields" size="sm" checked={editAll} onCheckedChange={setEditAll} />
              <Label htmlFor="edit-all-fields" className="text-xs font-normal">
                Edit all
              </Label>
            </div>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-5">
        {flagged.length > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-saffron/50 bg-saffron/10 px-3 py-2 text-sm text-[color-mix(in_oklch,var(--saffron),var(--graphite)_60%)]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {pluralize(flagged.length, "field")} to confirm. Check each against the document, correct it if needed,
              then confirm the review.
            </span>
          </p>
        ) : reviewedAt ? (
          <p className="text-xs text-muted-foreground">
            Reviewed <time dateTime={reviewedAt}>{formatTimestamp(reviewedAt, timeZone)}</time>.
          </p>
        ) : null}

        <section aria-labelledby="parties-heading" className="grid gap-2">
          <h3 id="parties-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Parties and terms
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">{defs.parties.map((d) => renderField(d))}</div>
        </section>

        <section aria-labelledby="policies-heading" className="grid gap-2">
          <h3 id="policies-heading" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Policies <span className="data">({extraction.policies.length})</span>
          </h3>
          {defs.policies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No policy rows were read from the document.</p>
          ) : (
            defs.policies.map((p) => (
              <div key={p.index} className="grid gap-2 rounded-lg bg-muted/40 p-2 ring-1 ring-foreground/5">
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                  <p className="text-sm font-medium">
                    <span className="data mr-1.5 rounded-sm bg-background px-1.5 py-0.5 text-[0.7rem] ring-1 ring-foreground/10">
                      {POLICY_TYPE_SHORT[p.type]}
                    </span>
                    {POLICY_TYPE_LABELS[p.type]}
                  </p>
                  <span className="data text-xs text-muted-foreground">#{p.index + 1}</span>
                </div>
                {isEditing(p.typeDef) || isFlagged(p.typeDef.path) ? renderField(p.typeDef) : null}
                <div className="grid gap-2 sm:grid-cols-2">{p.fields.map((d) => renderField(d))}</div>
              </div>
            ))
          )}
        </section>

        {canReview ? (
          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t bg-card/95 px-4 py-3 backdrop-blur">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {formError ? (
                <span className="text-destructive">{formError}</span>
              ) : (
                <>
                  {pluralize(changed.length, "correction")} · {pluralize(flagged.length, "flagged field")}
                </>
              )}
            </p>
            <Button onClick={submit} disabled={pending || (flagged.length === 0 && changed.length === 0 && Boolean(reviewedAt))}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />}
              {pending ? "Saving review" : changed.length > 0 ? "Save corrections and confirm" : "Confirm review"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
