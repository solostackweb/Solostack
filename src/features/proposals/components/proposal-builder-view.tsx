"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  FileSignature,
  MessageCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";

import {
  getProposalBillingGuidance,
  type ProposalSellerContext,
} from "../intelligence";
import {
  convertProposalToContractAction,
  saveProposalBuilderAction,
  shareProposalAction,
} from "../actions";
import type { ProposalItemRecord, ProposalRecord } from "../server";
import {
  PROPOSAL_STATUSES,
  PROPOSAL_STATUS_LABEL,
} from "../status";

interface ClientOption {
  id: string;
  name: string;
  email: string | null;
  country: string;
  currency: string;
  isForeign: boolean;
  gstRegistered: boolean;
  stateCode: string | null;
}

interface ProjectOption {
  id: string;
  name: string;
  clientId: string | null;
}

interface DraftItem {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export function ProposalBuilderView({
  proposal,
  items,
  seller,
  clients,
  projects,
}: {
  proposal: ProposalRecord;
  items: ProposalItemRecord[];
  seller: ProposalSellerContext;
  clients: ClientOption[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [isSaving, startSaving] = React.useTransition();
  const [isSharing, startSharing] = React.useTransition();
  const [isSendingForSignature, startSendingForSignature] = React.useTransition();
  const [clientId, setClientId] = React.useState(proposal.clientId ?? "");
  const [currency, setCurrency] = React.useState(proposal.currency);
  const [taxAmount, setTaxAmount] = React.useState(proposal.taxAmount);
  const [scope, setScope] = React.useState(proposal.scope ?? "");
  const [deliverables, setDeliverables] = React.useState(proposal.deliverables ?? "");
  const [timeline, setTimeline] = React.useState(proposal.timeline ?? "");
  const [terms, setTerms] = React.useState(proposal.terms ?? "");
  const [draftItems, setDraftItems] = React.useState<DraftItem[]>(
    items.length > 0
      ? items.map((item) => ({
          key: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        }))
      : [{ key: crypto.randomUUID(), description: "Service package", quantity: 1, unitPrice: proposal.totalAmount || 0 }],
  );

  const subtotal = React.useMemo(
    () =>
      Math.round(
        draftItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100,
      ) / 100,
    [draftItems],
  );
  const total = Math.round((subtotal + Number(taxAmount || 0)) * 100) / 100;

  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setDraftItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const removeItem = (key: string) => {
    setDraftItems((current) =>
      current.length <= 1 ? current : current.filter((item) => item.key !== key),
    );
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("id", proposal.id);
    formData.set("subtotal", String(subtotal));
    formData.set("totalAmount", String(total));
    formData.set(
      "items",
      JSON.stringify(
        draftItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
          })),
      ),
    );
    startSaving(async () => {
      const res = await saveProposalBuilderAction(undefined, formData);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Proposal saved");
      router.refresh();
    });
  };

  const share = () => {
    startSharing(async () => {
      const res = await shareProposalAction({ id: proposal.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.data) {
        toast.error("Could not create proposal share link.");
        return;
      }
      try {
        await navigator.clipboard.writeText(res.data.url);
        toast.success("Public proposal link copied");
      } catch {
        toast.success("Public proposal link created");
      }
      router.refresh();
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    });
  };

  const shareOnWhatsApp = () => {
    startSharing(async () => {
      const res = await shareProposalAction({ id: proposal.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (!res.data) {
        toast.error("Could not create proposal share link.");
        return;
      }
      const text = `Hi, sharing the proposal "${proposal.title}" for your review: ${res.data.url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      router.refresh();
    });
  };

  const sendForSignature = () => {
    startSendingForSignature(async () => {
      const res = await convertProposalToContractAction({ id: proposal.id });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Contract was not returned." : res.error);
        return;
      }
      toast.success("Contract draft created. Review it before sending for signature.");
      router.push(`/dashboard/contracts/${res.data.id}`);
    });
  };

  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const guidance = React.useMemo(
    () =>
      getProposalBillingGuidance({
        seller,
        client: selectedClient
          ? {
              id: selectedClient.id,
              country: selectedClient.country,
              currency: selectedClient.currency,
              isForeign: selectedClient.isForeign,
              gstRegistered: selectedClient.gstRegistered,
              stateCode: selectedClient.stateCode,
            }
          : null,
        fallbackCurrency: currency,
      }),
    [currency, selectedClient, seller],
  );
  const suggestedTaxAmount =
    guidance.recommendedTaxRate > 0
      ? Math.round(subtotal * guidance.recommendedTaxRate) / 100
      : 0;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/dashboard/proposals">
              <ArrowLeft className="h-4 w-4" /> Proposals
            </Link>
          </Button>
          <h1 className="truncate text-3xl font-bold tracking-tight">Proposal builder</h1>
          <p className="mt-1 text-muted-foreground">
            Shape a lightweight offer. Clients can acknowledge it, then you can convert it to a contract, project, or invoice.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              "Saving..."
            ) : (
              <>
                <Save className="h-4 w-4" /> Save draft
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={sendForSignature}
            disabled={isSendingForSignature}
          >
            <FileSignature className="h-4 w-4" /> Send for signature
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={shareOnWhatsApp}
            disabled={isSharing}
          >
            <MessageCircle className="h-4 w-4" /> Share on WhatsApp
          </Button>
        </div>
      </div>

      <IvoContextActions
        title="Proposal co-pilot"
        description="Review the offer, pricing, tax treatment, and next step before sharing."
        actions={[
          {
            label: "Review offer",
            prompt: `Review proposal ${proposal.title}. Client: ${selectedClient?.name ?? "No client selected"}. Currency: ${currency}. Subtotal: ${formatMoney(subtotal, currency)}. Total: ${formatMoney(total, currency)}. Status: ${proposal.status}. Tax guidance: ${guidance.modeLabel} - ${guidance.summary}. Suggest improvements before I share it.`,
          },
          {
            label: "Client email",
            prompt: `Draft a warm, professional email to share proposal ${proposal.title} with ${selectedClient?.name ?? "the client"}. Mention the offer clearly and invite questions.`,
          },
          {
            label: "Next steps",
            prompt: `For proposal ${proposal.title}, recommend whether I should convert it to a project, contract, or invoice next. Use the proposal status, client, and pricing context.`,
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input name="title" defaultValue={proposal.title} required />
              </Field>
              <Field label="Client">
                <select
                  name="clientId"
                  value={clientId}
                  onChange={(event) => {
                    const nextClientId = event.target.value;
                    setClientId(nextClientId);
                    const nextClient = clients.find((client) => client.id === nextClientId) ?? null;
                    const nextGuidance = getProposalBillingGuidance({
                      seller,
                      client: nextClient
                        ? {
                            id: nextClient.id,
                            country: nextClient.country,
                            currency: nextClient.currency,
                            isForeign: nextClient.isForeign,
                            gstRegistered: nextClient.gstRegistered,
                            stateCode: nextClient.stateCode,
                          }
                        : null,
                      fallbackCurrency: currency,
                    });
                    setCurrency(nextGuidance.currency);
                    if (nextGuidance.recommendedTaxRate === 0) setTaxAmount(0);
                  }}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Project">
                <select
                  name="projectId"
                  defaultValue={proposal.projectId ?? ""}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  name="status"
                  defaultValue={proposal.status}
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {PROPOSAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROPOSAL_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valid until">
                <Input name="validUntil" type="date" defaultValue={proposal.validUntil ?? ""} />
              </Field>
              <Field label="Currency">
                <Input
                  name="currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  maxLength={3}
                />
              </Field>
              <Field label="Tax / additional charges">
                <Input
                  name="taxAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(event) => setTaxAmount(Number(event.target.value || 0))}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Packages and line items</h2>
                  <p className="text-sm text-muted-foreground">
                    Add offer packages, milestones, retainers, or optional service lines.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDraftItems((current) => [
                      ...current,
                      { key: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Add item
                </Button>
              </div>

              <div className="space-y-3">
                {draftItems.map((item, index) => (
                  <div
                    key={item.key}
                    className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_100px_140px_44px]"
                  >
                    <Input
                      aria-label={`Item ${index + 1} description`}
                      value={item.description}
                      onChange={(event) => updateItem(item.key, { description: event.target.value })}
                      placeholder="Design sprint, website build, monthly support..."
                    />
                    <Input
                      aria-label={`Item ${index + 1} quantity`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value || 1) })}
                    />
                    <Input
                      aria-label={`Item ${index + 1} unit price`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => updateItem(item.key, { unitPrice: Number(event.target.value || 0) })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.key)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-stretch">
                <div className="rounded-lg border bg-primary/5 p-4 text-sm">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {guidance.badge}
                    </span>
                    <span className="font-semibold">{guidance.modeLabel}</span>
                  </div>
                  <p className="text-muted-foreground">{guidance.summary}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{guidance.detail}</p>
                  {guidance.recommendedTaxRate > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setTaxAmount(suggestedTaxAmount)}
                    >
                      Apply {guidance.recommendedTaxRate}% GST estimate (
                      {formatMoney(suggestedTaxAmount, currency)})
                    </Button>
                  ) : null}
                </div>

                <div className="grid w-full gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
                  <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
                  <SummaryRow
                    label="Tax / charges"
                    value={formatMoney(Number(taxAmount || 0), currency)}
                  />
                  <SummaryRow label="Total" value={formatMoney(total, currency)} strong />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 p-5">
              <Field label="Scope">
                <Textarea name="scope" value={scope} onChange={(event) => setScope(event.target.value)} rows={5} />
              </Field>
              <Field label="Deliverables">
                <Textarea name="deliverables" value={deliverables} onChange={(event) => setDeliverables(event.target.value)} rows={5} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Timeline">
                  <Textarea name="timeline" value={timeline} onChange={(event) => setTimeline(event.target.value)} rows={5} />
                </Field>
                <Field label="Terms">
                  <Textarea name="terms" value={terms} onChange={(event) => setTerms(event.target.value)} rows={5} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Live preview
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold">{proposal.title}</h2>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={share} aria-label="Open share link">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Prepared for</p>
                <p className="font-semibold">{selectedClient?.name ?? "Client name"}</p>
                {selectedClient?.email ? (
                  <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
                ) : null}
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm text-muted-foreground">Investment</p>
                <p className="mt-1 text-3xl font-bold">{formatMoney(total, currency)}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {guidance.publicNote}
                </p>
              </div>
              <div className="space-y-2">
                {draftItems.map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.description || "Untitled item"}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x {formatMoney(item.unitPrice, currency)}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">
                      {formatMoney(item.quantity * item.unitPrice, currency)}
                    </p>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  const url = `${window.location.origin}/p/${proposal.publicToken}`;
                  await navigator.clipboard.writeText(url);
                  toast.success("Current proposal URL copied");
                }}
              >
                <Copy className="h-4 w-4" /> Copy current link
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between", strong && "border-t pt-2 text-base font-bold")}>
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
