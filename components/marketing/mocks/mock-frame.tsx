import { cn } from "@/lib/utils";

/**
 * A product mock set like a figure on a drawing sheet: four registration
 * corners around the panel and a numbered caption that names the data as synthetic.
 */
export function MockFrame({
  figure,
  caption,
  children,
  className,
  marks = true,
}: {
  figure: string;
  caption: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  marks?: boolean;
}) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className={cn("relative", marks && "p-2.5 sm:p-3")}>
        {marks ? <RegistrationMarks /> : null}
        {children}
      </div>
      <figcaption className="mt-2 flex gap-3 px-0.5 text-xs leading-relaxed text-muted-foreground">
        <span className="shrink-0 font-mono font-medium text-foreground">Fig. {figure}</span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

/** Corner ticks, as on a plotted drawing. Purely decorative. */
function RegistrationMarks() {
  const corner = "pointer-events-none absolute size-3 border-foreground/45";
  return (
    <span aria-hidden="true">
      <span className={cn(corner, "top-0 left-0 border-t border-l")} />
      <span className={cn(corner, "top-0 right-0 border-t border-r")} />
      <span className={cn(corner, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(corner, "right-0 bottom-0 border-r border-b")} />
    </span>
  );
}

/** App-style panel: white card, hairline border, the shadow token from globals. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-3.5 py-2.5 sm:px-4">
      <p className="text-sm font-semibold">{title}</p>
      {meta ? <div className="font-mono text-[0.6875rem] text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

/**
 * Non-interactive stand-in for an app button. The mock is a picture of the
 * product, so its controls are plain text rather than focusable buttons that do nothing.
 */
export function FauxButton({
  tone = "outline",
  children,
}: {
  tone?: "primary" | "outline" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium",
        tone === "primary" && "border-primary bg-primary text-primary-foreground",
        tone === "outline" && "border-border bg-background text-foreground",
        tone === "ghost" && "border-transparent text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
