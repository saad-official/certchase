import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { NewTemplateDialog } from "@/components/templates/new-template-dialog";
import { summarizeRules } from "@/components/templates/rules-summary";
import { pluralize } from "@/components/vendors/format";
import { parseTemplateRules } from "@/lib/db/mappers";
import { requireOrgContext } from "@/lib/db/queries";
import { listTemplates } from "@/lib/services/templates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requirements" };

export default async function TemplatesPage() {
  const { org } = await requireOrgContext();
  const supabase = await createClient();
  const [templates, vendorsRes] = await Promise.all([
    listTemplates(supabase, org.id),
    supabase.from("vendors").select("template_id").eq("org_id", org.id),
  ]);
  if (vendorsRes.error) throw new Error(`count vendors per template: ${vendorsRes.error.message}`);

  const counts = new Map<string, number>();
  for (const v of vendorsRes.data) counts.set(v.template_id, (counts.get(v.template_id) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="Requirements"
        description="The coverage each kind of contract requires. Every vendor is judged against its template by deterministic rules."
        actions={<NewTemplateDialog templates={templates.map((t) => ({ id: t.id, name: t.name, isDefault: t.is_default }))} />}
      />

      {templates.length === 0 ? (
        <EmptyState
          title="No requirement templates"
          description="Create one to start adding vendors. The standard defaults are GL $1M/$2M, Auto $1M, WC $1M, additional insured and waiver, 30-day notice."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => {
            const rules = parseTemplateRules(t);
            const count = counts.get(t.id) ?? 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/templates/${t.id}`}
                  className="grid h-full gap-3 rounded-xl bg-card p-4 shadow-card ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate">{t.name}</span>
                        {t.is_default ? (
                          <span className="rounded-sm border border-cobalt/60 px-1.5 py-0.5 text-[0.7rem] font-medium text-cobalt">Default</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{pluralize(count, "vendor")}</p>
                    </div>
                    <span className="text-xs font-medium text-cobalt">Edit rules</span>
                  </div>
                  <ul className="flex flex-wrap gap-1">
                    {summarizeRules(rules).map((token) => (
                      <li key={token} className="data rounded-sm bg-muted px-1.5 py-0.5 text-[0.72rem]">
                        {token}
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
