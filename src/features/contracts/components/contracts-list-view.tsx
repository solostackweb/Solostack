"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileSignature,
  MoreHorizontal,
  Eye,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ContractRecord } from "../server";
import {
  CONTRACT_KIND_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
} from "../status";
import type { ContractStatusRow } from "@/lib/supabase/types";
import { ContractStatusBadge } from "./contract-status-badge";
import { ContractMobileCard } from "./contract-mobile-card";
import { deleteContractAction } from "../actions";
import { sendContractAction } from "../delivery";
import { IvoEntryPoint, openIvo } from "@/features/ai-workflows/components/ivo-entry-point";

interface ContractsListViewProps {
  contracts: ContractRecord[];
  clients: Array<{ id: string; name: string; email: string | null }>;
  projects: Array<{ id: string; name: string; clientId: string | null }>;
}

/**
 * Real-data contracts list. Receives the snapshot from the server page;
 * mutations route through server actions and `router.refresh()` re-hydrates.
 */
export function ContractsListView({
  contracts,
  clients,
}: ContractsListViewProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    ContractStatusRow | "all"
  >("all");
  const [, startTransition] = React.useTransition();

  const clientNameById = React.useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!term) return true;
      const clientName = c.clientId
        ? (clientNameById.get(c.clientId) ?? "")
        : "";
      return (
        c.title.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term)
      );
    });
  }, [contracts, search, statusFilter, clientNameById]);

  const stats = React.useMemo(() => {
    const total = contracts.length;
    const signed = contracts.filter((c) => c.status === "signed").length;
    const awaiting = contracts.filter(
      (c) => c.status === "sent" || c.status === "viewed",
    ).length;
    const value = contracts
      .filter((c) => c.status === "signed")
      .reduce((s, c) => s + (c.inrEquivalent ?? c.valueAmount ?? 0), 0);
    return { total, signed, awaiting, value };
  }, [contracts]);

  const confirm = useConfirm();

  const handleDelete = async (contract: ContractRecord) => {
    const ok = await confirm({
      title: `Delete "${contract.title}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set("id", contract.id);
    startTransition(async () => {
      const res = await deleteContractAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contract deleted");
      router.refresh();
    });
  };

  const handleResend = (contract: ContractRecord) => {
    const client = clients.find((c) => c.id === contract.clientId) ?? null;
    if (!client) {
      toast.error("This contract has no client attached.");
      return;
    }
    if (!client.email?.trim()) {
      toast.error("Add an email to the client before sending.");
      return;
    }
    startTransition(async () => {
      const res = await sendContractAction({ contractId: contract.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const token = res.data?.token;
      if (!token) {
        toast.success("Sent for signature");
        router.refresh();
        return;
      }
      const shareUrl = `${window.location.origin}/c/${token}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Sent for signature. Share link copied to clipboard.");
      } catch {
        toast.success("Sent for signature");
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Draft, send, and collect signatures on your agreements."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Show contracts awaiting signature and tell me what to follow up on."
              label="Ask Ivo"
              variant="outline"
            />
            <IvoEntryPoint
              prompt="Draft a contract for a client"
              label="Draft with AI"
              variant="secondary"
            />
            <Button asChild size="sm">
              <Link href="/dashboard/contracts/new">
                <Plus /> New contract
              </Link>
            </Button>
          </div>
        }
      />

      <div className={cn("grid items-start gap-6", "grid-cols-1")}>
        <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total contracts" value={stats.total.toString()} featured />
        <Stat label="Signed" value={stats.signed.toString()} tone="success" />
        <Stat
          label="Awaiting signature"
          value={stats.awaiting.toString()}
          tone="warning"
        />
        <Stat label="Signed value" value={formatINR(stats.value)} />
      </div>

      <div className="grid gap-2 sm:flex sm:min-w-0 sm:items-center">
        <div className="relative w-full sm:w-96 sm:shrink-0">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contracts, clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="w-full sm:w-[160px] sm:shrink-0">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as ContractStatusRow | "all")
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CONTRACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CONTRACT_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title={
            contracts.length === 0
              ? "No contracts yet"
              : "No contracts match your filters"
          }
          description={
            contracts.length === 0
              ? "Start from a template or a blank document and send it for signature."
              : "Try a different search term or status filter."
          }
          action={
            contracts.length === 0
              ? {
                  label: "Create contract",
                  href: "/dashboard/contracts/new",
                }
              : undefined
          }
          secondaryAction={
            contracts.length === 0
              ? {
                  label: "Ask Ivo",
                  onClick: () => openIvo("Help me draft my first contract."),
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Mobile: app-native card list */}
          <div className="space-y-2 md:hidden">
            {filtered.map((c) => (
              <ContractMobileCard
                key={c.id}
                contract={c}
                clientName={
                  c.clientId
                    ? (clientNameById.get(c.clientId) ?? null)
                    : null
                }
                onDelete={() => handleDelete(c)}
                onResend={() => handleResend(c)}
              />
            ))}
          </div>

          {/* Tablet+: dense table-style row list */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <ul className="divide-y">
                {filtered.map((c) => (
                  <ContractRow
                    key={c.id}
                    contract={c}
                    clientName={
                      c.clientId
                        ? (clientNameById.get(c.clientId) ?? null)
                        : null
                    }
                    onDelete={() => handleDelete(c)}
                    onResend={() => handleResend(c)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
        </div>

      </div>
    </div>
  );
}

function ContractRow({
  contract,
  clientName,
  onDelete,
  onResend,
}: {
  contract: ContractRecord;
  clientName: string | null;
  onDelete: () => void;
  onResend: () => void;
}) {
  const issued = new Date(contract.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <li>
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-muted/20">
        <Link
          href={`/dashboard/contracts/${contract.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <FileSignature className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{contract.title}</p>
              <ContractStatusBadge status={contract.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {CONTRACT_KIND_LABEL[contract.kind]}
              {clientName && <> · {clientName}</>}
              {" · "}
              <span className="tabular-nums">{issued}</span>
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          {contract.valueAmount != null && contract.valueAmount > 0 && (
            <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">
              {formatMoney(contract.valueAmount, contract.currency)}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Contract actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/contracts/${contract.id}`}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Link>
              </DropdownMenuItem>
              {(contract.status === "draft" ||
                contract.status === "sent" ||
                contract.status === "viewed") && (
                <DropdownMenuItem onSelect={onResend}>
                  <Send className="h-3.5 w-3.5" />{" "}
                  {contract.status === "draft" ? "Send for signature" : "Resend"}
                </DropdownMenuItem>
              )}
              {contract.status !== "signed" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  featured,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  featured?: boolean;
}) {
  return (
    <Card className={cn(featured && "col-span-2 lg:col-span-1")}>
      <CardContent className="min-h-28 space-y-1 p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={
            "text-2xl font-semibold tabular-nums tracking-tight " +
            (tone === "success"
              ? "text-success"
              : tone === "warning"
                ? "text-warning"
                : "")
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
