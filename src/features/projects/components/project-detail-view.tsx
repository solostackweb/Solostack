"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Users,
  FileText,
  FileSignature,
  BookOpen,
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
import { createProposalFromTemplateRedirectAction } from "@/features/proposals/actions";

export interface LinkedInvoice {
  id: string;
  number: string | null;
  status: string | null;
  totalAmount: number;
  currency: string;
  inrEquivalent: number | null;
  issueDate: string | null;
}

export interface LinkedProposal {
  id: string;
  title: string;
  status: string;
  totalAmount: number;
  currency: string;
}

export interface LinkedContract {
  id: string;
  title: string;
  status: string;
  valueAmount: number | null;
  currency: string;
}

export interface LinkedWelcome {
  id: string;
  title: string;
  status: string;
}

interface ProjectDetailViewProps {
  project: ProjectRecord;
  client: ClientRecord | null;
  invoices: LinkedInvoice[];
  proposals: LinkedProposal[];
  contracts: LinkedContract[];
  welcomeDocs: LinkedWelcome[];
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
  proposals,
  contracts,
  welcomeDocs,
  clients,
  statusHistory,
}: ProjectDetailViewProps) {
  const router = useRouter();
  const welcomeNewHref = `/dashboard/welcome/new?projectId=${project.id}${
    project.clientId ? `&clientId=${project.clientId}` : ""
  }`;
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
          <NewProposalButton
            projectId={project.id}
            clientId={project.clientId}
            currency={client?.currency}
            projectName={project.name}
          />
          <Button asChild size="sm">
            <Link href="/dashboard/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={welcomeNewHref}>
              <BookOpen className="h-4 w-4" /> Welcome doc
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
        <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  Proposals · {proposals.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Package scope and pricing before a contract.
                </p>
              </div>
              <NewProposalButton
                projectId={project.id}
                clientId={project.clientId}
                currency={client?.currency}
                projectName={project.name}
                label="New"
              />
            </div>

            {proposals.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No proposals yet"
                description="Send a proposal to move this engagement forward."
                className="min-h-[140px]"
              />
            ) : (
              <ul className="divide-y">
                {proposals.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {p.status.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm tabular-nums">
                        {formatMoney(p.totalAmount, p.currency)}
                      </span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/proposals/${p.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  Contracts · {contracts.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Agreements ready for signature.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/contracts/new">
                  <Plus /> New
                </Link>
              </Button>
            </div>

            {contracts.length === 0 ? (
              <EmptyState
                icon={FileSignature}
                title="No contracts yet"
                description="Convert an accepted proposal, or create one from scratch."
                className="min-h-[140px]"
              />
            ) : (
              <ul className="divide-y">
                {contracts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileSignature className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {c.status.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {c.valueAmount != null ? (
                        <span className="text-sm tabular-nums">
                          {formatMoney(c.valueAmount, c.currency)}
                        </span>
                      ) : null}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/contracts/${c.id}`}>View</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  Welcome docs · {welcomeDocs.length}
                </h2>
                <p className="text-xs text-muted-foreground">
                  A branded greeting to kick off the engagement.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={welcomeNewHref}>
                  <Plus /> New
                </Link>
              </Button>
            </div>

            {welcomeDocs.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No welcome docs yet"
                description="Send a warm, branded onboarding guide to your client."
                className="min-h-[140px]"
              />
            ) : (
              <ul className="divide-y">
                {welcomeDocs.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{w.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {w.status.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/welcome/${w.id}`}>View</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

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
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <h2 className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
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
                      <AvatarFallback className="text-xs">
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

/**
 * Creates a blank draft proposal already linked to this project + client,
 * then redirects straight into the builder — the fast "make a proposal from
 * this lead" path that closes the pipeline loop.
 */
function NewProposalButton({
  projectId,
  clientId,
  currency,
  projectName,
  label = "New proposal",
}: {
  projectId: string;
  clientId: string | null;
  currency?: string | null;
  projectName: string;
  label?: string;
}) {
  return (
    <form action={createProposalFromTemplateRedirectAction}>
      <input type="hidden" name="templateId" value="blank" />
      <input type="hidden" name="projectId" value={projectId} />
      {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
      {currency ? <input type="hidden" name="currency" value={currency} /> : null}
      <input type="hidden" name="title" value={`${projectName} proposal`} />
      <Button type="submit" size="sm" variant="outline">
        <Plus /> {label}
      </Button>
    </form>
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
        <span className="text-micro font-semibold uppercase tracking-wider">
          {label}
        </span>
      </span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
