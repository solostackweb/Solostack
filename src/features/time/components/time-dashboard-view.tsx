"use client";

import * as React from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";

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
  dateKeyFromISO,
  formatDuration,
  secondsToHours,
} from "../types";
import type { TimeEntryRecord } from "../server";
import {
  ActiveTimerWidget,
  type TimerProjectOption,
} from "./active-timer-widget";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { TimeSummaryCards } from "./time-summary-cards";
import {
  TimeEntriesTable,
  type TimeEntryLookup,
} from "./time-entries-table";
import {
  AiWorkflowTriggerButton,
  OperationalAiAgentWorkflow,
} from "@/features/ai-workflows/components/operational-ai-agent-workflow";
import type { AiTimeEntryDraft } from "@/features/ai-workflows/types";

interface TimeDashboardViewProps {
  entries: TimeEntryRecord[];
  runningTimer: TimeEntryRecord | null;
  projects: TimerProjectOption[];
  clients: Array<{ id: string; name: string }>;
  defaultHourlyRate?: number;
}

/**
 * Top-level Time dashboard: header + summary KPIs + live timer + project
 * breakdown + entries table. Initial state comes from the server page;
 * mutations go through server actions and a `router.refresh()` re-hydrates
 * the snapshot.
 */
export function TimeDashboardView({
  entries,
  runningTimer,
  projects,
  clients,
  defaultHourlyRate = 0,
}: TimeDashboardViewProps) {
  const [manualOpen, setManualOpen] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiDraft, setAiDraft] = React.useState<AiTimeEntryDraft | null>(null);
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState<string>("all");

  const lookup: TimeEntryLookup = React.useMemo(() => {
    const projectById = new Map(projects.map((p) => [p.id, { name: p.name }]));
    const clientById = new Map(clients.map((c) => [c.id, { name: c.name }]));
    return { projectById, clientById };
  }, [projects, clients]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (projectFilter !== "all") {
        const target = projectFilter === "__none__" ? null : projectFilter;
        if (e.projectId !== target) return false;
      }
      if (!term) return true;
      return (e.description ?? "").toLowerCase().includes(term);
    });
  }, [entries, search, projectFilter]);

  // Scope summaries to the last 7 days so "this week" feels accurate.
  const weekCutoff = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const thisWeek = React.useMemo(
    () => entries.filter((e) => dateKeyFromISO(e.startedAt) >= weekCutoff),
    [entries, weekCutoff],
  );

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
            <AiWorkflowTriggerButton
              active={aiOpen}
              onClick={() => setAiOpen((value) => !value)}
            >
              Generate time entry with AI
            </AiWorkflowTriggerButton>
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Plus /> Log time
            </Button>
          </div>
        }
      />

      <div
        className={cn(
          "grid items-start gap-6",
          aiOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1",
        )}
      >
        <div className="min-w-0 space-y-6">
      <UnbilledBanner entries={entries} />

      <TimeSummaryCards entries={thisWeek} />

      <ActiveTimerWidget
        running={runningTimer}
        projects={projects}
        defaultHourlyRate={defaultHourlyRate}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* Entries */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search entries…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="__none__">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TimeEntriesTable entries={filtered} lookup={lookup} />
        </div>

        {/* Project breakdown */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  This week by project
                </p>
                <span className="text-[11px] text-muted-foreground">7d</span>
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
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
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

        <OperationalAiAgentWorkflow<AiTimeEntryDraft>
          workflow="time_entry"
          title="Log time"
          intro="let's turn your work context into a clean time entry. I will draft the description, duration, billing state, and rate for review."
          projects={projects}
          defaultHourlyRate={defaultHourlyRate}
          open={aiOpen}
          onOpenChange={setAiOpen}
          applyLabel="Review time entry"
          onApplyDraft={(draft) => {
            setAiDraft(draft);
            setManualOpen(true);
          }}
        />
      </div>

      <ManualEntryDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        projects={projects}
        defaultHourlyRate={defaultHourlyRate}
        initialAiDraft={aiDraft}
      />
    </div>
  );
}

/**
 * Strip surfacing total uninvoiced billable value with a one-click path to
 * invoice it. Hidden when everything is billed.
 */
function UnbilledBanner({ entries }: { entries: TimeEntryRecord[] }) {
  const unbilled = entries.filter(
    (e) => e.billable && !e.invoiceId && e.endedAt,
  );
  const seconds = unbilled.reduce((s, e) => s + e.durationSeconds, 0);
  const amount = unbilled.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  if (seconds === 0 || amount === 0) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        <span className="font-semibold">
          {formatINR(amount)} of billable time
        </span>{" "}
        <span className="text-muted-foreground">
          ({formatDuration(seconds, { compact: true })}) hasn&rsquo;t been
          invoiced yet.
        </span>
      </p>
      <Button asChild size="sm" className="h-8 shrink-0 self-start sm:self-auto">
        <Link href="/dashboard/invoices/new">
          Bill this time <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
