"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { formatDuration, secondsToHours } from "../types";
import type { TimeAnalytics } from "../analytics";

export interface TimeAnalyticsViewProps {
  analytics: TimeAnalytics;
  projectName: (id: string | null) => string;
  clientName: (id: string | null) => string;
}

function fmtDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function TimeAnalyticsView({
  analytics,
  projectName,
  clientName,
}: TimeAnalyticsViewProps) {
  const daily = React.useMemo(
    () =>
      analytics.byDay.map((p) => ({
        date: fmtDay(p.date),
        tracked: Math.round((p.seconds / 3600) * 100) / 100,
        billable: Math.round((p.billableSeconds / 3600) * 100) / 100,
      })),
    [analytics.byDay],
  );

  const topProjects = analytics.byProject.slice(0, 6);
  const topClients = analytics.byClient.slice(0, 6);
  const maxProject = Math.max(1, ...topProjects.map((b) => b.seconds));
  const maxClient = Math.max(1, ...topClients.map((b) => b.seconds));

  if (analytics.entryCount === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No tracked time in this range yet. Log some time to see analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tracked" value={`${secondsToHours(analytics.totalSeconds)}h`} />
        <Stat label="Billable value" value={formatINR(analytics.billableAmount)} />
        <Stat
          label="Utilization"
          value={`${Math.round(analytics.utilization * 100)}%`}
          sub={`${secondsToHours(analytics.billableSeconds)}h billable`}
        />
        <Stat label="Entries" value={String(analytics.entryCount)} />
      </div>

      {/* Daily trend */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Daily hours
            </p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" /> Billable
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Tracked
              </span>
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ts-billable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value, name) => [`${value}h`, name === "billable" ? "Billable" : "Tracked"]}
                />
                <Area
                  type="monotone"
                  dataKey="tracked"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                  fill="none"
                />
                <Area
                  type="monotone"
                  dataKey="billable"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#ts-billable)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="By project"
          rows={topProjects.map((b) => ({
            name: projectName(b.key),
            seconds: b.seconds,
            amount: b.amount,
            pct: Math.round((b.seconds / maxProject) * 100),
          }))}
        />
        <BreakdownCard
          title="By client"
          rows={topClients.map((b) => ({
            name: clientName(b.key),
            seconds: b.seconds,
            amount: b.amount,
            pct: Math.round((b.seconds / maxClient) * 100),
          }))}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; seconds: number; amount: number; pct: number }>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No data.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, i) => (
              <li key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatDuration(row.seconds, { compact: true })}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${row.pct}%` }} />
                </div>
                {row.amount > 0 ? (
                  <div className="flex justify-end text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{formatINR(row.amount)}</span>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
