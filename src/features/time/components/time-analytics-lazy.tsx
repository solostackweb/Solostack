"use client";

import dynamic from "next/dynamic";
import type { TimeAnalyticsViewProps } from "./time-analytics";

const TimeAnalyticsView = dynamic(
  () => import("./time-analytics").then((m) => m.TimeAnalyticsView),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6" aria-hidden>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[92px] animate-pulse rounded-lg border bg-card"
            />
          ))}
        </div>
        <div className="h-[280px] animate-pulse rounded-lg border bg-card" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[260px] animate-pulse rounded-lg border bg-card" />
          <div className="h-[260px] animate-pulse rounded-lg border bg-card" />
        </div>
      </div>
    ),
  },
);

export function TimeAnalyticsLazy(props: TimeAnalyticsViewProps) {
  return <TimeAnalyticsView {...props} />;
}
