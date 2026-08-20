import * as React from "react";
import { cn } from "@/lib/utils";
import type { UsageSnapshot, UsageMetric } from "@/features/subscription/types";

interface Tile {
  metric: UsageMetric;
  label: string;
  format?: "count" | "bytes";
}

const TILES: Tile[] = [
  { metric: "clients_created", label: "Lifetime clients" },
  { metric: "invoices_created", label: "Invoices this month" },
  { metric: "projects_created", label: "Projects this month" },
  { metric: "storage_bytes", label: "Storage", format: "bytes" },
];

export function UsageGrid({
  snapshots,
}: {
  snapshots: Record<UsageMetric, UsageSnapshot | null>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map((t) => {
        const snap = snapshots[t.metric];
        if (!snap) return null;
        return (
          <UsageTile
            key={t.metric}
            label={t.label}
            snapshot={snap}
            format={t.format ?? "count"}
          />
        );
      })}
    </div>
  );
}

function UsageTile({
  label,
  snapshot,
  format,
}: {
  label: string;
  snapshot: UsageSnapshot;
  format: "count" | "bytes";
}) {
  const unlimited = snapshot.limit === Infinity;
  const used =
    format === "bytes" ? formatBytes(snapshot.used) : snapshot.used.toLocaleString();
  const cap = unlimited
    ? "∞"
    : format === "bytes"
      ? formatBytes(snapshot.limit)
      : snapshot.limit.toLocaleString();
  const tone = snapshot.exceeded
    ? "danger"
    : snapshot.utilisation > 0.8
      ? "warning"
      : "ok";

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">
        <span>{used}</span>
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          / {cap}
        </span>
      </p>
      {!unlimited && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              tone === "danger" && "bg-destructive",
              tone === "warning" && "bg-warning",
              tone === "ok" && "bg-primary",
            )}
            style={{
              width: `${Math.min(100, snapshot.utilisation * 100).toFixed(0)}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === Infinity) return "∞";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}
