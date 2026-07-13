"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Users,
  FileText,
  MoreHorizontal,
  Pencil,
  Archive,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatMoney } from "@/lib/format";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";

import type { ProjectRecord } from "../server";
import type { ClientRecord } from "@/features/clients/server";
import {
  getClientDisplayName,
  getClientInitials,
} from "@/features/clients/utils";
import { ProjectStatusChip } from "./project-status-chip";
import { ProjectStatusHistory } from "./project-status-history";
import type { ProjectStatusHistoryEntry } from "../server";
import { ProjectFormDialog } from "./project-form-dialog";
import {
  deleteProjectAction,
  setProjectStatusAction,
} from "../actions";

export interface LinkedInvoice {
  id: string;
  number: string | null;
  status: string | null;
  totalAmount: number;
  currency: string;
  inrEquivalent: number | null;
  issueDate: string | null;
}

interface ProjectDetailViewProps {
  project: ProjectRecord;
  client: ClientRecord | null;
  invoices: LinkedInvoice[];
  clients: Array<{ id: string; name: string; currency?: string | null }>;
  /** Newest-first list of status changes for this project. */
  statusHistory: ProjectStatusHistoryEntry[];
}

/**
 * Top-level detail page for a single project. Shows the hero (status,
 * dates, description), linked invoices, and the client side-panel. Edit
 * + archive + delete all go through real server actions.
 */
export function ProjectDetailView({
  project,
  client,
  invoices,
  clients,
  statusHistory,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const dueDate = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const startDate = project.startDate
    ? new Date(project.startDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  const handleArchive = () => {
    const fd = new FormData();
    fd.set("id", project.id);
    fd.set("status", "archived");
    startTransition(async () => {
      const res = await setProjectStatusAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Project archived");
      setArchiveOpen(false);
      router.refresh();
    });
  };

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("id", project.id);
    startTransition(async () => {
      const res = await deleteProjectAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Project deleted");
      setDeleteOpen(false);
      router.push("/dashboard/projects");
    });
  };

  const billedTotal = invoices.reduce(
    (s, i) => s + (i.inrEquivalent ?? i.totalAmount ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/dashboard/projects" aria-label="Back to projects">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            <Link
              href="/dashboard/projects"
              className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:inline"
            >
              Projects
            </Link>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="truncate font-medium">{project.name}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setArchiveOpen(true)}
                disabled={project.status === "archived"}
              >
                <Archive className="h-3.5 w-3.5" /> Archive project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ProjectStatusChip
                  projectId={project.id}
                  status={project.status}
                />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="max-w-2xl text-sm text-muted-foreground whitespace-pre-line">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <IvoContextActions
        title={`Project help for ${project.name}`}
        description="Ask Ivo with this project's client, status, dates, and billing context."
        actions={[
          {
            label: "Project summary",
            prompt: `Summarize project ${project.name}. Status: ${project.status}. Client: ${client ? getClientDisplayName(client) : "No client"}. Start: ${startDate}. Due: ${dueDate}. Billed so far: ${formatINR(billedTotal)}. Tell me what needs attention next.`,
          },
          {
            label: "Invoice next",
            prompt: `Help me decide what to invoice next for project ${project.name}. Use linked invoices and project status context.`,
          },
          {
            label: "Client update",
            prompt: `Draft a concise client update for project ${project.name}. Include current status ${project.status} and any useful next step.`,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  Invoices · {invoices.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Billed to date:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatINR(billedTotal)}
                  </span>
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/invoices/new">
                  <Plus /> New
                </Link>
              </Button>
            </div>

            {invoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices linked yet"
                description="Create an invoice and tag it with this project to see it here."
                action={{
                  label: "New invoice",
                  href: "/dashboard/invoices/new",
                }}
                className="min-h-[180px]"
              />
            ) : (
              <ul className="divide-y">
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {inv.number ?? inv.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inv.status ?? "draft"}
                          {inv.issueDate
                            ? ` · ${new Date(inv.issueDate).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums">
                        {formatMoney(inv.totalAmount, inv.currency)}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/invoices/${inv.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status history
              </h2>
              <ProjectStatusHistory entries={statusHistory} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 p-5 text-sm">
              <MetaRow label="Client" icon={Users}>
                {client ? (
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">
                        {getClientInitials(getClientDisplayName(client))}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">
                      {getClientDisplayName(client)}
                    </span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </MetaRow>
              <MetaRow label="Start" icon={Calendar}>
                <span className="tabular-nums">{startDate}</span>
              </MetaRow>
              <MetaRow label="Due" icon={Calendar}>
                <span className="tabular-nums">{dueDate}</span>
              </MetaRow>
              <MetaRow label="Created" icon={Calendar}>
                <span className="tabular-nums">
                  {new Date(project.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </MetaRow>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        clients={clients}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this project?"
        description="Archived projects are hidden from the main list but retain all linked invoices."
        confirmLabel={pending ? "Archiving…" : "Archive project"}
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this project?"
        description="This permanently deletes the project. Linked invoices and time entries will be unlinked."
        confirmLabel={pending ? "Deleting…" : "Delete project"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

function MetaRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
