import * as React from "react";
import { Clock, CircleDollarSign, Target, TrendingUp } from "lucide-react";
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
    <div className="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
      <SummaryCard
        icon={Clock}
        label="Logged this week"
        value={formatDuration(stats.total, { compact: true }) || "0m"}
        helper={`${weeklyGoalHours}h weekly goal`}
        progress={weeklyProgress}
        featured
      />
      <SummaryCard
        icon={Target}
        label="Billable hours"
        value={formatDuration(stats.billable, { compact: true }) || "0m"}
        helper={`${stats.billablePct}% billable`}
        tone="primary"
      />
      <SummaryCard
        icon={CircleDollarSign}
        label="Earnings"
        value={formatINR(stats.earnings)}
        helper="This week"
        tone="success"
      />
      <SummaryCard
        icon={TrendingUp}
        label="Avg / day"
        value={
          formatDuration(Math.round(stats.total / 7), { compact: true }) ||
          "0m"
        }
        helper="Trailing 7 days"
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
  progress,
  featured,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "primary" | "success";
  progress?: number;
  featured?: boolean;
}) {
  return (
    <Card className={cn(
      "group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]",
      featured && "col-span-2 lg:col-span-1",
    )}>
      <CardContent className="min-h-36 space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
              tone === "primary" &&
                "bg-gradient-to-br from-primary/10 to-blue-500/10 text-primary ring-primary/15",
              tone === "success" &&
                "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400",
              tone === "default" &&
                "bg-gradient-to-br from-primary/10 to-blue-500/10 text-primary ring-primary/15",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </p>
        {helper && (
          <p className="text-xs text-muted-foreground">{helper}</p>
        )}
        {typeof progress === "number" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-blue-600 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
