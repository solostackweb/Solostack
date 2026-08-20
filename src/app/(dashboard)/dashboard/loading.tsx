import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard route loading skeleton — shown when navigating to /dashboard
 * (e.g. tapping Home in the PWA bottom nav) while the page fetches data.
 * Mirrors the visual weight of the real dashboard: header → KPI strip →
 * chart → feed rows → bottom grid.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5">
            <Skeleton className="mb-3 h-3.5 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="rounded-lg border bg-card p-6">
        <Skeleton className="mb-4 h-4 w-36" />
        <Skeleton className="h-[180px] w-full rounded-lg" />
      </div>

      {/* Recent invoices + activity */}
      <div className="grid items-start gap-4 md:grid-cols-[1fr_280px] lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-20" />
                </div>
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <Skeleton className="mb-4 h-4 w-24" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
