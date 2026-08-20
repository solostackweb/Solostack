import { Skeleton } from "@/components/ui/skeleton";

/**
 * Settings content-pane skeleton — shown while any settings sub-page loads.
 * Mirrors the typical form layout: section heading + a card with labelled
 * input rows, matching the visual weight of the real pages.
 */
export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      {/* Page title + description */}
      <div className="space-y-2 border-b pb-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* First card — e.g. profile / company info */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <div className="space-y-4">
          {/* Two-column row */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
          {/* Full-width rows */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Second card — e.g. secondary section */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
