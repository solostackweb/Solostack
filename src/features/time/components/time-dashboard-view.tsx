"use client";

import * as React from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  formatDuration,
  secondsToHours,
} from "../types";
import type { TimeEntryRecord } from "../server";
import type { TimeAnalytics } from "../analytics";
import {
  ActiveTimerWidget,
  type TimerProjectOption,
} from "./active-timer-widget";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { TimeSummaryCards } from "./time-summary-cards";
import { TimeAnalyticsLazy } from "./time-analytics-lazy";
import {
  TimeEntriesTable,
  type TimeEntryLookup,
} from "./time-entries-table";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";

interface TimeDashboardViewProps {
  entries: TimeEntryRecord[];
  summaryEntries: TimeEntryRecord[];
  total: number;
  page: number;
  pageSize: number;
  filters: { q: string; project: string; status: string; from: string; to: string };
  unbilled: { seconds: number; amount: number };
  runningTimer: TimeEntryRecord | null;
  analytics: TimeAnalytics;
  projects: TimerProjectOption[];
  clients: Array<{ id: string; name: string }>;
  defaultHourlyRate?: number;
}

/**
 * Top-level Time dashboard: a Tracker view (timer + entries) and a Reports
 * view (analytics + exports), both driven by URL filters. Mutations go
 * through server actions and a `router.refresh()` re-hydrates the snapshot.
 */
export function TimeDashboardView({
  entries,
  summaryEntries,
  total,
  page,
  pageSize,
  filters,
  unbilled,
  runningTimer,
  analytics,
  projects,
  clients,
  defaultHourlyRate = 0,
}: TimeDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [manualOpen, setManualOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<TimeEntryRecord | null>(null);
  const [search, setSearch] = React.useState(filters.q);
  const [tab, setTab] = React.useState<"tracker" | "reports">("tracker");

  const setParam = React.useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "" || v === "all") sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [router, pathname, searchParams],
  );

  React.useEffect(() => {
    if (search === filters.q) return;
    const t = setTimeout(() => setParam({ q: search || null }), 400);
    return () => clearTimeout(t);
  }, [search, filters.q, setParam]);

  const goToPage = (next: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next <= 1) sp.delete("page");
    else sp.set("page", String(next));
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const exportHref = (format: "csv" | "pdf") => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("page");
    sp.set("format", format);
    return `/api/time/export?${sp.toString()}`;
  };

  const lookup: TimeEntryLookup = React.useMemo(() => {
    const projectById = new Map(projects.map((p) => [p.id, { name: p.name }]));
    const clientById = new Map(clients.map((c) => [c.id, { name: c.name }]));
    return { projectById, clientById };
  }, [projects, clients]);

  const projectName = React.useCallback(
    (id: string | null) =>
      id ? (lookup.projectById.get(id)?.name ?? "Unknown project") : "No project",
    [lookup],
  );
  const clientName = React.useCallback(
    (id: string | null) =>
      id ? (lookup.clientById.get(id)?.name ?? "Unknown client") : "No client",
    [lookup],
  );

  const thisWeek = summaryEntries;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const perProject = React.useMemo(() => {
    const map = new Map<string, { seconds: number; amount: number }>();
    for (const e of thisWeek) {
      const key = e.projectId ?? "__none__";
      const cur = map.get(key) ?? { seconds: 0, amount: 0 };
      cur.seconds += e.durationSeconds;
      if (e.billable) cur.amount += Number(e.amount) || 0;
      map.set(key, cur);
    }
    const total = Array.from(map.values()).reduce((s, v) => s + v.seconds, 0) || 1;
    return Array.from(map.entries())
      .map(([projectId, v]) => ({
        projectId,
        name:
          projectId === "__none__"
            ? "No project"
            : (lookup.projectById.get(projectId)?.name ?? "Unknown project"),
        seconds: v.seconds,
        pct: Math.round((v.seconds / total) * 100),
        billable: v.amount,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [thisWeek, lookup]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time"
        description="Track billable hours, log time, and see where your week went."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Review my unbilled time by client and project. Tell me what is ready to invoice and why; don't create an invoice yet."
              label="Ask Ivo"
              variant="outline"
            />
            <IvoEntryPoint
              prompt="Log time for a project"
              label="Log with AI"
              variant="secondary"
            />
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Plus /> Log time
            </Button>
          </div>
        }
      />

      {/* View switcher */}
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab("tracker")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition",
            tab === "tracker"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Clock className="h-3.5 w-3.5" /> Tracker
        </button>
        <button
          type="button"
          onClick={() => setTab("reports")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition",
            tab === "reports"
              ? "bg-background shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Reports
        </button>
      </div>

      {tab === "tracker" && (
      <div className={cn("grid items-start gap-6", "grid-cols-1")}>
        <div className="min-w-0 space-y-6">
      <UnbilledBanner seconds={unbilled.seconds} amount={unbilled.amount} />

      <TimeSummaryCards entries={thisWeek} />

      <ActiveTimerWidget
        running={runningTimer}
        projects={projects}
        defaultHourlyRate={defaultHourlyRate}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* Entries */}
        <div className="space-y-3">
          <div className="grid gap-2 sm:flex sm:min-w-0 sm:items-center">
            <div className="relative w-full sm:min-w-[260px] sm:flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search entries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <div className="w-full sm:w-[180px] sm:shrink-0">
              <Select value={filters.project} onValueChange={(v) => setParam({ project: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[160px] sm:shrink-0">
              <Select value={filters.status} onValueChange={(v) => setParam({ status: v })}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="billable">Billable</SelectItem>
                  <SelectItem value="non_billable">Non-billable</SelectItem>
                  <SelectItem value="unbilled">Unbilled</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <TimeEntriesTable entries={entries} lookup={lookup} onEdit={setEditingEntry} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} entries
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-8" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button size="sm" variant="outline" className="h-8" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Project breakdown */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                  This week by project
                </p>
                <span className="text-micro text-muted-foreground">7d</span>
              </div>
              {perProject.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Nothing tracked yet this week.
                </p>
              ) : (
                <ul className="space-y-3">
                  {perProject.map((row) => (
                    <li key={row.projectId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatDuration(row.seconds, { compact: true })}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${row.pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{secondsToHours(row.seconds)}h</span>
                        <span className="tabular-nums">
                          {formatINR(row.billable)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
        </div>

      </div>
      )}

      {tab === "reports" && (
        <div className="space-y-6">
          <ReportsToolbar
            filters={filters}
            projects={projects}
            setParam={setParam}
            exportHref={exportHref}
          />
          <TimeAnalyticsLazy
            analytics={analytics}
            projectName={projectName}
            clientName={clientName}
          />
        </div>
      )}

      <ManualEntryDialog
        open={manualOpen || editingEntry !== null}
        onOpenChange={(o) => {
          if (!o) {
            setManualOpen(false);
            setEditingEntry(null);
          } else {
            setManualOpen(true);
          }
        }}
        projects={projects}
        defaultHourlyRate={defaultHourlyRate}
        initialAiDraft={null}
        editing={editingEntry}
      />
    </div>
  );
}

function ReportsToolbar({
  filters,
  projects,
  setParam,
  exportHref,
}: {
  filters: { project: string; status: string; from: string; to: string };
  projects: TimerProjectOption[];
  setParam: (updates: Record<string, string | null>) => void;
  exportHref: (format: "csv" | "pdf") => string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 sm:flex sm:items-end">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
        <label className="space-y-1">
          <span className="text-micro font-medium text-muted-foreground">From</span>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setParam({ from: e.target.value || null })}
            className="h-9 w-full sm:w-[150px]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-micro font-medium text-muted-foreground">To</span>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setParam({ to: e.target.value || null })}
            className="h-9 w-full sm:w-[150px]"
          />
        </label>
      </div>
      <div className="w-full sm:w-[180px] sm:shrink-0">
        <Select value={filters.project} onValueChange={(v) => setParam({ project: v })}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2 sm:ml-auto">
        <Button asChild size="sm" variant="outline" className="h-9">
          <a href={exportHref("csv")}>
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9">
          <a href={exportHref("pdf")} target="_blank" rel="noopener noreferrer">
            <FileText className="h-3.5 w-3.5" /> PDF
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Strip surfacing total uninvoiced billable value with a one-click path to
 * invoice it. Hidden when everything is billed.
 */
function UnbilledBanner({ seconds, amount }: { seconds: number; amount: number }) {
  if (seconds === 0 || amount === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold">
          {formatINR(amount)} of billable time
        </span>{" "}
        <span className="text-muted-foreground">
          ({formatDuration(seconds, { compact: true })}) hasn&rsquo;t been
          invoiced yet.
        </span>
      </p>
      <Button
        type="button"
        size="sm"
        className="h-8 shrink-0 self-start sm:self-auto"
        onClick={() => openIvo("Create an invoice for my unbilled time")}
      >
        Bill this time <ArrowRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
