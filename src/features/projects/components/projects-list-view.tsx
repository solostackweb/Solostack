"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BadgeIndianRupee,
  ClipboardList,
  FileText,
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
import { changeProjectStatusAction } from "../actions";

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
        description="Keep each job, its files, and its billing in one place."
        className="border-b-0 pb-0 sm:pb-0"
        actions={
          <div className="flex items-center gap-2">
            {projects.length > 0 ? (
              <>
                <IvoEntryPoint
                  prompt="Review my active projects and tell me what needs attention."
                  label="Ask Ivo"
                  variant="secondary"
                />
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> New project
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {/* Two-row toolbar on mobile: search on its own line for full width,
          filter + view-toggle share a second line. Collapses back to a
          single inline row on sm+. */}
      {projects.length > 0 ? (
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

          <div className="ml-auto inline-flex shrink-0 rounded-lg bg-muted p-0.5">
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
              className="hidden sm:inline-flex"
            />
          </div>
        </div>
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyProjectsWorkspace onCreate={() => setCreateOpen(true)} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center">
          <h2 className="text-base font-semibold">
            No projects match these filters
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Change the search term or status to see more projects.
          </p>
        </div>
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

const projectFlow = [
  { label: "Brief", note: "Define the job", icon: ClipboardList },
  { label: "Work", note: "Track progress", icon: FolderKanban },
  { label: "Invoice", note: "Bill clearly", icon: FileText },
  { label: "Paid", note: "Close the loop", icon: BadgeIndianRupee },
];

function EmptyProjectsWorkspace({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border/60 bg-primary/[0.025] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            Project workspace
          </p>
          <h2 className="mt-3 max-w-md font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Keep every job moving from brief to paid.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            One project keeps the client, files, progress, and billing connected
            from the first task to the final payment.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={onCreate} className="min-h-11">
              <Plus /> Create your first project
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => openIvo("Help me create my first project.")}
            >
              Ask Ivo
            </Button>
          </div>
        </div>

        <div className="flex min-h-64 items-center p-6 sm:p-10">
          <div className="relative grid w-full grid-cols-4">
            <div
              aria-hidden
              className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-primary/25"
            />
            {projectFlow.map(({ label, note, icon: Icon }, index) => (
              <div
                key={label}
                className="relative z-10 flex flex-col items-center text-center"
              >
                <span
                  className={
                    index === 0
                      ? "flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                      : "flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"
                  }
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-3 text-xs font-semibold">{label}</span>
                <span className="mt-1 hidden text-micro text-muted-foreground sm:block">
                  {note}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
  className,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
  className?: string;
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
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * Kanban board with drag-and-drop status changes (native HTML5 DnD — no
 * library). Drag a card into another column to move the project through the
 * lifecycle; the drop calls `changeProjectStatusAction` (which records history
 * + activity). An optimistic override moves the card immediately, then the
 * route refreshes. On touch devices, the card's status chip is the fallback.
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
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStatus, setOverStatus] = React.useState<ProjectStatusRow | null>(
    null,
  );
  // Optimistic status overrides so a dropped card jumps columns instantly.
  const [override, setOverride] = React.useState<
    Record<string, ProjectStatusRow>
  >({});

  const statusOf = React.useCallback(
    (p: ProjectRecord): ProjectStatusRow => override[p.id] ?? p.status,
    [override],
  );

  // Group with a Map so we don't need to hard-code every status — the
  // registry is the source of truth for column membership.
  const byStatus = React.useMemo(() => {
    const map = new Map<ProjectStatusRow, ProjectRecord[]>();
    for (const s of PROJECT_STATUSES) map.set(s, []);
    for (const p of projects) map.get(statusOf(p))?.push(p);
    return map;
  }, [projects, statusOf]);

  const handleDrop = (status: ProjectStatusRow) => {
    setOverStatus(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const current = projects.find((p) => p.id === id);
    if (!current || statusOf(current) === status) return;

    setOverride((prev) => ({ ...prev, [id]: status }));
    startTransition(async () => {
      const res = await changeProjectStatusAction({ id, status });
      if (!res.ok) {
        toast.error(res.error);
        setOverride((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }
      toast.success(`Moved to ${PROJECT_STATUS_LABEL[status]}`);
      router.refresh();
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto pb-2 sm:-mx-6 lg:-mx-8">
      <div className="flex min-w-max gap-4 px-4 sm:px-6 lg:px-8">
        {KANBAN_COLUMNS.map((status) => {
          const items = byStatus.get(status) ?? [];
          const isOver = overStatus === status;
          return (
            <div key={status} className="flex w-72 shrink-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                    {PROJECT_STATUS_LABEL[status]}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-micro font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </div>
              </div>
              <div
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overStatus !== status) setOverStatus(status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOverStatus((s) => (s === status ? null : s));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                }}
                className={cn(
                  "flex min-h-[80px] flex-col gap-2 rounded-lg bg-muted/30 p-2 transition-colors",
                  isOver && "bg-primary/10 ring-2 ring-primary/30",
                )}
              >
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {isOver ? "Drop here" : "Nothing here"}
                  </p>
                ) : (
                  items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", p.id);
                        setDragId(p.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStatus(null);
                      }}
                      className={cn(
                        "cursor-grab active:cursor-grabbing",
                        dragId === p.id && "opacity-50",
                      )}
                    >
                      <ProjectCard
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
                    </div>
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
