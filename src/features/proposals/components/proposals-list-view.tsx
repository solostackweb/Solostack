"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ExternalLink,
  FilePlus2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  deleteProposalAction,
  sendProposalEmailAction,
} from "../actions";
import type { ProposalRecord } from "../server";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_CLASS,
  PROPOSAL_STATUS_LABEL,
} from "../status";
import type { ProposalStatusRow } from "@/lib/supabase/types";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
  currency: string;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string | null;
}

interface ProposalsListViewProps {
  proposals: ProposalRecord[];
  clients: ClientOption[];
  projects: ProjectOption[];
}

export function ProposalsListView({
  proposals,
  clients,
  projects,
}: ProposalsListViewProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ProposalStatusRow | "all">("all");
  const [, startTransition] = React.useTransition();

  const clientById = React.useMemo(
    () => new Map(clients.map((client) => [client.id, client])),
    [clients],
  );
  const projectById = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return proposals.filter((proposal) => {
      if (statusFilter !== "all" && proposal.status !== statusFilter) return false;
      if (!term) return true;
      const clientName = proposal.clientId ? clientById.get(proposal.clientId)?.name ?? "" : "";
      const projectName = proposal.projectId ? projectById.get(proposal.projectId)?.name ?? "" : "";
      return [proposal.title, clientName, projectName].some((value) =>
        value.toLowerCase().includes(term),
      );
    });
  }, [clientById, projectById, proposals, search, statusFilter]);

  const stats = React.useMemo(() => {
    const open = proposals.filter((p) => ["draft", "sent", "viewed"].includes(p.status)).length;
    const accepted = proposals.filter((p) => p.status === "accepted").length;
    const openValue = proposals
      .filter((p) => ["draft", "sent", "viewed"].includes(p.status))
      .reduce((sum, proposal) => sum + proposal.totalAmount, 0);
    return { total: proposals.length, open, accepted, openValue };
  }, [proposals]);

  const handleDelete = async (proposal: ProposalRecord) => {
    const ok = await confirm({
      title: `Delete "${proposal.title}"?`,
      description: "This proposal and its items will be removed permanently.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", proposal.id);
    startTransition(async () => {
      const res = await deleteProposalAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Proposal deleted");
      router.refresh();
    });
  };

  const handleSend = async (proposal: ProposalRecord) => {
    startTransition(async () => {
      const res = await sendProposalEmailAction({ id: proposal.id });
      if (!res.ok) {
        toast.error(`${res.error} Opening builder to fix it.`);
        router.push(`/dashboard/proposals/${proposal.id}`);
        return;
      }
      toast.success("Proposal sent to client");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        description="Package scope, pricing, and next steps before a contract or invoice."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <IvoEntryPoint
              prompt="Review my open proposals and suggest what I should follow up on."
              label="Ask Ivo"
              variant="outline"
            />
            <Button asChild size="sm">
              <Link href="/dashboard/proposals/new">
              <Plus /> New proposal
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total proposals" value={stats.total.toString()} />
        <Stat label="Open" value={stats.open.toString()} tone="blue" />
        <Stat label="Accepted" value={stats.accepted.toString()} tone="green" />
        <Stat label="Open value" value={formatMoney(stats.openValue, "INR")} />
      </div>

      <div className="grid gap-2 sm:flex sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search proposals, clients, projects..."
            className="h-9 pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as ProposalStatusRow | "all")}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {PROPOSAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PROPOSAL_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title={proposals.length === 0 ? "No proposals yet" : "No proposals match your filters"}
          description={
            proposals.length === 0
              ? "Create your first proposal to turn a client conversation into a packaged offer."
              : "Try a different search term or status filter."
          }
          action={{ label: "New proposal", href: "/dashboard/proposals/new" }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((proposal) => {
            const client = proposal.clientId ? clientById.get(proposal.clientId) : null;
            const project = proposal.projectId ? projectById.get(proposal.projectId) : null;
            return (
              <Card key={proposal.id} className="overflow-hidden">
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate text-base font-semibold">
                        <Link
                          href={`/dashboard/proposals/${proposal.id}`}
                          className="hover:underline"
                        >
                          {proposal.title}
                        </Link>
                      </h3>
                      <ProposalStatusBadge status={proposal.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{client?.name ?? "No client"}</span>
                      {project ? <span>{project.name}</span> : null}
                      {proposal.validUntil ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Valid until {formatDate(proposal.validUntil)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {formatMoney(proposal.totalAmount, proposal.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Updated {formatDate(proposal.updatedAt)}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Proposal actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/proposals/${proposal.id}`}>
                            <ExternalLink className="h-4 w-4" /> Open builder
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleSend(proposal)}>
                          <Mail className="h-4 w-4" /> Send to client
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => void handleDelete(proposal)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProposalStatusBadge({ status }: { status: ProposalStatusRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        PROPOSAL_STATUS_CLASS[status],
      )}
    >
      {PROPOSAL_STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "blue" | "green" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-bold",
            tone === "blue" && "text-blue-600 dark:text-blue-300",
            tone === "green" && "text-emerald-600 dark:text-emerald-300",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
