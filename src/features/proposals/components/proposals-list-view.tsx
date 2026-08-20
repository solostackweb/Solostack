"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Send,
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
import {
  IvoEntryPoint,
  openIvo,
} from "@/features/ai-workflows/components/ivo-entry-point";
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

const proposalFlow = [
  { label: "Draft", icon: FilePlus2 },
  { label: "Client review", icon: Send },
  { label: "Accepted", icon: CheckCircle2 },
];

function EmptyProposalDesk() {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border/60 bg-primary/[0.025] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            Proposal desk
          </p>
          <h2 className="mt-3 max-w-md font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Make the next yes easy.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Put the scope, price, validity, and next step in one offer your
            client can act on.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link href="/dashboard/proposals/new">
                <Plus /> New proposal
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => openIvo("Help me draft my first proposal.")}
            >
              Ask Ivo
            </Button>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-lg rounded-lg border border-border/70 bg-background p-5 sm:p-6">
            <div className="border-b border-border/60 pb-5">
              <p className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Client decision
              </p>
              <p className="mt-2 text-base font-semibold">
                One offer, one clear next step
              </p>
            </div>

            <div className="relative mt-6 grid grid-cols-3">
              <div
                aria-hidden
                className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-primary/25"
              />
              {proposalFlow.map(({ label, icon: Icon }, index) => (
                <div
                  key={label}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <span
                    className={
                      index === 0
                        ? "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                        : "flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-2 text-xs font-semibold">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 divide-y divide-border/60 border-t border-border/60">
              {[
                "Scope and deliverables",
                "Price and validity",
                "Convert after acceptance",
              ].map((label, index) => (
                <div key={label} className="flex items-center gap-3 py-3 text-sm">
                  <span className="font-mono text-micro text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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
          proposals.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <IvoEntryPoint
                prompt="Review my open proposals and suggest what I should follow up on."
                label="Ask Ivo"
                variant="secondary"
              />
              <Button asChild size="sm">
                <Link href="/dashboard/proposals/new">
                  <Plus /> New proposal
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      {proposals.length === 0 ? (
        <EmptyProposalDesk />
      ) : (
        <>
          <Card>
            <CardContent className="grid grid-cols-2 divide-x-0 divide-y p-0 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <Stat label="Total proposals" value={stats.total.toString()} />
              <Stat label="Open" value={stats.open.toString()} tone="blue" />
              <Stat label="Accepted" value={stats.accepted.toString()} tone="green" />
              <Stat label="Open value" value={formatMoney(stats.openValue, "INR")} />
            </CardContent>
          </Card>

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
              onChange={(event) =>
                setStatusFilter(event.target.value as ProposalStatusRow | "all")
              }
              className="h-9 rounded-lg border bg-background px-3 text-sm"
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
              title="No proposals match your filters"
              description="Try a different search term or status filter."
            />
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
              <div className="hidden grid-cols-[minmax(220px,1fr)_110px_130px_120px_32px] items-center gap-3 border-b bg-muted/20 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                <span>Proposal</span>
                <span>Status</span>
                <span>Valid until</span>
                <span className="text-right">Value</span>
                <span className="sr-only">Actions</span>
              </div>
              <div className="divide-y">
              {filtered.map((proposal) => {
            const client = proposal.clientId ? clientById.get(proposal.clientId) : null;
            const project = proposal.projectId ? projectById.get(proposal.projectId) : null;
            return (
              <div
                key={proposal.id}
                className="grid gap-3 p-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(220px,1fr)_110px_130px_120px_32px] md:items-center md:px-5 md:py-3.5"
              >
                  <div className="flex min-w-0 items-start justify-between gap-3 md:contents">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">
                        <Link
                          href={`/dashboard/proposals/${proposal.id}`}
                          className="hover:underline"
                        >
                          {proposal.title}
                        </Link>
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                        <span>{client?.name ?? "No client"}</span>
                        {project ? <><span aria-hidden>·</span><span>{project.name}</span></> : null}
                      </div>
                    </div>
                      <ProposalStatusBadge status={proposal.status} />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t pt-3 md:contents">
                    <span className="text-sm text-muted-foreground">
                      {proposal.validUntil ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline md:hidden">Valid until </span>{formatDate(proposal.validUntil)}
                        </span>
                      ) : "—"}
                    </span>
                    <div className="text-right md:contents">
                      <div className="text-base font-semibold tabular-nums md:text-right">
                        {formatMoney(proposal.totalAmount, proposal.currency)}
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
              </div>
            );
              })}
              </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ProposalStatusBadge({ status }: { status: ProposalStatusRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-self-start rounded-full border px-2 py-0.5 text-xs font-semibold",
        PROPOSAL_STATUS_CLASS[status],
      )}
    >
      {PROPOSAL_STATUS_LABEL[status]}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "blue" | "green" }) {
  return (
      <div className="min-h-24 p-4 sm:p-5">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <div
          className={cn(
            "mt-2 text-2xl font-bold",
            tone === "blue" && "text-blue-600 dark:text-blue-300",
            tone === "green" && "text-success-strong",
          )}
        >
          {value}
        </div>
      </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
