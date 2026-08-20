import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>

      {/* Detail card */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-2 sm:text-right">
            <Skeleton className="h-3 w-12 sm:ml-auto" />
            <Skeleton className="h-9 w-28 sm:ml-auto" />
            <Skeleton className="h-3 w-24 sm:ml-auto" />
          </div>
        </div>

        {/* Line items table */}
        <div className="rounded-lg border overflow-hidden">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none border-t" />
          ))}
        </div>

        {/* Totals */}
        <div className="ml-auto w-full max-w-sm space-y-2 border-t pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
