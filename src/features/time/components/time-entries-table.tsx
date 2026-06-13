"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, FileText } from "lucide-react";
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
import { deleteTimeEntryAction } from "../actions";

export interface TimeEntryLookup {
  projectById: Map<string, { name: string }>;
  clientById: Map<string, { name: string }>;
}

interface TimeEntriesTableProps {
  entries: TimeEntryRecord[];
  lookup: TimeEntryLookup;
  className?: string;
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
}: TimeEntriesTableProps) {
  const grouped = React.useMemo(() => groupByDate(entries), [entries]);

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
                    <EntryRow key={e.id} entry={e} lookup={lookup} />
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
}: {
  entry: TimeEntryRecord;
  lookup: TimeEntryLookup;
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
    <li className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/20 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
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
