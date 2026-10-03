import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RulesEditor } from "@/components/templates/rules-editor";
import { TemplateActions } from "@/components/templates/template-actions";
import { pluralize } from "@/components/vendors/format";
import { parseTemplateRules } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requirement template" };
// Saving rules re-evaluates up to 50 certificates in the same Server Action.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { org, role } = await requireOrgContext();
  const supabase = await createClient();

  const [templateRes, vendorsRes] = await Promise.all([
    supabase.from("requirement_templates").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase
      .from("vendors")
      .select("id, name")
      .eq("org_id", org.id)
      .eq("template_id", id)
      .order("name", { ascending: true }),
  ]);
  if (templateRes.error) throw new Error(`load template: ${templateRes.error.message}`);
  if (vendorsRes.error) throw new Error(`load template vendors: ${vendorsRes.error.message}`);
  const template = templateRes.data;
  if (!template) notFound();

  const vendors = vendorsRes.data;
  const legalName = org.legal_name?.trim() || org.name;

  return (
    <div className="space-y-6">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Requirements
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl leading-tight tracking-tight">
            <span className="break-words">{template.name}</span>
            {template.is_default ? (
              <span className="rounded-sm border border-cobalt/60 px-1.5 py-0.5 text-xs font-medium tracking-normal text-cobalt">Default</span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            Used by {pluralize(vendors.length, "vendor")}
            {template.is_default ? "; new vendors get it unless you pick another." : "."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <TemplateActions
            templateId={template.id}
            name={template.name}
            isDefault={template.is_default}
            vendorCount={vendors.length}
            canDelete={role === "owner"}
          />
        </div>
      </header>

      <RulesEditor
        key={template.updated_at}
        templateId={template.id}
        name={template.name}
        rules={parseTemplateRules(template)}
        legalName={legalName}
        vendorCount={vendors.length}
      />

      {vendors.length > 0 ? (
        <section aria-labelledby="template-vendors" className="grid gap-2">
          <h2 id="template-vendors" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Vendors on this template
          </h2>
          <ul className="flex flex-wrap gap-1.5">
            {vendors.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/vendors/${v.id}`}
                  className="inline-flex rounded-md bg-card px-2 py-1 text-sm ring-1 ring-foreground/10 hover:bg-muted"
                >
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
