import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Extraction } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { compareExtractions } from "./fields";

/**
 * Demo honesty: the synthetic PDF was rendered from a known extraction, so
 * show every field where the model's reading differs from that truth.
 */
export function FixtureComparison({ model, fixture, reviewed }: { model: Extraction; fixture: Extraction; reviewed: boolean }) {
  const { total, differences } = compareExtractions(model, fixture);
  const agreed = total - differences.length;
  const pct = total === 0 ? 100 : Math.round((agreed / total) * 100);

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-baseline gap-2">
          Model vs fixture
          <span
            className={cn(
              "data text-sm",
              differences.length === 0 ? "text-[color-mix(in_oklch,var(--verdigris),var(--graphite)_35%)]" : "text-[color-mix(in_oklch,var(--saffron),var(--graphite)_50%)]",
            )}
          >
            {agreed}/{total} fields agree ({pct}%)
          </span>
        </CardTitle>
        <CardDescription>
          This demo certificate was generated from a known extraction. Differences below are the vision model&apos;s
          misreadings{reviewed ? " (after your review corrections)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {differences.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">The model read every compared field exactly.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Field</th>
                  <th className="px-3 py-1.5 font-medium">Fixture</th>
                  <th className="px-3 py-1.5 font-medium">Model</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {differences.map((d) => (
                  <tr key={d.key} className="align-top">
                    <td className="px-3 py-1.5">{d.label}</td>
                    <td className="data px-3 py-1.5 break-words">{d.fixture}</td>
                    <td className="data px-3 py-1.5 break-words text-oxblood">{d.model}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
