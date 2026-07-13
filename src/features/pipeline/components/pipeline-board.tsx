"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, CircleDollarSign, FolderKanban, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";
import { ProjectStatusChip } from "@/features/projects/components/project-status-chip";
import type { ProjectRecord } from "@/features/projects/server";
import {
  PROJECT_KANBAN_STATUSES,
  PROJECT_STATUS_CONFIG,
  PROJECT_STATUS_LABEL,
} from "@/features/projects/status";
import type { ProjectStatusRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export interface PipelineClient {
  id: string;
  name: string;
  country: string;
  currency: string;
  isForeign: boolean;
}

export interface PipelineProjectValue {
  projectId: string;
  amount: number;
  currency: string;
  invoiceCount: number;
  openAmount: number;
}

interface PipelineBoardProps {
  projects: ProjectRecord[];
  clients: PipelineClient[];
  values: PipelineProjectValue[];
}

const ATTENTION_STATUSES = new Set<ProjectStatusRow>([
  "lead",
  "proposal_sent",
  "contract_sent",
  "waiting_on_client",
  "invoiced",
]);

export function PipelineBoard({ projects, clients, values }: PipelineBoardProps) {
  const [query, setQuery] = React.useState("");
  const clientById = React.useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const valueByProject = React.useMemo(
    () => new Map(values.map((value) => [value.projectId, value])),
    [values],
  );

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((project) => {
      const client = project.clientId ? clientById.get(project.clientId) : null;
      return (
        project.name.toLowerCase().includes(term) ||
        (project.description ?? "").toLowerCase().includes(term) ||
        (client?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [clientById, projects, query]);

  const grouped = React.useMemo(() => {
    const map = new Map<ProjectStatusRow, ProjectRecord[]>();
    for (const status of PROJECT_KANBAN_STATUSES) map.set(status, []);
    for (const project of filtered) {
      if (!map.has(project.status)) map.set(project.status, []);
      map.get(project.status)?.push(project);
    }
    return map;
  }, [filtered]);

  const activeCount = projects.filter((project) =>
    ["active", "waiting_on_client", "revision", "review"].includes(project.status),
  ).length;
  const internationalCount = projects.filter((project) => {
    const client = project.clientId ? clientById.get(project.clientId) : null;
    return client?.isForeign;
  }).length;
  const attentionCount = projects.filter((project) =>
    ATTENTION_STATUSES.has(project.status),
  ).length;
  const openValue = values.reduce((sum, value) => sum + value.openAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Track client work from lead to proposal, contract, delivery, invoice, and payment."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Review my client pipeline and tell me which follow-ups or next actions matter most."
              label="Ask Ivo"
              variant="outline"
            />
            <Button asChild size="sm">
              <Link href="/dashboard/projects?create=1">
                <Plus /> New project
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric label="Active work" value={activeCount.toString()} hint="Projects in motion" />
        <PipelineMetric label="Needs attention" value={attentionCount.toString()} hint="Follow-ups or next steps" />
        <PipelineMetric label="Global clients" value={internationalCount.toString()} hint="Foreign-client projects" />
        <PipelineMetric label="Open invoiced value" value={formatMoney("INR", openValue)} hint="Converted view comes later" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pipeline..."
            className="h-9 pl-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openIvo("What should I move forward first in my pipeline?")}
        >
          Ask what to move first
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No pipeline yet"
          description="Create a project or lead to start tracking client work from proposal to payment."
          action={{ label: "Create project", href: "/dashboard/projects?create=1" }}
          secondaryAction={{
            label: "Ask Ivo",
            onClick: () => openIvo("Help me set up my first client pipeline in Stackivo."),
          }}
        />
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="grid min-w-[1040px] grid-cols-5 gap-3 xl:min-w-0 xl:grid-cols-7">
            {PROJECT_KANBAN_STATUSES.map((status) => (
              <PipelineColumn
                key={status}
                status={status}
                projects={grouped.get(status) ?? []}
                clientById={clientById}
                valueByProject={valueByProject}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PipelineColumn({
  status,
  projects,
  clientById,
  valueByProject,
}: {
  status: ProjectStatusRow;
  projects: ProjectRecord[];
  clientById: Map<string, PipelineClient>;
  valueByProject: Map<string, PipelineProjectValue>;
}) {
  const config = PROJECT_STATUS_CONFIG[status];
  return (
    <section className="flex max-h-[calc(100vh-18rem)] min-h-[26rem] flex-col rounded-xl border bg-muted/20">
      <div className="sticky top-0 z-10 border-b bg-card/95 p-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
              <h2 className="truncate text-sm font-semibold">{config.label}</h2>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
              {config.description}
            </p>
          </div>
          <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold tabular-nums">
            {projects.length}
          </span>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground">
            No {PROJECT_STATUS_LABEL[status].toLowerCase()} work.
          </div>
        ) : (
          projects.map((project) => {
            const client = project.clientId ? clientById.get(project.clientId) : null;
            const value = valueByProject.get(project.id);
            return (
              <PipelineCard
                key={project.id}
                project={project}
                client={client}
                value={value}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function PipelineCard({
  project,
  client,
  value,
}: {
  project: ProjectRecord;
  client: PipelineClient | null | undefined;
  value: PipelineProjectValue | undefined;
}) {
  const due = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : "No due date";

  const prompt = `For project "${project.name}"${client ? ` with ${client.name}` : ""}, suggest the best next action from the ${PROJECT_STATUS_LABEL[project.status]} stage.`;

  return (
    <article className="rounded-lg border bg-background p-3 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="line-clamp-2 text-sm font-semibold tracking-tight hover:text-primary"
          >
            {project.name}
          </Link>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            {client?.name ?? "No client"}
          </p>
        </div>
        {client?.isForeign && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            Global
          </span>
        )}
      </div>

      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
        <ProjectStatusChip projectId={project.id} status={project.status} size="sm" />
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {due}
        </span>
        <span className="flex items-center gap-1">
          <CircleDollarSign className="h-3 w-3" />
          {value && value.invoiceCount > 0
            ? `${formatMoney(value.currency, value.amount)} invoiced`
            : project.billingEnabled
              ? `${formatMoney(client?.currency ?? "INR", project.hourlyRate)}/h`
              : "No value yet"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Link href={`/dashboard/projects/${project.id}`}>Open</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => openIvo(prompt)}
        >
          Ask Ivo
        </Button>
      </div>
    </article>
  );
}

function formatMoney(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "INR"} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}
