"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, FileText, Pencil, IndianRupee, CircleSlash } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";

import { dateKeyFromISO, formatDuration } from "../types";
import type { TimeEntryRecord } from "../server";
import { deleteTimeEntryAction, bulkUpdateTimeEntriesAction } from "../actions";

export interface TimeEntryLookup {
  projectById: Map<string, { name: string }>;
  clientById: Map<string, { name: string }>;
}

interface TimeEntriesTableProps {
  entries: TimeEntryRecord[];
  lookup: TimeEntryLookup;
  className?: string;
  onEdit?: (entry: TimeEntryRecord) => void;
}

/**
 * Reusable time entries table. Groups by day for fast scanning — each day
 * header shows the day's total. No pagination; parent passes the filtered
 * slice in.
 */
export function TimeEntriesTable({
  entries,
  lookup,
  className,
  onEdit,
}: TimeEntriesTableProps) {
  const router = useRouter();
  const grouped = React.useMemo(() => groupByDate(entries), [entries]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = React.useTransition();

  React.useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(entries.map((e) => e.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = (action: "delete" | "billable" | "non_billable") => {
    const ids = [...selected];
    if (ids.length === 0) return;
    startBulk(async () => {
      const res = await bulkUpdateTimeEntriesAction({ ids, action });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.message ?? "Done");
      setSelected(new Set());
      router.refresh();
    });
  };

  if (grouped.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-10 text-center">
          <p className="text-sm font-medium">No time entries</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start the timer above or log time manually.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="text-xs font-semibold">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7" disabled={bulkPending} onClick={() => runBulk("billable")}>
              <IndianRupee className="h-3.5 w-3.5" /> Billable
            </Button>
            <Button size="sm" variant="outline" className="h-7" disabled={bulkPending} onClick={() => runBulk("non_billable")}>
              <CircleSlash className="h-3.5 w-3.5" /> Non-billable
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-destructive hover:text-destructive" disabled={bulkPending} onClick={() => runBulk("delete")}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <ul className="divide-y">
          {grouped.map((group) => {
            const dayTotal = group.entries.reduce(
              (s, e) => s + e.durationSeconds,
              0,
            );
            return (
              <li key={group.date}>
                <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatDateHeader(group.date)}
                  </span>
                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                    {formatDuration(dayTotal, { compact: true })}
                  </span>
                </div>
                <ul className="divide-y">
                  {group.entries.map((e) => (
                    <EntryRow
                      key={e.id}
                      entry={e}
                      lookup={lookup}
                      onEdit={onEdit}
                      selected={selected.has(e.id)}
                      onToggle={() => toggle(e.id)}
                    />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function EntryRow({
  entry,
  lookup,
  onEdit,
  selected,
  onToggle,
}: {
  entry: TimeEntryRecord;
  lookup: TimeEntryLookup;
  onEdit?: (entry: TimeEntryRecord) => void;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const project = entry.projectId ? lookup.projectById.get(entry.projectId) : undefined;
  const client = entry.clientId ? lookup.clientById.get(entry.clientId) : undefined;

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("id", entry.id);
    startTransition(async () => {
      const res = await deleteTimeEntryAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Entry deleted");
      router.refresh();
    });
  };

  return (
    <li className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 sm:items-center sm:gap-4 sm:px-5">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label="Select entry"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary sm:mt-0"
      />
      {/* Description + metadata */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {entry.description ?? "Untitled entry"}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="truncate">{project?.name ?? "No project"}</span>
          {client && (
            <>
              <span>·</span>
              <span className="truncate">{client.name}</span>
            </>
          )}
          {entry.tags.length > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {entry.tags.join(", ")}
              </span>
            </>
          )}
          {!entry.billable && (
            <>
              <span>·</span>
              <span>Non-billable</span>
            </>
          )}
          {entry.invoiceId && (
            <>
              <span>·</span>
              <span className="inline-flex items-center rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                Invoiced
              </span>
            </>
          )}
        </div>
      </div>

      {/* Duration + amount + actions — row on mobile, inline on sm+ */}
      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-sm tabular-nums",
              entry.billable ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {formatDuration(entry.durationSeconds)}
          </span>
          {entry.billable && (
            <span className="hidden w-20 text-right text-sm tabular-nums text-muted-foreground sm:inline">
              {formatINR(Number(entry.amount) || 0)}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label="Entry actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem
                disabled={Boolean(entry.invoiceId)}
                onSelect={(e) => {
                  e.preventDefault();
                  onEdit(entry);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                {entry.invoiceId ? "On an invoice" : "Edit"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={Boolean(entry.invoiceId)}
              onSelect={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {entry.invoiceId ? "On an invoice" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

interface GroupedEntries {
  date: string;
  entries: TimeEntryRecord[];
}

function groupByDate(entries: TimeEntryRecord[]): GroupedEntries[] {
  const map = new Map<string, TimeEntryRecord[]>();
  for (const e of entries) {
    const key = dateKeyFromISO(e.startedAt);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({ date, entries: list }));
}

function formatDateHeader(date: string) {
  const d = new Date(date);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().slice(0, 10);

  if (date === today) return "Today";
  if (date === yIso) return "Yesterday";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
