import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/lib/db/queries";
import type { OrgVoiceJson } from "@/lib/db/types";
import { AUTO_RENEWAL_MIN_CONFIDENCE } from "@/lib/domain/guardrails";
import { AutonomyForm, BusinessForm, VoiceForm, type AutonomyOption } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Mirrors decideAutonomy() in lib/domain/guardrails.ts. */
const AUTONOMY_OPTIONS: AutonomyOption[] = [
  {
    value: "manual",
    title: "Manual approval",
    description:
      "Every chase email waits in your approval queue: first requests, deficiency notices and renewal reminders. Nothing is sent until you approve it.",
    pro: false,
  },
  {
    value: "auto_renewals",
    title: "Auto-send renewal reminders",
    description: `Renewal reminders only (30, 14 and 7 days before a policy expires) send on their own when the draft's confidence is at least ${pct(AUTO_RENEWAL_MIN_CONFIDENCE)}. Pro only. First requests and deficiency notices always wait for you.`,
    pro: true,
  },
];

export default async function SettingsPage() {
  const { org } = await requireOrgContext();
  const voice = (
    org.voice && typeof org.voice === "object" && !Array.isArray(org.voice) ? org.voice : {}
  ) as OrgVoiceJson;
  const isPro = org.plan === "pro";

  return (
    <>
      <PageHeader title="Settings" description={`How CertChase checks certificates and writes to brokers for ${org.name}.`} />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business</CardTitle>
            <CardDescription>Your organisation, the name certificates must be issued to, and your clock.</CardDescription>
          </CardHeader>
          <CardContent>
            <BusinessForm name={org.name} legalName={org.legal_name ?? ""} timezone={org.timezone || "UTC"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voice</CardTitle>
            <CardDescription>How your chase emails sound. Every draft is written with these.</CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceForm
              orgName={org.name}
              businessName={voice.business_name ?? ""}
              signature={voice.signature ?? ""}
              toneNotes={voice.tone_notes ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Autonomy</CardTitle>
            <CardDescription>How much CertChase may send without asking you first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <AutonomyForm current={org.autonomy} isPro={isPro} options={AUTONOMY_OPTIONS} />
            <div className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <p className="font-medium text-foreground">Rules that apply at every setting</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>
                  Compliance verdicts come from deterministic rules, never from the model. Drafts must quote every gap
                  the rules found.
                </li>
                <li>
                  A draft that fails a guardrail (missing vendor name or gap, a leftover placeholder, a legal threat, no
                  sign-off) drops to 0% confidence and always waits for approval.
                </li>
                <li>Vendors marked do-not-contact are never emailed, and chasing stops once a vendor is compliant.</li>
                <li>
                  Emails go to the broker when one is on file, otherwise the vendor contact, on weekdays between 08:00
                  and 18:00 in your timezone.
                </li>
                <li>Downgrading to Free switches autonomy back to manual approval.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session</CardTitle>
            <CardDescription>Sign out of CertChase on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                <LogOut aria-hidden />
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
