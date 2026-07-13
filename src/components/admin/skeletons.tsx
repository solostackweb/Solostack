/**
 * Admin Skeleton Kit
 * ------------------
 * Layout-matched loading placeholders for the founder console. These mirror
 * the resting components in `kit.tsx` (page header, KPI grid, panels, tables)
 * so a route's `loading.tsx` renders a skeleton with the *same shape* as the
 * page it precedes - no layout shift when data arrives, and no bare
 * "Loading..." string.
 *
 * All components are server-safe (no hooks / client APIs) and build on the
 * shimmer `Skeleton` primitive. Reduced-motion is handled globally by
 * `Skeleton` itself.
 *
 * Usage in a route:
 *
 *   export default function Loading() {
 *     return (
 *       <AdminSkeletonSection>
 *         <PageHeaderSkeleton withActions />
 *         <KpiGridSkeleton cols={4} />
 *         <TableSkeleton cols={6} rows={8} withToolbar />
 *       </AdminSkeletonSection>
 *     );
 *   }
 */

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirror of the resting surface token used across kit.tsx.
const SURFACE =
  "rounded-xl border bg-card/95 shadow-sm shadow-black/[0.035] dark:bg-card dark:shadow-black/25";

// ---------------------------------------------------------------------------
// Section wrapper - matches <AdminSection> rhythm.
// ---------------------------------------------------------------------------

export function AdminSkeletonSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-5 sm:space-y-6", className)} role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header - matches <AdminPageHeader>.
// ---------------------------------------------------------------------------

export function PageHeaderSkeleton({
  withActions = false,
  actionCount = 3,
  withSubtitle = true,
}: {
  withActions?: boolean;
  actionCount?: number;
  withSubtitle?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-6 w-40" />
        {withSubtitle ? <Skeleton className="h-3.5 w-56" /> : null}
      </div>
      {withActions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {Array.from({ length: actionCount }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI grid - matches <KpiGrid> + <StatCard>.
// ---------------------------------------------------------------------------

const LG_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function StatCardSkeleton() {
  return (
    <div className={cn(SURFACE, "min-h-[132px] p-5")}>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-24" />
      <Skeleton className="mt-3 h-3 w-16" />
    </div>
  );
}

export function KpiGridSkeleton({
  cols = 4,
  count,
  className,
}: {
  cols?: 2 | 3 | 4 | 5 | 6;
  count?: number;
  className?: string;
}) {
  const n = count ?? cols;
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:auto-rows-fr",
        LG_COLS[cols],
        className,
      )}
    >
      {Array.from({ length: n }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel - matches <Panel>.
// ---------------------------------------------------------------------------

export function PanelSkeleton({
  withHeader = true,
  lines = 4,
  className,
  children,
}: {
  withHeader?: boolean;
  lines?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(SURFACE, "p-5 sm:p-6", className)}>
      {withHeader ? (
        <div className="mb-4 flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ) : null}
      {children ?? (
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters bar - matches the search/select toolbars on list pages.
// ---------------------------------------------------------------------------

export function FiltersSkeleton({ selects = 3 }: { selects?: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-sm shadow-black/[0.025] dark:bg-card">
      <Skeleton className="h-9 w-full rounded-lg sm:w-64" />
      {Array.from({ length: selects }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-lg" />
      ))}
      <Skeleton className="h-9 w-16 rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table - matches <AdminTableShell> + <AdminTable>.
// ---------------------------------------------------------------------------

export function TableSkeleton({
  cols = 5,
  rows = 8,
  withToolbar = false,
  className,
}: {
  cols?: number;
  rows?: number;
  withToolbar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card/95 shadow-sm shadow-black/[0.035] dark:bg-card dark:shadow-black/25", className)}>
      {withToolbar ? (
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/45">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2.5 text-left">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="border-t border-border/45">
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="px-3 py-3">
                    <Skeleton
                      className={cn("h-3.5", c === 0 ? "w-32" : "w-14")}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card list - matches the mobile card-list fallback on list pages.
// ---------------------------------------------------------------------------

export function CardListSkeleton({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(SURFACE, "flex items-center justify-between gap-3 p-3.5")}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic two-column detail layout - matches detail pages
// ([id] routes) with a main column + a sidebar.
// ---------------------------------------------------------------------------

export function DetailSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <PanelSkeleton lines={5} />
        <PanelSkeleton lines={4} />
      </div>
      <aside className="space-y-4">
        <PanelSkeleton lines={3} />
        <PanelSkeleton lines={4} />
      </aside>
    </div>
  );
}
