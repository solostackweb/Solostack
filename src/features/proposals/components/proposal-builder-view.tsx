"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSignature,
  FolderKanban,
  Mail,
  MessageCircle,
  Plus,
  ReceiptText,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { draftProposalFieldAction } from "@/features/proposals/ai-assist";
import { cn } from "@/lib/utils";
import { IvoContextActions } from "@/features/ai-workflows/components/ivo-context-actions";
import { FieldProposalReview } from "@/features/ai-workflows/components/field-proposal-review";

import {
  getProposalBillingGuidance,
  type ProposalSellerContext,
} from "../intelligence";
import {
  convertProposalToContractAction,
  convertProposalToInvoiceAction,
  convertProposalToProjectAction,
  saveProposalBuilderAction,
  sendProposalEmailAction,
  shareProposalAction,
} from "../actions";
import type { ProposalItemRecord, ProposalRecord } from "../server";

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
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const [isSaving, startSaving] = React.useTransition();
  const [isSendingEmail, startSendingEmail] = React.useTransition();
  const [isSharing, startSharing] = React.useTransition();
  const [isConverting, startConverting] = React.useTransition();
  const [clientId, setClientId] = React.useState(proposal.clientId ?? "");
  const [projectId, setProjectId] = React.useState(proposal.projectId ?? "");
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

  const buildFormData = (status: string) => {
    if (!formRef.current) return null;
    const formData = new FormData(formRef.current);
    formData.set("id", proposal.id);
    formData.set("status", status);
    formData.set("currency", currency);
    formData.set("subtotal", String(subtotal));
    formData.set("totalAmount", String(total));
    if (!String(formData.get("title") ?? "").trim()) {
      formData.set("title", "Untitled proposal");
    }
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
    return formData;
  };

  const saveDraft = () => {
    const formData = buildFormData("draft");
    if (!formData) return;
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

  const getInputValue = (name: string) => {
    const field = formRef.current?.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value.trim() : "";
  };

  // Scroll to a field/section and focus it so the user lands on what's missing.
  const jumpToField = (selector: string) => {
    const el = formRef.current?.querySelector<HTMLElement>(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => el.focus?.());
  };

  const validateForPublishing = (channel: "email" | "whatsapp") => {
    const missing: string[] = [];
    let firstTarget: string | null = null;
    const flag = (label: string, selector: string | null) => {
      missing.push(label);
      if (!firstTarget && selector) firstTarget = selector;
    };
    if (!getInputValue("title")) flag("title", '[name="title"]');
    if (!clientId) flag("client", '[data-jump-id="client"]');
    if (!getInputValue("validUntil")) flag("valid until", '[name="validUntil"]');
    if (!scope.trim()) flag("scope", '[name="scope"]');
    if (!deliverables.trim()) flag("deliverables", '[name="deliverables"]');
    if (!timeline.trim()) flag("timeline", '[name="timeline"]');
    if (!terms.trim()) flag("terms", '[name="terms"]');
    const validItems = draftItems.filter(
      (item) => item.description.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0,
    );
    if (validItems.length === 0) flag("at least one package", '[data-jump-id="packages"]');
    if (total <= 0) flag("proposal total", '[data-jump-id="packages"]');
    if (channel === "email" && !selectedClient?.email)
      flag("client email", '[data-jump-id="client"]');

    if (missing.length > 0) {
      toast.error(`Please complete ${missing.join(", ")} — taking you there.`);
      if (firstTarget) jumpToField(firstTarget);
      return false;
    }
    return true;
  };

  const saveForPublishing = async () => {
    const formData = buildFormData("sent");
    if (!formData) return false;
    const res = await saveProposalBuilderAction(undefined, formData);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
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
    if (!validateForPublishing("whatsapp")) return;
    startSharing(async () => {
      const saved = await saveForPublishing();
      if (!saved) return;
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

  const sendViaEmail = () => {
    if (!validateForPublishing("email")) return;
    startSendingEmail(async () => {
      const saved = await saveForPublishing();
      if (!saved) return;
      const res = await sendProposalEmailAction({ id: proposal.id });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Email did not return a proposal link." : res.error);
        return;
      }
      toast.success("Proposal sent by email");
      router.refresh();
    });
  };

  const convertTo = (kind: "contract" | "invoice" | "project") => {
    startConverting(async () => {
      // Persist current edits first (without changing the proposal's status),
      // so the conversion uses the latest client, packages, and copy.
      const formData = buildFormData(proposal.status);
      if (formData) {
        const saved = await saveProposalBuilderAction(undefined, formData);
        if (!saved.ok) {
          toast.error(saved.error);
          return;
        }
      }
      const run =
        kind === "contract"
          ? convertProposalToContractAction
          : kind === "invoice"
            ? convertProposalToInvoiceAction
            : convertProposalToProjectAction;
      const res = await run({ id: proposal.id });
      if (!res.ok || !res.data) {
        toast.error(res.ok ? "Conversion did not return a destination." : res.error);
        return;
      }
      toast.success(res.message ?? "Converted");
      const dest =
        kind === "contract"
          ? `/dashboard/contracts/${res.data.id}`
          : kind === "invoice"
            ? `/dashboard/invoices/${res.data.id}`
            : `/dashboard/projects/${res.data.id}`;
      router.push(dest);
    });
  };

  const selectedClient = clients.find((client) => client.id === clientId) ?? null;

  // ── Inline Ivo drafting for the narrative fields ──────────────────────────
  type NarrativeField = "scope" | "deliverables" | "timeline" | "terms";
  const [ivoDrafting, setIvoDrafting] = React.useState<null | NarrativeField>(null);
  /** A suggestion awaiting review. Applying it is a separate, explicit action. */
  const [ivoProposal, setIvoProposal] = React.useState<
    null | { field: NarrativeField; proposed: string }
  >(null);

  const narrativeValues: Record<NarrativeField, string> = {
    scope,
    deliverables,
    timeline,
    terms,
  };
  const narrativeSetters: Record<NarrativeField, (next: string) => void> = {
    scope: setScope,
    deliverables: setDeliverables,
    timeline: setTimeline,
    terms: setTerms,
  };

  const applyIvoProposal = (field: NarrativeField, proposed: string) => {
    narrativeSetters[field](proposed);
    setIvoProposal(null);
    toast.success("Applied — you can still edit it before sending.");
  };

  /** Review panel for the field currently holding a suggestion. */
  const ivoReviewFor = (field: NarrativeField) => {
    // Bound to a local so the narrowing survives into the callbacks.
    const pending = ivoProposal;
    if (!pending || pending.field !== field) return null;
    return (
      <FieldProposalReview
        className="mt-2"
        original={narrativeValues[field]}
        proposed={pending.proposed}
        onApply={(next) => applyIvoProposal(field, next)}
        onDiscard={() => setIvoProposal(null)}
      />
    );
  };
  const handleIvoDraft = React.useCallback(
    async (field: "scope" | "deliverables" | "timeline" | "terms") => {
      setIvoDrafting(field);
      const res = await draftProposalFieldAction({
        field,
        title:
          (formRef.current?.elements.namedItem("title") as HTMLInputElement | null)?.value ??
          proposal.title ??
          "",
        clientName: selectedClient?.name,
        currency,
        items: draftItems
          .map((item) => item.description.trim())
          .filter(Boolean)
          .slice(0, 25),
        context: { scope, deliverables, timeline, terms },
      });
      setIvoDrafting(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Never write straight into the field. The user has usually typed
      // something here already, and replacing it silently means their work can
      // disappear behind a single click with no way back. Hold the suggestion
      // for review instead; applying it is an explicit second action.
      setIvoProposal({ field, proposed: res.text });
    },
    [proposal.title, selectedClient, currency, draftItems, scope, deliverables, timeline, terms],
  );
  const ivoDraftButton = (
    field: "scope" | "deliverables" | "timeline" | "terms",
  ) => (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        void handleIvoDraft(field);
      }}
      disabled={ivoDrafting !== null}
      className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-0.5 text-micro font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      <Sparkles className="h-3 w-3" />
      {ivoDrafting === field ? "Drafting…" : "Draft with Ivo"}
    </button>
  );

  const availableProjects = React.useMemo(
    () => (clientId ? projects.filter((project) => project.clientId === clientId) : []),
    [clientId, projects],
  );
  React.useEffect(() => {
    if (!projectId) return;
    if (!availableProjects.some((project) => project.id === projectId)) {
      setProjectId("");
    }
  }, [availableProjects, projectId]);
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
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link href="/dashboard/proposals">
              <ArrowLeft className="h-4 w-4" /> Proposals
            </Link>
          </Button>
          <h1 className="truncate text-3xl font-bold tracking-tight">Proposal builder</h1>
          <p className="mt-1 text-muted-foreground">
            Shape a lightweight offer, save drafts freely, then send the proposal by email or WhatsApp when it is ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          <Button type="button" onClick={saveDraft} disabled={isSaving} className="shrink-0">
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
            onClick={sendViaEmail}
            disabled={isSendingEmail}
            className="shrink-0"
          >
            <Mail className="h-4 w-4" /> Send via email
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={shareOnWhatsApp}
            disabled={isSharing}
            className="shrink-0"
          >
            <MessageCircle className="h-4 w-4" /> Send via WhatsApp
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
          <Card
            className={cn(
              proposal.status === "accepted" &&
                "border-success-subtle bg-success/[0.04]",
            )}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    proposal.status === "accepted"
                      ? "bg-success-subtle text-success-strong"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {proposal.status === "accepted" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    {proposal.status === "accepted"
                      ? "Client accepted — move it forward"
                      : proposal.status === "converted"
                        ? "Proposal converted"
                        : "Turn this proposal into the next step"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {proposal.status === "accepted"
                      ? "Create the contract, invoice, or project without re-entering any details."
                      : proposal.status === "converted"
                        ? "You can still generate another document from this proposal if you need to."
                        : "When you're ready, convert it into a contract, invoice, or project — your edits are saved first."}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  type="button"
                  variant={proposal.status === "accepted" ? "default" : "outline"}
                  onClick={() => convertTo("contract")}
                  disabled={isConverting}
                >
                  <FileSignature className="h-4 w-4" /> To contract
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => convertTo("invoice")}
                  disabled={isConverting}
                >
                  <ReceiptText className="h-4 w-4" /> To invoice
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => convertTo("project")}
                  disabled={isConverting}
                >
                  <FolderKanban className="h-4 w-4" /> To project
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/dashboard/welcome/new?${
                      projectId ? `projectId=${projectId}&` : ""
                    }${clientId ? `clientId=${clientId}` : ""}`}
                  >
                    <BookOpen className="h-4 w-4" /> Welcome doc
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link
                    href={`/dashboard/meetings/new?proposalId=${proposal.id}${
                      clientId ? `&clientId=${clientId}` : ""
                    }${projectId ? `&projectId=${projectId}` : ""}`}
                  >
                    <CalendarClock className="h-4 w-4" /> Book a call
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <Input name="title" defaultValue={proposal.title} required />
              </Field>
              <input type="hidden" name="status" value={proposal.status} />
              <input type="hidden" name="currency" value={currency} />
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="projectId" value={projectId} />
              <Field label="Client">
                <Select
                  value={clientId}
                  onValueChange={(nextClientId) => {
                    setClientId(nextClientId);
                    setProjectId("");
                    const nextClient =
                      clients.find((client) => client.id === nextClientId) ?? null;
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
                >
                  <SelectTrigger className="h-11" data-jump-id="client">
                    <SelectValue placeholder="Choose client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Project">
                <Select
                  value={projectId ? projectId : "none"}
                  onValueChange={(value) =>
                    setProjectId(value === "none" ? "" : value)
                  }
                  disabled={!clientId}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue
                      placeholder={
                        clientId ? "No project" : "Choose a client first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {availableProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valid until">
                <Input name="validUntil" type="date" defaultValue={proposal.validUntil ?? ""} />
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
                  <h2
                    className="text-lg font-semibold outline-none"
                    data-jump-id="packages"
                    tabIndex={-1}
                  >
                    Packages and line items
                  </h2>
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
                    <span className="rounded-full border bg-background px-2 py-0.5 text-micro font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
              <div>
                <Field label="Scope" action={ivoDraftButton("scope")}>
                  <Textarea name="scope" value={scope} onChange={(event) => setScope(event.target.value)} rows={5} />
                </Field>
                {ivoReviewFor("scope")}
              </div>
              <div>
                <Field label="Deliverables" action={ivoDraftButton("deliverables")}>
                  <Textarea name="deliverables" value={deliverables} onChange={(event) => setDeliverables(event.target.value)} rows={5} />
                </Field>
                {ivoReviewFor("deliverables")}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Field label="Timeline" action={ivoDraftButton("timeline")}>
                    <Textarea name="timeline" value={timeline} onChange={(event) => setTimeline(event.target.value)} rows={5} />
                  </Field>
                  {ivoReviewFor("timeline")}
                </div>
                <div>
                  <Field label="Terms" action={ivoDraftButton("terms")}>
                    <Textarea name="terms" value={terms} onChange={(event) => setTerms(event.target.value)} rows={5} />
                  </Field>
                  {ivoReviewFor("terms")}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
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
  action,
  children,
}: {
  label: string;
  className?: string;
  /** Optional right-aligned control in the label row (e.g. "Draft with Ivo"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("space-y-1.5", className)}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {action}
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
