import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACTOR_LABELS, humanizeEvent, type TimelineEventInput, type TimelineTone } from "./events";
import { formatTimestamp } from "./format";

const DOT: Record<TimelineTone, string> = {
  default: "bg-cobalt",
  good: "bg-verdigris",
  warn: "bg-saffron",
  bad: "bg-oxblood",
  muted: "bg-muted-foreground/50",
};

/** Newest first: events about the vendor, its certificates and its chase emails. */
export function VendorTimeline({ events, timeZone }: { events: TimelineEventInput[]; timeZone: string }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Timeline</CardTitle>
        <CardDescription>Every step the agent, the rules and you took for this vendor.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ol className="relative grid gap-0">
            {events.map((event, index) => {
              const human = humanizeEvent(event);
              return (
                <li key={event.id} className="relative grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
                  {index < events.length - 1 ? (
                    <span aria-hidden className="absolute top-3 bottom-0 left-[0.3rem] w-px bg-border" />
                  ) : null}
                  <span aria-hidden className={cn("relative mt-1.5 size-2.5", DOT[human.tone])} />
                  <div className="grid min-w-0 gap-0.5">
                    <p className="text-sm font-medium">
                      {human.certificateId ? (
                        <Link href={`/certificates/${human.certificateId}`} className="hover:underline">
                          {human.title}
                        </Link>
                      ) : (
                        human.title
                      )}
                    </p>
                    {human.detail ? <p className="data break-words text-xs text-muted-foreground">{human.detail}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={event.created_at} className="tabular">
                        {formatTimestamp(event.created_at, timeZone)}
                      </time>{" "}
                      · {ACTOR_LABELS[event.actor] ?? event.actor}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
