import { cn } from "@/lib/utils";

/**
 * Section label set like a drawing-sheet reference: a two-digit index and a
 * name in mono capitals. Decorative index is hidden from assistive tech.
 */
export function SectionLabel({
  index,
  children,
  className,
}: {
  index?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase",
        className,
      )}
    >
      {index ? (
        <span aria-hidden="true" className="tabular text-cobalt">
          {index}
        </span>
      ) : null}
      {index ? <span aria-hidden="true" className="h-px w-6 bg-foreground/25" /> : null}
      <span>{children}</span>
    </p>
  );
}
