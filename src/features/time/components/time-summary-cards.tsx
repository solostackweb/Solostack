import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import { formatDuration, secondsToHours } from "../types";
import type { TimeEntryRecord } from "../server";

interface TimeSummaryCardsProps {
  entries: TimeEntryRecord[];
  /** Weekly goal in hours — defaults to 35. */
  weeklyGoalHours?: number;
}

/**
 * Reusable time KPI strip. Pure function of the entries passed in — the
 * parent scopes the summary (e.g. "this week", "today") by slicing first.
 */
export function TimeSummaryCards({
  entries,
  weeklyGoalHours = 35,
}: TimeSummaryCardsProps) {
  const stats = React.useMemo(() => {
    const total = entries.reduce((s, e) => s + e.durationSeconds, 0);
    const billable = entries
      .filter((e) => e.billable)
      .reduce((s, e) => s + e.durationSeconds, 0);
    const earnings = entries.reduce(
      (s, e) => s + (e.billable ? Number(e.amount) || 0 : 0),
      0,
    );
    const billablePct =
      total === 0 ? 0 : Math.round((billable / total) * 100);
    return { total, billable, earnings, billablePct };
  }, [entries]);

  const weekly = secondsToHours(stats.total);
  const weeklyProgress = Math.min(
    100,
    Math.round((weekly / Math.max(weeklyGoalHours, 1)) * 100),
  );

  return (
    <Card>
      <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4">
      <SummaryCard
        label="This week"
        value={formatDuration(stats.total, { compact: true }) || "0m"}
        helper={`${weeklyGoalHours}h weekly goal`}
        progress={weeklyProgress}
        className="border-b border-r lg:border-b-0"
      />
      <SummaryCard
        label="Billable"
        value={formatDuration(stats.billable, { compact: true }) || "0m"}
        helper={`${stats.billablePct}% billable`}
        className="border-b lg:border-b-0 lg:border-r"
      />
      <SummaryCard
        label="Earnings"
        value={formatINR(stats.earnings)}
        helper="This week"
        className="border-r"
        valueClassName="text-success-strong"
      />
      <SummaryCard
        label="Avg / day"
        value={
          formatDuration(Math.round(stats.total / 7), { compact: true }) ||
          "0m"
        }
        helper="Trailing 7 days"
      />
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  progress,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  helper?: string;
  progress?: number;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-2 p-4 sm:p-5", className)}>
        <p className="truncate text-micro font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className={cn("text-2xl font-bold tabular-nums tracking-tight", valueClassName)}>
          {value}
        </p>
        {helper && (
          <p className="text-xs text-muted-foreground">{helper}</p>
        )}
        {typeof progress === "number" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
    </div>
  );
}
