"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Pencil,
  Trash2,
  FilePlus,
  MoreHorizontal,
  Receipt,
  FileText,
  FileSignature,
  BookOpen,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR, formatMoney } from "@/lib/format";
import { getStateName } from "@/features/gst/state-codes";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";

import type { ClientRecord } from "../server";
import type { InvoiceRecord } from "@/features/invoices/server";
import { ClientFormDialog } from "./client-form-dialog";
import { DeleteClientDialog } from "./delete-client-dialog";
import { getClientDisplayName, getClientInitials } from "../utils";
import { markClientReviewedAction } from "../actions";

interface ClientProfileViewProps {
  client: ClientRecord;
  /** Aggregates pre-computed on the server. Keeps the client component dumb. */
  metrics: {
    invoiceCount: number;
    paidTotal: number;
  };
  /** Recent invoices for this client — drives the activity feed. */
  recentInvoices?: InvoiceRecord[];
  /** All non-invoice documents for this client (proposals, contracts, welcome). */
  documents?: ClientDocument[];
}

export interface ClientDocument {
  id: string;
  kind: "proposal" | "contract" | "welcome";
  title: string;
  status: string;
  href: string;
}

function DocIcon({ kind }: { kind: ClientDocument["kind"] }) {
  const Icon =
    kind === "contract" ? FileSignature : kind === "welcome" ? BookOpen : FileText;
  return <Icon className="h-4 w-4" />;
}

/**
 * Read-only profile view for a single client. Edit + delete dialogs are
 * mounted here and route off to server actions.
 */
export function ClientProfileView({
  client,
  metrics,
  recentInvoices = [],
  documents = [],
}: ClientProfileViewProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reviewing, startReview] = React.useTransition();

  const handleMarkReviewed = () => {
    startReview(async () => {
      const res = await markClientReviewedAction({ id: client.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Client marked as verified");
      router.refresh();
    });
  };

  const display = getClientDisplayName(client);
  const initials = getClientInitials(display);
  const createdDate = new Date(client.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5">
        <Link href="/dashboard/clients">
          <ArrowLeft className="h-3.5 w-3.5" /> All clients
        </Link>
      </Button>

      {client.needsReview ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold">Verify this client&apos;s details</p>
                <p className="text-xs text-muted-foreground">
                  Added automatically from a lead form. Confirm GST status, state,
                  and billing address before sending proposals, contracts, or
                  invoices.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </Button>
              <Button size="sm" onClick={handleMarkReviewed} disabled={reviewing}>
                {reviewing ? "Saving..." : "Mark verified"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {display}
                </h1>
                {client.isForeign ? (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    International
                  </span>
                ) : client.gstRegistered ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    GST registered
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Unregistered
                  </span>
                )}
              </div>
              {client.businessName && client.fullName !== client.businessName && (
                <p className="text-sm text-muted-foreground">
                  Contact: {client.fullName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {client.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {client.email}
                  </span>
                )}
                {client.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {client.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Client since {createdDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/invoices/new">
                <FilePlus /> New invoice
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/invoices?client=${client.id}`}>
                    <Receipt /> Invoices
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 /> Delete client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <IvoContextActions
        title={`Work with ${display}`}
        description="Use this client's billing, tax, and recent invoice context."
        actions={[
          {
            label: "Summarize client",
            prompt: `Summarize client ${display}. Paid to date: ${formatINR(metrics.paidTotal)} across ${metrics.invoiceCount} paid invoice(s). Client currency: ${client.currency}. GST registered: ${client.gstRegistered ? "yes" : "no"}. International client: ${client.isForeign ? "yes" : "no"}. Tell me the next best action.`,
          },
          {
            label: "Follow-up draft",
            prompt: `Draft a short, polite follow-up message for ${display}. Use their recent invoice context if available and keep it professional.`,
          },
          {
            label: "Invoice this client",
            prompt: `Help me create an invoice for client ${display}. Use their configured currency ${client.currency} and GST/export details from their profile.`,
          },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Paid invoices"
          value={String(metrics.invoiceCount)}
        />
        <StatTile
          label="Paid to date"
          value={formatINR(metrics.paidTotal)}
        />
        <StatTile
          label="Average invoice"
          value={formatINR(
            metrics.invoiceCount > 0 ? metrics.paidTotal / metrics.invoiceCount : 0,
          )}
          subtle={metrics.invoiceCount === 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {documents.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Proposals, contracts, and welcome docs for this client will appear here."
                  className="min-h-[120px]"
                />
              ) : (
                <div className="-mx-1 divide-y">
                  {documents.map((d) => (
                    <Link
                      key={`${d.kind}-${d.id}`}
                      href={d.href}
                      className="flex items-center gap-3 rounded-md px-1 py-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <DocIcon kind={d.kind} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{d.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {d.kind} · {d.status.replace(/_/g, " ")}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Recent invoices</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/invoices?client=${client.id}`}>
                  View all
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {recentInvoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet"
                  description="Invoices you create for this client will appear here."
                  className="min-h-[140px]"
                  action={{
                    label: "New invoice",
                    href: `/dashboard/invoices/new?client=${client.id}`,
                  }}
                />
              ) : (
                <div className="-mx-1 divide-y">
                  {recentInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/dashboard/invoices/${inv.id}`}
                      className="flex items-center gap-3 rounded-md px-1 py-3 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{inv.invoiceNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium tabular-nums">
                          {formatMoney(inv.totalAmount, inv.currency)}
                        </span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow label="Email" value={client.email ?? "—"} />
              <Separator />
              <DetailRow label="Phone" value={client.phone ?? "—"} />
              <Separator />
              <DetailRow
                label="Business name"
                value={client.businessName ?? "—"}
              />
              <Separator />
              <DetailRow
                label="Contact name"
                value={client.fullName}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <DetailRow
                label="GSTIN"
                value={
                  client.gstRegistered
                    ? (client.gstin ?? "—")
                    : "Not registered"
                }
                mono={client.gstRegistered}
              />
              <Separator />
              <DetailRow
                label="State"
                value={
                  client.stateCode
                    ? `${getStateName(client.stateCode)} (${client.stateCode})`
                    : "—"
                }
              />
              <Separator />
              <DetailRow
                label="Billing address"
                value={client.billingAddress ?? "—"}
                multiline
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <ClientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
      />

      <DeleteClientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        client={client}
        onDeleted={() => router.push("/dashboard/clients")}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-2 text-xl font-semibold tabular-nums tracking-tight " +
          (subtle ? "text-muted-foreground" : "")
        }
      >
        {value}
      </p>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceRecord["status"] }) {
  const map: Partial<Record<InvoiceRecord["status"], { label: string; className: string }>> = {
    paid:          { label: "Paid",          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    sent:          { label: "Sent",          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    viewed:        { label: "Viewed",        className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    overdue:       { label: "Overdue",       className: "bg-red-500/10 text-red-600 dark:text-red-400" },
    draft:         { label: "Draft",         className: "bg-muted text-muted-foreground" },
    partially_paid:{ label: "Partial",       className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  };
  const { label, className } = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={`h-5 px-1.5 text-[10px] font-semibold border-0 ${className}`}>
      {label}
    </Badge>
  );
}

function DetailRow({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div
      className={
        multiline
          ? "space-y-1"
          : "flex items-center justify-between gap-2"
      }
    >
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          (multiline
            ? "block whitespace-pre-line "
            : "truncate text-right ") +
          "font-medium " +
          (mono ? "font-mono text-sm" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
