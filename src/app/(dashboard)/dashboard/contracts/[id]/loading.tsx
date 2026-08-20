import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-20 hidden sm:block" />
            <Skeleton className="h-4 w-2 hidden sm:block" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* Content card */}
        <div className="rounded-lg border bg-card p-5 sm:p-8 space-y-6">
          <div className="border-b pb-6 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar card */}
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-3 w-10 ml-auto" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
