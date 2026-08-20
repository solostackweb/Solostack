/**
 * PortalSkeleton — loading placeholder for the portal detail page.
 *
 * Matches the layout of PortalView: overview strip → two-column grid
 * (main sections + right rail). Realistic shapes prevent layout shift
 * when the real content arrives.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PortalSkeleton() {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0" />
      </div>

      {/* Compact overview strip */}
      <div className="flex flex-wrap gap-2">
        {[64, 96, 72, 88].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_300px]">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Updates section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-28" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg border border-l-4 border-l-muted bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Meetings section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border overflow-hidden">
                  <Skeleton className="h-0.5 w-full rounded-none" />
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-8 w-16 shrink-0" />
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1.5">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Files section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          {/* Members */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-20" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-12 shrink-0 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <div className="relative pl-4 space-y-4">
                <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="relative shrink-0 mt-0.5">
                      <Skeleton className="h-3.5 w-3.5 rounded-full" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
