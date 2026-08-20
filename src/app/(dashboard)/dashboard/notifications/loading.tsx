import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="hidden h-4 w-48 sm:block" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1">
          <Skeleton className="h-9 w-20 shrink-0 rounded-lg" />
          <Skeleton className="h-9 w-20 shrink-0 rounded-lg" />
          <Skeleton className="h-9 w-32 shrink-0 rounded-lg" />
        </div>
      </div>

      <div className="space-y-6">
        {["Today", "Yesterday"].map((label) => (
          <div key={label} className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <div className="rounded-lg border bg-card">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 border-t px-5 py-4 first:border-t-0">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
