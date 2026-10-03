import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the dense list screens (vendors, certificates, requirements). */
export function ListSkeleton({ label, withTabs = false, rows = 8 }: { label: string; withTabs?: boolean; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      {withTabs ? <Skeleton className="h-9 w-full max-w-xl" /> : null}
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Skeleton className="h-10 rounded-none" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Loading state for a detail page: header, then two columns of cards. */
export function DetailSkeleton({ label, split = false }: { label: string; split?: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className={split ? "grid gap-6 lg:grid-cols-2" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"}>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className={split ? "h-[32rem] rounded-xl" : "h-80 rounded-xl"} />
      </div>
    </div>
  );
}
