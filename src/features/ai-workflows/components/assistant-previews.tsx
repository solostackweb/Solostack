import * as React from "react";
import Link from "next/link";
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  FileSignature,
  FolderKanban,
  Mail,
  MessageCircle,
  ReceiptText,
  Send,
  Sparkles,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BUILTIN_WELCOME_TEMPLATES } from "@/features/welcome-documents/templates";
import { INDIAN_STATES } from "@/features/gst/state-codes";
import { formatAiMoney } from "./assistant-helpers";
import type { IvoPreparedAction } from "@/features/ai-workflows/prepared-actions";
import type {
  AiConfirmSummary,
  AiInvoicePreview,
  AiContractPreview,
  AiWelcomeDocPreview,
  AiEntityOption,
  AiInvoiceListRow,
  AiContractListRow,
  AiProposalListRow,
  AiClientListRow,
  AiProjectListRow,
  AiMeetingListRow,
  AiQuestionnaireListRow,
  AiQuestionnaireDraftPreview,
  AiQuestionnaireRefinementProposal,
  AiWelcomeDocListRow,
} from "./assistant-types";

/**
 * Presentational sub-components for the Stackivo AI assistant: draft previews,
 * delivery action rows, and entity pickers. All prop-driven (no panel state),
 * extracted from the main component to keep it focused on orchestration.
 */

export function SectionList({
  sections,
  limit,
}: {
  sections: Array<{ heading: string; body: string }>;
  limit?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const shown = limit && !expanded ? sections.slice(0, limit) : sections;
  const hasMore = limit && sections.length > limit && !expanded;
  return (
    <div className="space-y-3">
      {shown.map((s, i) => (
        <div key={i} className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-semibold text-foreground">{s.heading}</p>
          <p className="mt-1 whitespace-pre-line leading-relaxed text-muted-foreground">
            {s.body}
          </p>
        </div>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Show {sections.length - (limit ?? 0)} more sections…
        </button>
      )}
    </div>
  );
}

export function ResultBlock({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      {children}
      <Button type="button" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

// Pre-create confirmation — shows a field summary and waits for approval.
export function ConfirmBlock({
  summary,
  onConfirm,
  onCancel,
  disabled = false,
}: {
  summary: AiConfirmSummary;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="font-semibold">{summary.title}</p>
      <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
        {summary.lines.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onConfirm}>
          {disabled ? "No longer available" : "Confirm & create"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Invoice preview
export function InvoiceDraftPreview({
  preview,
  onApprove,
  onOpen,
}: {
  preview: AiInvoicePreview;
  onApprove: (preview: AiInvoicePreview) => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Draft invoice ready for approval</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {preview.invoiceNumber} · {preview.clientName}
        </p>
        {preview.isExport ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-info-subtle px-2 py-0.5 text-micro font-medium text-info-strong">
            Export invoice · {preview.currency} · zero-rated, no GST (supply under LUT)
          </p>
        ) : preview.taxTotal > 0 ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-success-subtle px-2 py-0.5 text-micro font-medium text-success-strong">
            Domestic invoice · GST applied
          </p>
        ) : null}
      </div>
      <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Work</span>
          <span className="text-right font-medium">{preview.description}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Qty × Rate</span>
          <span>
            {preview.quantity} × {formatAiMoney(preview.unitPrice, preview.currency)}
          </span>
        </div>
        {preview.discount > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Discount</span>
            <span className="text-destructive-strong">
              −{formatAiMoney(preview.discount, preview.currency)}
            </span>
          </div>
        )}
        {preview.taxMode === "cgst_sgst" && (preview.cgstAmount || preview.sgstAmount) ? (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">CGST</span>
              <span>{formatAiMoney(preview.cgstAmount, preview.currency)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">SGST</span>
              <span>{formatAiMoney(preview.sgstAmount, preview.currency)}</span>
            </div>
          </>
        ) : preview.taxMode === "igst" && preview.igstAmount ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">IGST</span>
            <span>{formatAiMoney(preview.igstAmount, preview.currency)}</span>
          </div>
        ) : preview.taxTotal > 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatAiMoney(preview.taxTotal, preview.currency)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t pt-1.5 font-semibold">
          <span>Total</span>
          <span>{formatAiMoney(preview.totalAmount, preview.currency)}</span>
        </div>
        {preview.dueDate && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Due</span>
            <span>{preview.dueDate}</span>
          </div>
        )}
        {preview.notes && (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Notes</span>
            <span className="text-right">{preview.notes}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onApprove(preview)}>
          Approve invoice
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          Open invoice
        </Button>
      </div>
    </div>
  );
}

export function InvoiceDeliveryActions({
  preview,
  onDeliver,
  onOpen,
}: {
  preview: AiInvoicePreview;
  onDeliver: (preview: AiInvoicePreview, channel: "email" | "whatsapp" | "both") => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Invoice approved</p>
        <p className="mt-1 text-muted-foreground">
          {preview.invoiceNumber} is ready to send. How would you like to deliver it?
        </p>
      </div>
      <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">{preview.clientName}</span>
          <span className="font-semibold">
            {formatAiMoney(preview.totalAmount, preview.currency)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onDeliver(preview, "email")}
          className="gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDeliver(preview, "whatsapp")}
          className="gap-1.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDeliver(preview, "both")}
        >
          Both
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onOpen}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ClientPicker({
  clients,
  label,
  allowSkip = false,
  onSelect,
  onSkip,
}: {
  clients: AiEntityOption[];
  label: string;
  allowSkip?: boolean;
  onSelect: (clientId: string) => void;
  onSkip?: () => void;
}) {
  const [selected, setSelected] = React.useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">{label}</p>
      <select
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Choose a client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Use selected client
        </Button>
        {allowSkip && onSkip && (
          <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
            No client (internal)
          </Button>
        )}
      </div>
    </div>
  );
}

export function ProjectPicker({
  projects,
  label,
  allowSkip = true,
  onSelect,
  onSkip,
}: {
  projects: AiEntityOption[];
  label: string;
  allowSkip?: boolean;
  onSelect: (projectId: string) => void;
  onSkip?: () => void;
}) {
  const [selected, setSelected] = React.useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">{label}</p>
      <select
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Choose a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Use selected project
        </Button>
        {allowSkip && onSkip && (
          <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
            No project (internal)
          </Button>
        )}
      </div>
    </div>
  );
}

export function StatePicker({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (stateName: string) => void;
}) {
  const [selected, setSelected] = React.useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm">{label}</p>
      <select
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Choose a state</option>
        {INDIAN_STATES.map((s) => (
          <option key={s.code} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
        >
          Use this state
        </Button>
      </div>
    </div>
  );
}

export function WelcomeTemplatePicker({
  onSelect,
}: {
  onSelect: (templateId: string, display: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">Pick a starting point for the welcome document:</p>
      <div className="grid gap-2">
        {BUILTIN_WELCOME_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id, t.title)}
            className="rounded-lg border bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="block font-medium">{t.title}</span>
            {t.description ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect("__custom__", "Custom — I'll describe it")}
          className="rounded-lg border border-dashed bg-background p-3 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="block font-medium">Custom</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Describe how you work and I&apos;ll draft it for you.
          </span>
        </button>
      </div>
    </div>
  );
}

// Contract preview — all sections
export function ContractDraftPreview({
  preview,
  onApproveAndSend,
  onWhatsApp,
  onOpen,
}: {
  preview: AiContractPreview;
  onApproveAndSend: (preview: AiContractPreview) => void;
  onWhatsApp: (preview: AiContractPreview) => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">
          {preview.kind === "proposal" ? "Proposal" : "Contract"} ready
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {preview.title} · {preview.clientName}
          {preview.projectName ? ` · ${preview.projectName}` : ""}
        </p>
        {preview.isInternational ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-info-subtle px-2 py-0.5 text-micro font-medium text-info-strong">
            Cross-border · {preview.currency} · governing law + electronic-signature clauses added
          </p>
        ) : null}
        {preview.valueAmount && preview.valueAmount > 0 && (
          <p className="mt-0.5 text-xs font-medium">
            {formatAiMoney(preview.valueAmount, preview.currency)}
          </p>
        )}
      </div>
      <SectionList sections={preview.sections} limit={4} />
      <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Want changes? Just tell me what to adjust — e.g. “change the fee to 90000”
        or “add a confidentiality clause” — and I’ll revise this draft.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onApproveAndSend(preview)}
          className="gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" />
          Approve &amp; Email
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onWhatsApp(preview)}
          className="gap-1.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          Open editor
        </Button>
      </div>
    </div>
  );
}

// Welcome document preview — full sections
export function WelcomeDocDraftPreview({
  preview,
  onApprove,
  onOpen,
  onSaveTemplate,
}: {
  preview: AiWelcomeDocPreview;
  onApprove: (preview: AiWelcomeDocPreview) => void;
  onOpen: () => void;
  onSaveTemplate: (preview: AiWelcomeDocPreview) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Welcome document ready</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {preview.title}
          {preview.clientName ? ` · ${preview.clientName}` : ""}
          {preview.projectName ? ` · ${preview.projectName}` : ""}
        </p>
      </div>
      {preview.intro && (
        <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
          {preview.intro}
        </p>
      )}
      <SectionList sections={preview.sections} limit={4} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onApprove(preview)}
        >
          Approve &amp; publish
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          Open editor
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => onSaveTemplate(preview)}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save as template
        </Button>
      </div>
    </div>
  );
}

export function WelcomeDocDeliveryActions({
  preview,
  onDeliver,
  onOpen,
}: {
  preview: AiWelcomeDocPreview;
  onDeliver: (preview: AiWelcomeDocPreview, channel: "email" | "whatsapp") => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold">Welcome document published</p>
        <p className="mt-1 text-muted-foreground">
          Ready to send to {preview.clientName ?? "the client"}. Choose a delivery channel.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onDeliver(preview, "email")}
          className="gap-1.5"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onDeliver(preview, "whatsapp")}
          className="gap-1.5"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onOpen}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------


const ROW_CHIP =
  "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-micro font-medium transition-colors hover:bg-muted disabled:opacity-50";

function documentStatus(status: string): {
  label: string;
  badgeClass: string;
  cardClass: string;
} {
  const normalized = status.toLowerCase();
  if (normalized === "draft") {
    return {
      label: "Draft · Not sent",
      badgeClass: "bg-muted text-muted-foreground ring-border",
      cardClass: "border-l-muted-foreground/40 bg-muted/15",
    };
  }
  if (["signed", "accepted", "paid", "converted"].includes(normalized)) {
    return {
      label: normalized.replace(/_/g, " "),
      badgeClass:
        "bg-success-subtle text-success-strong ring-success-subtle",
      cardClass: "border-l-emerald-500 bg-success/[0.03]",
    };
  }
  if (["overdue", "declined", "rejected", "expired"].includes(normalized)) {
    return {
      label: normalized.replace(/_/g, " "),
      badgeClass: "bg-destructive/10 text-destructive ring-destructive/20",
      cardClass: "border-l-destructive bg-destructive/[0.03]",
    };
  }
  if (normalized === "partially_paid") {
    return {
      label: "Partially paid",
      badgeClass:
        "bg-warning-subtle text-warning-strong ring-warning-subtle",
      cardClass: "border-l-amber-500 bg-warning/[0.03]",
    };
  }
  if (normalized === "cancelled") {
    return {
      label: "Cancelled",
      badgeClass: "bg-muted text-muted-foreground ring-border line-through",
      cardClass: "border-l-muted-foreground/30 bg-muted/10 opacity-75",
    };
  }
  return {
    label: normalized === "viewed" ? "Live · Viewed" : "Live · Sent",
    badgeClass: "bg-primary/10 text-primary ring-primary/20",
    cardClass: "border-l-primary bg-primary/[0.03]",
  };
}

function DocumentStatusBadge({ status }: { status: string }) {
  const presentation = documentStatus(status);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold capitalize ring-1 ring-inset ${presentation.badgeClass}`}
    >
      {presentation.label}
    </span>
  );
}

export function PreparedEmailBlock({
  action,
  busy,
  handled,
  onSend,
  onCopy,
}: {
  action: IvoPreparedAction;
  busy: boolean;
  handled: boolean;
  onSend: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-primary/20 bg-background">
      <div className="border-b bg-primary/[0.04] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Email ready for review</p>
          <span className="rounded-full border bg-background px-2 py-0.5 text-micro font-medium text-muted-foreground">
            {handled ? "Sent" : "Not sent"}
          </span>
        </div>
        <p className="mt-1 text-micro text-muted-foreground">
          To {action.recipientName || "recipient"}
          {action.recipientEmail ? ` · ${action.recipientEmail}` : " · no email on file"}
        </p>
      </div>
      <div className="p-3">
        <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{action.subject}</p>
        <div className="mt-3 whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-foreground/85">
          {action.body}
        </div>
        {!action.recipientEmail ? (
          <p className="mt-2 text-xs text-warning-strong">
            Add an email address to this client before sending, or copy the draft.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={busy || handled || !action.recipientEmail}
            onClick={onSend}
          >
            <Send className="h-3.5 w-3.5" />
            {handled ? "Sent" : "Approve & send email"}
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" disabled={busy} onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          {action.href ? (
            <Button asChild type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-xs">
              <Link href={action.href}><ExternalLink className="h-3.5 w-3.5" /> Open project</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InvoiceListBlock({
  rows,
  onSend,
  onMarkPaid,
  onRemind,
  busyId,
}: {
  rows: AiInvoiceListRow[];
  onSend: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onRemind: (id: string) => void;
  busyId?: string | null;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching invoices.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const paid = r.status === "paid";
        const draft = r.status === "draft";
        const sendable = ["draft", "sent", "viewed", "overdue", "partially_paid"].includes(r.status);
        const busy = busyId === r.id;
        const presentation = documentStatus(r.status);
        return (
          <div key={r.id} className={`rounded-lg border border-l-[3px] p-2.5 ${presentation.cardClass}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold">
                  {r.invoiceNumber} · {r.clientName}
                </p>
              </div>
              <DocumentStatusBadge status={r.status} />
            </div>
              <p className="text-xs text-muted-foreground">
                {formatAiMoney(r.totalAmount, r.currency)}
                {r.dueDate ? ` · due ${r.dueDate}` : ""}
              </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a href={`/dashboard/invoices/${r.id}`} className={ROW_CHIP}>
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              {sendable ? (
                <button
                  type="button"
                  onClick={() => onSend(r.id)}
                  disabled={busy}
                  className={ROW_CHIP}
                >
                  <Send className="h-3 w-3" /> {draft ? "Send invoice" : "Resend invoice"}
                </button>
              ) : null}
              {!paid && !draft && r.status !== "cancelled" ? (
                <>
                  <button
                    type="button"
                    onClick={() => onMarkPaid(r.id)}
                    disabled={busy}
                    className={ROW_CHIP}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Mark paid
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemind(r.id)}
                    disabled={busy}
                    className={ROW_CHIP}
                  >
                    <Mail className="h-3 w-3" /> Send reminder
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function ContractListBlock({
  rows,
  onSend,
  busyId,
}: {
  rows: AiContractListRow[];
  onSend: (id: string) => void;
  busyId?: string | null;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching contracts.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const sendable = r.status === "draft" || r.status === "sent" || r.status === "viewed";
        const presentation = documentStatus(r.status);
        return (
          <div key={r.id} className={`rounded-lg border border-l-[3px] p-2.5 ${presentation.cardClass}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold">{r.title}</p>
              <DocumentStatusBadge status={r.status} />
            </div>
            <p className="text-micro text-muted-foreground">
              {r.kind} · {r.clientName}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a href={`/dashboard/contracts/${r.id}`} className={ROW_CHIP}>
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              {sendable ? (
                <button
                  type="button"
                  onClick={() => onSend(r.id)}
                  disabled={busyId === r.id}
                  className={ROW_CHIP}
                >
                  <Send className="h-3 w-3" /> {r.status === "draft" ? "Send" : "Resend"}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProposalListBlock({
  rows,
  onSend,
  onCreateContract,
  onStartProject,
  busyId,
}: {
  rows: AiProposalListRow[];
  onSend: (id: string) => void;
  onCreateContract: (id: string) => void;
  onStartProject: (id: string) => void;
  busyId?: string | null;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching proposals.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const sendable = ["draft", "sent", "viewed"].includes(row.status);
        const presentation = documentStatus(row.status);
        return (
          <div key={row.id} className={`rounded-lg border border-l-[3px] p-2.5 ${presentation.cardClass}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold">{row.title}</p>
              <DocumentStatusBadge status={row.status} />
            </div>
            <p className="text-micro text-muted-foreground">
              {row.clientName} · {formatAiMoney(row.totalAmount, row.currency)}
              {row.validUntil ? ` · valid until ${row.validUntil}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <a href={`/dashboard/proposals/${row.id}`} className={ROW_CHIP}>
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              {sendable ? (
                <button
                  type="button"
                  onClick={() => onSend(row.id)}
                  disabled={busyId === row.id}
                  className={ROW_CHIP}
                >
                  <Send className="h-3 w-3" /> {row.status === "draft" ? "Send proposal" : "Resend proposal"}
                </button>
              ) : null}
              {row.status === "accepted" ? (
                <>
                  <button
                    type="button"
                    onClick={() => onCreateContract(row.id)}
                    disabled={busyId === row.id}
                    className={ROW_CHIP}
                  >
                    <FileSignature className="h-3 w-3" /> Create contract
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartProject(row.id)}
                    disabled={busyId === row.id}
                    className={ROW_CHIP}
                  >
                    <FolderKanban className="h-3 w-3" /> Start project
                  </button>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ClientListBlock({
  rows,
  onInvoice,
  onContract,
  onMeeting,
}: {
  rows: AiClientListRow[];
  onInvoice: (name: string) => void;
  onContract: (name: string) => void;
  onMeeting: (name: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No clients yet.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border bg-muted/20 p-2.5">
          <p className="truncate text-xs font-semibold">{r.name}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a href={`/dashboard/clients/${r.id}`} className={ROW_CHIP}>
              <ExternalLink className="h-3 w-3" /> Open
            </a>
            <button type="button" onClick={() => onInvoice(r.name)} className={ROW_CHIP}>
              <ReceiptText className="h-3 w-3" /> Invoice
            </button>
            <button type="button" onClick={() => onContract(r.name)} className={ROW_CHIP}>
              <FileSignature className="h-3 w-3" /> Contract
            </button>
            <button type="button" onClick={() => onMeeting(r.name)} className={ROW_CHIP}>
              <CalendarDays className="h-3 w-3" /> Meeting
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectListBlock({
  rows,
  onInvoice,
  onCreatePortal,
  onQuestionnaire,
}: {
  rows: AiProjectListRow[];
  onInvoice: (name: string) => void;
  onCreatePortal: (projectId: string) => void;
  onQuestionnaire: (projectId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No projects yet.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border bg-muted/20 p-2.5">
          <p className="truncate text-xs font-semibold">{r.name}</p>
          <p className="text-micro text-muted-foreground">
            {r.clientName} · {r.status.replace(/_/g, " ")}
            {r.dueDate ? ` · due ${r.dueDate}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a href={`/dashboard/projects/${r.id}`} className={ROW_CHIP}>
              <ExternalLink className="h-3 w-3" /> Open
            </a>
            <button type="button" onClick={() => onInvoice(r.name)} className={ROW_CHIP}>
              <ReceiptText className="h-3 w-3" /> Invoice
            </button>
            {r.clientId ? (
              <button type="button" onClick={() => onQuestionnaire(r.id)} className={ROW_CHIP}>
                <ClipboardList className="h-3 w-3" /> Questionnaire
              </button>
            ) : null}
            {r.portalId ? (
              <a href={`/dashboard/portal/${r.portalId}`} className={ROW_CHIP}>
                <ExternalLink className="h-3 w-3" /> Open portal
              </a>
            ) : r.clientId ? (
              <button type="button" onClick={() => onCreatePortal(r.id)} className={ROW_CHIP}>
                <FolderKanban className="h-3 w-3" /> Create portal &amp; invite
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function meetingTime(row: AiMeetingListRow): string {
  if (!row.scheduledAt) return "Waiting for the client to choose a time";
  const date = new Date(row.scheduledAt);
  if (Number.isNaN(date.getTime())) return row.scheduledAt;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: row.timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
}

export function MeetingListBlock({
  rows,
  onCopyBookingLink,
}: {
  rows: AiMeetingListRow[];
  onCopyBookingLink: (publicToken: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching meetings.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{row.topic}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.clientName} · {row.durationMinutes} min
              </p>
            </div>
            <span className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-micro font-medium capitalize text-muted-foreground">
              {row.status === "proposed" ? "Awaiting time" : row.status}
            </span>
          </div>
          <div className="mt-2 flex items-start gap-1.5 text-xs text-foreground/80">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{meetingTime(row)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link href={`/dashboard/meetings/${row.id}`} className={ROW_CHIP}>
              <ExternalLink className="h-3 w-3" /> Open
            </Link>
            {row.status === "proposed" && row.publicToken ? (
              <button type="button" className={ROW_CHIP} onClick={() => onCopyBookingLink(row.publicToken)}>
                <Copy className="h-3 w-3" /> Copy booking link
              </button>
            ) : null}
            {row.status === "confirmed" && row.meetLink ? (
              <a href={row.meetLink} target="_blank" rel="noopener noreferrer" className={ROW_CHIP}>
                <Video className="h-3 w-3" /> Join call
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionnaireSendPickerBlock({
  rows,
  projectName,
  clientName,
  clientEmail,
  onDraft,
  onSend,
}: {
  rows: AiQuestionnaireListRow[];
  projectName: string;
  clientName: string;
  clientEmail: string | null;
  onDraft: () => void;
  onSend: (questionnaireId: string, title: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-sm">
        <p>No active questionnaires are available.</p>
        <button type="button" onClick={onDraft} className={`${ROW_CHIP} mt-2`}>
          <Sparkles className="h-3 w-3" /> Draft with IVo
        </button>
        <Link href="/dashboard/questionnaires" className="mt-2 inline-flex font-medium text-primary underline underline-offset-2">
          Create a questionnaire →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Choose what to send to {clientName} for {projectName}.
        {clientEmail ? ` It will be emailed to ${clientEmail}.` : " No client email is available, so only the response link will be created."}
      </p>
      <button type="button" onClick={onDraft} className={ROW_CHIP}>
        <Sparkles className="h-3 w-3" /> Draft a project-specific questionnaire
      </button>
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border bg-muted/20 p-2.5">
          <p className="text-xs font-semibold">{row.title}</p>
          <p className="mt-0.5 text-micro text-muted-foreground">
            {row.questionCount} question{row.questionCount === 1 ? "" : "s"}
            {row.description ? ` · ${row.description}` : ""}
          </p>
          <button type="button" onClick={() => onSend(row.id, row.title)} className={`${ROW_CHIP} mt-2`}>
            <Send className="h-3 w-3" /> Send to {clientName}
          </button>
        </div>
      ))}
    </div>
  );
}

export function QuestionnaireDraftResultBlock({
  draft,
  onRefine,
  onSend,
}: {
  draft: AiQuestionnaireDraftPreview;
  onRefine: () => void;
  onSend: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-semibold">{draft.title}</p>
        <p className="text-xs text-muted-foreground">
          Draft for {draft.clientName} · {draft.projectName}
        </p>
        {draft.description ? <p className="mt-1 text-xs text-muted-foreground">{draft.description}</p> : null}
      </div>
      <ol className="space-y-1.5 text-xs">
        {draft.questions.map((question, index) => (
          <li key={question.id} className="rounded-lg border bg-background/70 px-2.5 py-2">
            <span className="font-medium">{index + 1}. {question.label}</span>
            <span className="ml-1 text-muted-foreground">
              · {question.type.replace(/_/g, " ")}{question.required ? " · required" : " · optional"}
            </span>
            {question.options?.length ? (
              <p className="mt-1 text-muted-foreground">Options: {question.options.join(", ")}</p>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/questionnaires/${draft.id}`} className={ROW_CHIP}>
          <ClipboardList className="h-3 w-3" /> Review &amp; edit
        </Link>
        <button type="button" onClick={onRefine} className={ROW_CHIP}>
          <Sparkles className="h-3 w-3" /> Refine with IVo
        </button>
        <button type="button" onClick={onSend} className={ROW_CHIP}>
          <Send className="h-3 w-3" /> Send to {draft.clientName}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Nothing has been sent yet. Sending remains a separate audited action.</p>
    </div>
  );
}

export function QuestionnaireRefinementPreviewBlock({
  proposal,
  onApply,
  onCancel,
}: {
  proposal: AiQuestionnaireRefinementProposal;
  onApply: () => void;
  onCancel: () => void;
}) {
  const questionList = (questions: AiQuestionnaireDraftPreview["questions"]) => (
    <ol className="space-y-1 text-xs">
      {questions.map((question, index) => (
        <li key={question.id} className="rounded-lg border bg-background/70 px-2 py-1.5">
          {index + 1}. {question.label}
          <span className="text-muted-foreground"> · {question.required ? "required" : "optional"}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-semibold">Review questionnaire changes</p>
        <p className="text-xs text-muted-foreground">{proposal.instruction}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Before · {proposal.before.questions.length} questions</p>
          {questionList(proposal.before.questions)}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold">After · {proposal.after.questions.length} questions</p>
          {questionList(proposal.after.questions)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onApply}>Apply changes</Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>Keep current draft</Button>
      </div>
      <p className="text-xs text-muted-foreground">Applying updates the internal draft only. It does not send anything.</p>
    </div>
  );
}

export function WelcomeDocListBlock({
  rows,
  onCreate,
}: {
  rows: AiWelcomeDocListRow[];
  onCreate: () => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">No welcome documents yet.</p>
        <button type="button" onClick={onCreate} className={ROW_CHIP}>
          <BookOpen className="h-3 w-3" /> Draft one
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border bg-muted/20 p-2.5">
          <p className="truncate text-xs font-semibold">{r.title}</p>
          <p className="text-micro text-muted-foreground">
            {r.clientName} · {r.status}
            {r.sentAt ? ` · sent ${r.sentAt.slice(0, 10)}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {r.views} view{r.views === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <a href={`/dashboard/welcome/${r.id}`} className={ROW_CHIP}>
              <ExternalLink className="h-3 w-3" /> Open
            </a>
            <button type="button" onClick={onCreate} className={ROW_CHIP}>
              <FolderKanban className="h-3 w-3" /> New doc
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
