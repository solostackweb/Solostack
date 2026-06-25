"use client";

import * as React from "react";
import { Clock, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { formatDuration, secondsToHours } from "@/features/time/types";

/** Lean unbilled entry shape passed from the server page (serializable). */
export interface UnbilledEntryLite {
  id: string;
  clientId: string | null;
  projectId: string | null;
  seconds: number;
  amount: number;
  startedAt: string;
}

export interface UnbilledGroupSelection {
  key: string;
  ids: string[];
  description: string;
  hours: number;
  rate: number;
}

interface UnbilledTimePanelProps {
  entries: UnbilledEntryLite[];
  clientId: string | null;
  projects: Array<{ id: string; name: string }>;
  /** Group keys already pulled onto the invoice. */
  addedKeys: string[];
  currency?: string;
  onAdd: (group: UnbilledGroupSelection) => void;
  onUndo: (key: string) => void;
}

/**
 * "Unbilled time" panel on invoice creation. Shows the selected client's
 * billable, uninvoiced hours grouped per project; one click turns a group
 * into a line item and stamps the underlying entries when the invoice is
 * created. Renders nothing when there's nothing to bill.
 */
export function UnbilledTimePanel({
  entries,
  clientId,
  projects,
  addedKeys,
  currency = "INR",
  onAdd,
  onUndo,
}: UnbilledTimePanelProps) {
  const groups = React.useMemo(() => {
    if (!clientId) return [];
    const byProject = new Map<
      string,
      { ids: string[]; seconds: number; amount: number; earliest: string; latest: string }
    >();
    for (const e of entries) {
      if (e.clientId !== clientId) continue;
      const key = e.projectId ?? "no-project";
      const g =
        byProject.get(key) ??
        { ids: [], seconds: 0, amount: 0, earliest: e.startedAt, latest: e.startedAt };
      g.ids.push(e.id);
      g.seconds += e.seconds;
      g.amount += e.amount;
      if (e.startedAt < g.earliest) g.earliest = e.startedAt;
      if (e.startedAt > g.latest) g.latest = e.startedAt;
      byProject.set(key, g);
    }
    return Array.from(byProject.entries())
      .map(([key, g]) => {
        const hours = secondsToHours(g.seconds);
        const rate =
          g.seconds > 0 ? Math.round((g.amount / (g.seconds / 3600)) * 100) / 100 : 0;
        const projectName =
          key === "no-project"
            ? "Time logged"
            : projects.find((p) => p.id === key)?.name ?? "Project time";
        return {
          key,
          ids: g.ids,
          seconds: g.seconds,
          amount: Math.round(g.amount * 100) / 100,
          hours,
          rate,
          projectName,
          range: formatRange(g.earliest, g.latest),
          description: `${projectName} — ${hours}h logged (${formatRange(g.earliest, g.latest)})`,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);
  }, [entries, clientId, projects]);

  if (!clientId || groups.length === 0) return null;

  const pending = groups.filter((g) => !addedKeys.includes(g.key));
  const totalPendingAmount = pending.reduce((s, g) => s + g.amount, 0);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Unbilled time for this client
        </p>
        {pending.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {formatMoney(totalPendingAmount, currency)} not yet added
          </p>
        ) : (
          <p className="text-xs font-medium text-success">All time added ✓</p>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {groups.map((g) => {
          const added = addedKeys.includes(g.key);
          return (
            <li
              key={g.key}
              className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.projectName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(g.seconds, { compact: true })} · {g.range} ·{" "}
                  {formatMoney(g.amount, currency)}
                  {g.rate > 0 ? ` @ ${formatMoney(g.rate, currency)}/h` : ""}
                </p>
              </div>
              {added ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 self-start text-xs text-muted-foreground sm:self-auto"
                  onClick={() => onUndo(g.key)}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" /> Added · Undo
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 self-start border-primary/30 text-xs text-primary hover:bg-primary/5 sm:self-auto"
                  onClick={() =>
                    onAdd({
                      key: g.key,
                      ids: g.ids,
                      description: g.description,
                      hours: g.hours,
                      rate: g.rate,
                    })
                  }
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add as line item
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Entries added here are marked as invoiced when you create this invoice,
        so the same hours can never be billed twice. Deleting the invoice
        releases them again.
      </p>
    </div>
  );
}

function formatRange(fromIso: string, toIso: string): string {
  const f = new Date(fromIso);
  const t = new Date(toIso);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  const sameDay = fromIso.slice(0, 10) === toIso.slice(0, 10);
  if (sameDay) return fmt(f, true);
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${fmt(f, !sameYear)} – ${fmt(t, true)}`;
}
