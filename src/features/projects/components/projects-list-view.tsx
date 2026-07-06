"use client";

import * as React from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  Columns3,
  FolderKanban,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";
import { cn } from "@/lib/utils";
import type { ProjectStatusRow } from "@/lib/supabase/types";

import type { ProjectRecord } from "../server";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  PROJECT_KANBAN_STATUSES,
} from "../status";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectsBulkBar } from "./projects-bulk-bar";

type ViewMode = "grid" | "kanban";

const KANBAN_COLUMNS: ProjectStatusRow[] = PROJECT_KANBAN_STATUSES;

interface ProjectsListViewProps {
  projects: ProjectRecord[];
  clients: Array<{ id: string; name: string; currency?: string | null }>;
  /** When true (from ?create=1 URL param), auto-opens the new-project dialog on mount. */
  autoCreate?: boolean;
}

/**
 * Top-level Projects view: header + filters + view toggle (grid ↔ kanban).
 * Filtering happens locally on the snapshot passed from the server page.
 */
export function ProjectsListView({ projects, clients, autoCreate }: ProjectsListViewProps) {
  const [view, setView] = React.useState<ViewMode>("grid");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    ProjectStatusRow | "all"
  >("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  // Auto-open the create dialog when navigated from the FAB (?create=1).
  React.useEffect(() => {
    if (autoCreate) setCreateOpen(true);
  }, [autoCreate]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const toggleSelected = React.useCallback((id: string, next: boolean) => {
    setSelectedIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }, []);
  const clearSelection = React.useCallback(() => setSelectedIds(new Set()), []);

  const clientNameById = React.useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [projects, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Organize work, files, and billables by engagement."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Review my active projects and tell me what needs attention."
              label="Ask Ivo"
              variant="outline"
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> New project
            </Button>
          </div>
        }
      />

      {/* Two-row toolbar on mobile: search on its own line for full width,
          filter + view-toggle share a second line. Collapses back to a
          single inline row on sm+. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-md sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as ProjectStatusRow | "all")
            }
          >
            <SelectTrigger className="h-9 w-full min-w-[140px] sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto inline-flex shrink-0 rounded-md bg-muted p-0.5">
            <ViewToggleButton
              active={view === "grid"}
              onClick={() => setView("grid")}
              icon={LayoutGrid}
              label="Grid"
            />
            <ViewToggleButton
              active={view === "kanban"}
              onClick={() => setView("kanban")}
              icon={Columns3}
              label="Kanban"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={
            projects.length === 0
              ? "No projects yet"
              : "No projects match your filters"
          }
          description={
            projects.length === 0
              ? "Create a project to group files, invoices, and contracts."
              : "Try a different search term or status filter."
          }
          action={
            projects.length === 0
              ? { label: "Create project", onClick: () => setCreateOpen(true) }
              : undefined
          }
          secondaryAction={
            projects.length === 0
              ? {
                  label: "Ask Ivo",
                  onClick: () => openIvo("Help me create my first project."),
                }
              : undefined
          }
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              clientName={p.clientId ? clientNameById.get(p.clientId) : null}
              selectable
              selected={selectedIds.has(p.id)}
              onSelectedChange={(v) => toggleSelected(p.id, v)}
            />
          ))}
        </div>
      ) : (
        <KanbanBoard
          projects={filtered}
          clientNameById={clientNameById}
          selectedIds={selectedIds}
          onToggleSelected={toggleSelected}
        />
      )}

      <ProjectsBulkBar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
      />

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        clients={clients}
      />
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * Kanban board. Read-only — no drag/drop yet; status transitions happen
 * via the edit dialog. The architecture groups projects by status column
 * so a future dnd-kit integration only needs to wire the drop handler.
 */
function KanbanBoard({
  projects,
  clientNameById,
  selectedIds,
  onToggleSelected,
}: {
  projects: ProjectRecord[];
  clientNameById: Map<string, string>;
  selectedIds: Set<string>;
  onToggleSelected: (id: string, next: boolean) => void;
}) {
  // Group with a Map so we don't need to hard-code every status — the
  // registry is the source of truth for column membership.
  const byStatus = React.useMemo(() => {
    const map = new Map<ProjectStatusRow, ProjectRecord[]>();
    for (const s of PROJECT_STATUSES) map.set(s, []);
    for (const p of projects) map.get(p.status)?.push(p);
    return map;
  }, [projects]);

  return (
    <div className="-mx-4 overflow-x-auto pb-2 sm:-mx-6 lg:-mx-8">
      <div className="flex min-w-max gap-4 px-4 sm:px-6 lg:px-8">
        {KANBAN_COLUMNS.map((status) => {
          const items = byStatus.get(status) ?? [];
          return (
            <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {PROJECT_STATUS_LABEL[status]}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-muted-foreground">
                    Nothing here
                  </p>
                ) : (
                  items.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      clientName={
                        p.clientId ? clientNameById.get(p.clientId) : null
                      }
                      variant="kanban"
                      className="bg-background"
                      selectable
                      selected={selectedIds.has(p.id)}
                      onSelectedChange={(v) => onToggleSelected(p.id, v)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
