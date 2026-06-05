"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  Headphones,
  LayoutDashboard,
  Mail,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  ReceiptText,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import {
  approveInvoiceFromAiAction,
  approveWelcomeDocFromAiAction,
  contractWhatsappFromAiAction,
  createClientFromAiAction,
  createContractFromAiAction,
  createInvoiceFromAiAction,
  createProjectFromAiAction,
  createTimeEntryFromAiAction,
  createWelcomeDocFromAiAction,
  emailInvoiceFromAiAction,
  interpretAiMessageAction,
  invoiceWhatsappFromAiAction,
  refineContractFromAiAction,
  sendContractFromAiAction,
  sendWelcomeDocFromAiAction,
  welcomeDocWhatsappFromAiAction,
  answerFromDocsAction,
} from "@/features/ai-workflows/global-actions";
import { submitBugReportAction } from "@/features/support/actions";
import {
  AI_SKIP_SENTINEL,
  NO_CLIENT_SENTINEL,
  type AiFields,
  type AiInterpretation,
  type AiMissingField,
} from "@/features/ai-workflows/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiEntityOption {
  id: string;
  name: string;
  clientId?: string | null;
}

interface StackivoAiAssistantProps {
  clients: AiEntityOption[];
  projects: AiEntityOption[];
}

type AiMode =
  | "general"
  | "invoice"
  | "contract"
  | "welcome_document"
  | "client"
  | "project"
  | "time_entry"
  | "support";

interface Message {
  id: string;
  role: "assistant" | "user";
  content: React.ReactNode;
}

interface AiInvoicePreview {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  originalSubtotal: number;
  discount: number;
  subtotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: string;
  dueDate: string;
  status: string;
  terms: string | null;
  notes: string | null;
}

interface AiContractPreview {
  id: string;
  title: string;
  kind: "contract" | "proposal";
  clientName: string;
  clientEmail: string | null;
  projectName: string | null;
  valueAmount: number | null;
  currency: string;
  sections: Array<{ heading: string; body: string }>;
}

interface AiWelcomeDocPreview {
  id: string;
  title: string;
  intro: string | null;
  sections: Array<{ heading: string; body: string }>;
  acknowledgementRequired: boolean;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  projectName: string | null;
}

interface AiConfirmSummary {
  kind: "client" | "project" | "time_entry";
  title: string;
  lines: Array<[label: string, value: string]>;
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: Array<{
  mode: AiMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    mode: "invoice",
    title: "Create invoice",
    description: "Draft and approve an invoice from a single prompt.",
    icon: ReceiptText,
  },
  {
    mode: "contract",
    title: "Draft contract",
    description: "Generate a full agreement or proposal with all clauses.",
    icon: FileSignature,
  },
  {
    mode: "welcome_document",
    title: "Welcome doc",
    description: "Prepare a polished onboarding guide for a client.",
    icon: FileText,
  },
  {
    mode: "client",
    title: "Add client",
    description: "Create a client record from a description.",
    icon: Users,
  },
  {
    mode: "project",
    title: "Add project",
    description: "Create a project and link it to a client.",
    icon: LayoutDashboard,
  },
  {
    mode: "time_entry",
    title: "Log time",
    description: "Record billable hours against a project.",
    icon: Clock,
  },
  {
    mode: "support",
    title: "Support",
    description: "Ask a question or submit a support request.",
    icon: Headphones,
  },
];

// ---------------------------------------------------------------------------
// Per-mode placeholder hints (free-form; the NLU extracts and asks for gaps)
// ---------------------------------------------------------------------------

const MODE_PLACEHOLDERS: Partial<Record<AiMode, string>> = {
  invoice: "Example: Invoice Acme 25000 for website redesign, due in 15 days, 5000 off",
  contract: "Example: Service agreement for Acme — 5-page site, INR 150000, 50% upfront, 2 revisions",
  welcome_document: "Example: Welcome doc for Acme — weekly Friday updates, feedback in one doc, warm tone",
  client: "Example: Add Riya Sharma, Acme Encore, riya@acme.com, +91 9876543210, Mumbai",
  project: "Example: Website Redesign for Acme — landing page + CMS, starts Monday, due end of month",
  time_entry: "Example: Logged 2h 30m on wireframe revisions for Acme, billable",
  support: "Ask anything — docs, privacy, terms, or raise a support ticket",
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAiMoney(amount: number | null | undefined, currency = "INR") {
  if (!amount) return "";
  return formatMoney(amount, currency);
}

function modeIntro(mode: AiMode): string {
  switch (mode) {
    case "invoice":
      return "Let's create an invoice. Describe the client, work, amount, and due date.";
    case "contract":
      return "Let's draft a contract or proposal. I'll walk you through it.";
    case "welcome_document":
      return "Let's prepare a welcome document. A few questions and I'll generate the full guide.";
    case "client":
      return "Let's add a client. Tell me the details and I'll create the record.";
    case "project":
      return "Let's create a project. Tell me the name, scope, and timeline.";
    case "time_entry":
      return "Let's log some time. Which project and how long?";
    case "support":
      return "I can answer from docs, privacy, or terms — or send this to support.";
    default:
      return "What would you like to do?";
  }
}

/**
 * Quick conversational replies for greetings and meta questions ("hi",
 * "can I ask you a question", "what can you do") so the assistant answers
 * naturally instead of running a docs lookup that finds nothing.
 * Returns null for substantive questions, which fall through to the docs flow.
 */
function conversationalReply(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[!.?,]+$/g, "");
  if (/^(hi+|hey+|hello+|yo|hiya|namaste|good (morning|afternoon|evening))\b/.test(t)) {
    return "Hey! I can create invoices, contracts, and welcome docs, add clients and projects, log time, or answer questions about Stackivo. What would you like to do?";
  }
  if (/^(thanks|thank you|thx|ty|great|perfect|awesome|cool|nice|ok|okay|got it)\b/.test(t)) {
    return "Anytime! Tell me the next thing you'd like to do.";
  }
  if (/\b(can|could|may) i ask( you)?( a| you a)? ?(question|something|doubt)?\b|^ask you|are you (there|online|here)|you there/.test(t)) {
    return "Of course — go ahead and ask. I can help with invoices, contracts, welcome docs, clients, projects, time logs, or how Stackivo works.";
  }
  if (/what can you do|who are you|what are you|how can you help|what do you do|how do you work/.test(t)) {
    return "I'm your Stackivo workflow assistant. I can draft and send invoices & contracts, prepare welcome documents, add clients and projects, log billable time, and answer questions about how Stackivo works. Just describe what you need — for example, “Invoice Acme 50000 for a landing page.”";
  }
  return null;
}

/**
 * True when a message reads like a question to answer (from docs) rather than a
 * command to create something — e.g. "what about billing?", "how do invoices
 * work". Used so the home screen answers such messages instead of opening a
 * workflow. A clear action verb ("create an invoice…") opts out.
 */
function isInformationalQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\b(create|make|draft|add|new|start|log|raise|generate|send|prepare|build|issue|set ?up)\b/.test(t)) {
    return false;
  }
  if (/\?\s*$/.test(t)) return true;
  return /^(what|whats|what'?s|what about|how|how about|why|when|where|who|which|can i|can you|could (i|you)|should i|do (i|you)|does|did|is|are|will|would|tell me|explain)\b/.test(
    t,
  );
}

/** Matches a short "skip"/"none" style reply to an optional prompt. */
function isSkipReply(text: string): boolean {
  return /^(skip|none|no|n\/a|na|nope|nah|leave it|not now|-|—)$/i.test(text.trim());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionList({
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

function ResultBlock({
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
function ConfirmBlock({
  summary,
  onConfirm,
  onCancel,
}: {
  summary: AiConfirmSummary;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="font-semibold">{summary.title}</p>
      <div className="rounded-xl border bg-muted/20 p-3 text-xs space-y-1.5">
        {summary.lines.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onConfirm}>
          Confirm &amp; create
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Invoice preview
function InvoiceDraftPreview({
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
      </div>
      <div className="rounded-xl border bg-muted/20 p-3 text-xs space-y-1.5">
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
            <span className="text-red-500">
              −{formatAiMoney(preview.discount, preview.currency)}
            </span>
          </div>
        )}
        {preview.taxTotal > 0 && (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatAiMoney(preview.taxTotal, preview.currency)}</span>
          </div>
        )}
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

function InvoiceDeliveryActions({
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
      <div className="rounded-xl border bg-muted/20 p-3 text-xs space-y-1">
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

function ClientPicker({
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
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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

// Contract preview — all sections
function ContractDraftPreview({
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
function WelcomeDocDraftPreview({
  preview,
  onApprove,
  onOpen,
}: {
  preview: AiWelcomeDocPreview;
  onApprove: (preview: AiWelcomeDocPreview) => void;
  onOpen: () => void;
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
      {preview.acknowledgementRequired && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3 w-3 text-green-500" />
          Client acknowledgement required
        </p>
      )}
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
      </div>
    </div>
  );
}

function WelcomeDocDeliveryActions({
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

export function StackivoAiAssistant({ clients }: StackivoAiAssistantProps) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [panelSlot, setPanelSlot] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(440);
  const [mode, setMode] = React.useState<AiMode>("general");
  const [input, setInput] = React.useState("");
  const [collected, setCollected] = React.useState<AiFields>({});
  const [pendingField, setPendingField] = React.useState<AiMissingField | null>(null);
  const [clientId, setClientId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [lastInvoicePreview, setLastInvoicePreview] =
    React.useState<AiInvoicePreview | null>(null);
  // A contract draft that is open for in-panel refinement (follow-up messages
  // revise it instead of starting a new workflow).
  const [activeContract, setActiveContract] =
    React.useState<AiContractPreview | null>(null);
  // Mobile/PWA: the desktop panel lives in a hidden md-only rail, so on small
  // screens we portal the panel to document.body and render it full-screen.
  const [isMobile, setIsMobile] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [messages, setMessages] = React.useState<Message[]>(() => [
    {
      id: newId(),
      role: "assistant",
      content: (
        <>
          <span className="block font-semibold">Good to see you.</span>
          <span className="mt-1 block text-muted-foreground">
            Tell me what you want to do, or pick a workflow. I can create invoices,
            contracts, welcome docs, clients, projects, log time, and answer support
            questions.
          </span>
        </>
      ),
    },
  ]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastInvoicePreviewRef = React.useRef<AiInvoicePreview | null>(null);
  const runWorkflowRef = React.useRef<
    (
      workflow: AiMode,
      fields: AiFields,
      cId: string,
      pId: string,
      text: string,
      confirm?: boolean,
    ) => Promise<void>
  >(async () => {});
  const resizeActiveRef = React.useRef(false);
  const resizeStartXRef = React.useRef(0);
  const resizeStartWidthRef = React.useRef(440);
  const panelWidthRef = React.useRef(440);

  const RESIZE_MIN = 420;
  const RESIZE_MAX = 720;
  const RESIZE_DEFAULT = 440;
  const RESIZE_EXPANDED = 700;

  const handleNewConversation = React.useCallback(() => {
    setMode("general");
    setCollected({});
    setPendingField(null);
    setInput("");
    setClientId("");
    setProjectId("");
    setLastInvoicePreview(null);
    setActiveContract(null);
    setMessages((prev) => prev.slice(0, 1));
  }, []);

  React.useEffect(() => { setMounted(true); }, []);

  React.useEffect(() => {
    if (!mounted) return;
    setPanelSlot(document.getElementById("stackivo-ai-panel-slot"));
  }, [mounted]);

  // Track the mobile breakpoint so we can portal + style the panel full-screen.
  React.useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mounted]);

  React.useEffect(() => {
    lastInvoicePreviewRef.current = lastInvoicePreview;
  }, [lastInvoicePreview]);

  React.useEffect(() => {
    panelWidthRef.current = panelWidth;
  }, [panelWidth]);

  React.useEffect(() => {
    if (!resizeActiveRef.current) return;
    const handleMove = (event: PointerEvent) => {
      const delta = resizeStartXRef.current - event.clientX;
      const next = Math.max(RESIZE_MIN, Math.min(RESIZE_MAX, resizeStartWidthRef.current + delta));
      setPanelWidth(next);
      setExpanded(false);
    };
    const handleUp = () => {
      resizeActiveRef.current = false;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [RESIZE_MAX, RESIZE_MIN]);

  React.useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("stackivo-ai-open", open);
    document.documentElement.style.setProperty(
      "--stackivo-ai-width",
      `${panelWidth}px`,
    );
    return () => {
      document.documentElement.classList.remove("stackivo-ai-open");
      document.documentElement.style.removeProperty("--stackivo-ai-width");
    };
  }, [expanded, mounted, open, panelWidth]);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (!node) return;
      // On initial open (no conversation yet), show the top (greeting + quick actions).
      // Only auto-scroll to bottom once a real conversation is underway.
      if (messages.length > 1 || pending) {
        node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
      } else {
        node.scrollTo({ top: 0, behavior: "instant" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, pending]);

  const push = React.useCallback((message: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: newId() }]);
  }, []);

  // ----- Invoice handlers -----

  const handleInvoiceDelivery = React.useCallback(
    (preview: AiInvoicePreview, channel: "email" | "whatsapp" | "both") => {
      push({
        role: "user",
        content:
          channel === "both"
            ? "Send by email and WhatsApp"
            : channel === "email"
              ? "Send by email"
              : "Open WhatsApp",
      });
      startTransition(async () => {
        if (channel === "email" || channel === "both") {
          const email = await emailInvoiceFromAiAction({ invoiceId: preview.id });
          if (!email.ok) { push({ role: "assistant", content: email.error }); return; }
        }
        if (channel === "whatsapp" || channel === "both") {
          const wa = await invoiceWhatsappFromAiAction({ invoiceId: preview.id });
          if (!wa.ok) { push({ role: "assistant", content: wa.error }); return; }
          window.open(wa.data.url, "_blank", "noopener,noreferrer");
        }
        push({
          role: "assistant",
          content:
            channel === "both"
              ? "Done. Invoice emailed and WhatsApp opened with the link."
              : channel === "email"
                ? "Done. Invoice emailed to the client."
                : "WhatsApp is open with the invoice link ready to send.",
        });
        router.refresh();
      });
    },
    [push, router],
  );

  const handleInvoiceApprove = React.useCallback(
    (preview: AiInvoicePreview, emitUserMessage = true) => {
      if (emitUserMessage) {
        push({ role: "user", content: `Approve ${preview.invoiceNumber}` });
      }
      startTransition(async () => {
        const res = await approveInvoiceFromAiAction({ invoiceId: preview.id });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        push({
          role: "assistant",
          content: (
            <InvoiceDeliveryActions
              preview={{ ...preview, status: "sent" }}
              onDeliver={handleInvoiceDelivery}
              onOpen={() => router.push(`/dashboard/invoices/${preview.id}`)}
            />
          ),
        });
        setLastInvoicePreview({ ...preview, status: "sent" });
        router.refresh();
      });
    },
    [handleInvoiceDelivery, push, router],
  );

  // ----- Welcome doc handlers -----

  const handleWelcomeDocDelivery = React.useCallback(
    (preview: AiWelcomeDocPreview, channel: "email" | "whatsapp") => {
      push({ role: "user", content: channel === "email" ? "Send by email" : "Open WhatsApp" });
      startTransition(async () => {
        if (channel === "email") {
          const res = await sendWelcomeDocFromAiAction({ welcomeDocId: preview.id });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          push({ role: "assistant", content: "Done. Welcome document emailed to the client." });
        } else {
          const res = await welcomeDocWhatsappFromAiAction({ welcomeDocId: preview.id });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          window.open(res.data.url, "_blank", "noopener,noreferrer");
          push({ role: "assistant", content: "WhatsApp is open with the welcome document link ready to send." });
        }
        router.refresh();
      });
    },
    [push, router],
  );

  const handleWelcomeDocApprove = React.useCallback(
    (preview: AiWelcomeDocPreview) => {
      push({ role: "user", content: `Approve and publish ${preview.title}` });
      startTransition(async () => {
        const res = await approveWelcomeDocFromAiAction({ welcomeDocId: preview.id });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        push({
          role: "assistant",
          content: (
            <WelcomeDocDeliveryActions
              preview={preview}
              onDeliver={handleWelcomeDocDelivery}
              onOpen={() => router.push(`/dashboard/welcome/${preview.id}`)}
            />
          ),
        });
        router.refresh();
      });
    },
    [handleWelcomeDocDelivery, push, router],
  );

  // ----- Contract handlers -----

  const handleContractApproveAndSend = React.useCallback(
    (preview: AiContractPreview) => {
      push({ role: "user", content: `Approve and email ${preview.title}` });
      startTransition(async () => {
        const res = await sendContractFromAiAction({ contractId: preview.id });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        setActiveContract(null);
        push({
          role: "assistant",
          content: `${preview.kind === "proposal" ? "Proposal" : "Contract"} sent to ${preview.clientEmail ?? "the selected client"}.`,
        });
        router.refresh();
      });
    },
    [push, router],
  );

  const handleContractWhatsApp = React.useCallback(
    (preview: AiContractPreview) => {
      push({ role: "user", content: `Open WhatsApp for ${preview.title}` });
      startTransition(async () => {
        const res = await contractWhatsappFromAiAction({ contractId: preview.id });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        setActiveContract(null);
        window.open(res.data.url, "_blank", "noopener,noreferrer");
        push({ role: "assistant", content: `WhatsApp is open with the ${preview.kind === "proposal" ? "proposal" : "contract"} link ready to send.` });
        router.refresh();
      });
    },
    [push, router],
  );

  // ----- Conversational support / docs answering -----

  const runSupport = React.useCallback(
    async (text: string, fileTicket: boolean) => {
      // Greetings and meta questions ("hi", "can I ask you a question") get a
      // natural reply instead of an empty docs lookup.
      const chat = conversationalReply(text);
      if (chat) {
        push({ role: "assistant", content: chat });
        return;
      }
      if (text.trim().length < 4) {
        push({ role: "assistant", content: "Tell me a little more about what you need." });
        return;
      }
      const docs = await answerFromDocsAction({ question: text });
      const answer = docs.ok
        ? docs.data.answer
        : "I'm not sure from the docs — could you rephrase, or tell me what you're trying to do? I can help with invoices, contracts, welcome docs, clients, projects, and time logs.";
      const usedDocs = docs.ok && docs.data.usedDocs;

      if (fileTicket && !usedDocs) {
        const ticket = await submitBugReportAction({
          category: "how-to",
          summary: text.slice(0, 180),
          details: text,
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        });
        push({
          role: "assistant",
          content: ticket.ok
            ? `${answer}\n\nI also sent this to Stackivo support for follow-up.`
            : answer,
        });
        return;
      }
      push({ role: "assistant", content: answer });
    },
    [push],
  );

  // ----- Core workflow executor (structured fields → action → preview) -----

  const runWorkflow = React.useCallback(
    async (
      workflow: AiMode,
      fields: AiFields,
      cId: string,
      pId: string,
      text: string,
      confirm = false,
    ) => {
      const actionInput = {
        fields,
        clientId: cId || undefined,
        projectId: pId || undefined,
        prompt: text || undefined,
        confirm,
      };

      // Show a pre-create summary and wait for the user to approve it.
      const showConfirm = (summary: AiConfirmSummary) => {
        setPendingField(null);
        push({
          role: "assistant",
          content: (
            <ConfirmBlock
              summary={summary}
              onConfirm={() => {
                push({ role: "user", content: "Confirm" });
                startTransition(async () => {
                  await runWorkflowRef.current(workflow, fields, cId, pId, "", true);
                });
              }}
              onCancel={() => {
                finish();
                push({ role: "assistant", content: "No problem — cancelled. What next?" });
              }}
            />
          ),
        });
      };

      const askMissing = (missing: AiMissingField) => {
        setPendingField(missing);
        if (missing.field === "clientId") {
          const subject =
            workflow === "invoice"
              ? "invoice"
              : workflow === "contract"
                ? "contract"
                : workflow === "project"
                  ? "project"
                  : workflow === "welcome_document"
                    ? "welcome document"
                    : "";
          const label = subject ? `Which client is this ${subject} for?` : "Which client is this for?";
          const allowSkip = workflow === "project";
          const proceed = (id: string, display: string) => {
            if (id !== NO_CLIENT_SENTINEL) setClientId(id);
            setPendingField(null);
            push({ role: "user", content: display });
            startTransition(async () => {
              await runWorkflowRef.current(workflow, fields, id, pId, "");
            });
          };
          push({
            role: "assistant",
            content: (
              <ClientPicker
                clients={clients}
                label={label}
                allowSkip={allowSkip}
                onSelect={(id) =>
                  proceed(id, clients.find((c) => c.id === id)?.name ?? "Selected client")
                }
                onSkip={() => proceed(NO_CLIENT_SENTINEL, "No client (internal)")}
              />
            ),
          });
        } else {
          push({
            role: "assistant",
            content: (
              <>
                <span className="block">{missing.question}</span>
                {missing.placeholder ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {missing.placeholder}
                  </span>
                ) : null}
                {missing.optional ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Optional — reply “skip” to leave it out.
                  </span>
                ) : null}
              </>
            ),
          });
        }
      };

      const finish = () => {
        setMode("general");
        setCollected({});
        setPendingField(null);
        // Clear workspace context so the next workflow never inherits a stale
        // client/project (e.g. a project silently reusing the invoice's client).
        setClientId("");
        setProjectId("");
        setActiveContract(null);
      };

      switch (workflow) {
        case "invoice": {
          const res = await createInvoiceFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else push({ role: "assistant", content: res.error });
            return;
          }
          const preview = res.data.preview;
          setLastInvoicePreview(preview);
          finish();
          push({
            role: "assistant",
            content: (
              <InvoiceDraftPreview
                preview={preview}
                onApprove={handleInvoiceApprove}
                onOpen={() => router.push(`/dashboard/invoices/${preview.id}`)}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "client": {
          const res = await createClientFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          push({
            role: "assistant",
            content: (
              <ResultBlock
                title="Client created"
                description={`Added ${res.data.fullName} to your workspace.`}
                actionLabel="Open clients"
                onAction={() => router.push("/dashboard/clients")}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "project": {
          const res = await createProjectFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          push({
            role: "assistant",
            content: (
              <ResultBlock
                title="Project created"
                description={`${res.data.name} is ready.`}
                actionLabel="Open projects"
                onAction={() => router.push("/dashboard/projects")}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "contract": {
          const res = await createContractFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          // Keep the draft open for in-panel refinement: follow-up messages
          // revise this contract instead of starting a new workflow.
          setActiveContract(res.data);
          push({
            role: "assistant",
            content: (
              <ContractDraftPreview
                preview={res.data}
                onApproveAndSend={handleContractApproveAndSend}
                onWhatsApp={handleContractWhatsApp}
                onOpen={() => router.push(`/dashboard/contracts/${res.data.id}`)}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "welcome_document": {
          const res = await createWelcomeDocFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          push({
            role: "assistant",
            content: (
              <WelcomeDocDraftPreview
                preview={res.data}
                onApprove={handleWelcomeDocApprove}
                onOpen={() => router.push(`/dashboard/welcome/${res.data.id}`)}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "time_entry": {
          const res = await createTimeEntryFromAiAction(actionInput);
          if (!res.ok) {
            if ("missing" in res && res.missing) askMissing(res.missing);
            else if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary);
            else push({ role: "assistant", content: res.error });
            return;
          }
          const entry = res.data;
          finish();
          push({
            role: "assistant",
            content: (
              <ResultBlock
                title="Time entry logged"
                description={`${entry.description} — ${entry.hours}h ${entry.minutes}m${entry.billable ? " · billable" : " · non-billable"}.`}
                actionLabel="Open time tracker"
                onAction={() => router.push("/dashboard/time")}
              />
            ),
          });
          router.refresh();
          return;
        }

        case "support": {
          await runSupport(text, true);
          finish();
          return;
        }

        default: {
          // General free-form chat — answer from docs without filing a ticket.
          await runSupport(text, false);
          return;
        }
      }
    },
    [
      clients,
      push,
      router,
      runSupport,
      handleInvoiceApprove,
      handleContractApproveAndSend,
      handleContractWhatsApp,
      handleWelcomeDocApprove,
    ],
  );

  React.useEffect(() => {
    runWorkflowRef.current = runWorkflow;
  }, [runWorkflow]);

  // ----- Mode selection -----

  const selectMode = React.useCallback(
    (nextMode: AiMode) => {
      setMode(nextMode);
      setInput("");
      setCollected({});
      setPendingField(null);
      setClientId("");
      setProjectId("");
      setActiveContract(null);
      push({ role: "assistant", content: <span className="block">{modeIntro(nextMode)}</span> });
    },
    [push],
  );

  // Keyword fallback intent detection (used only when the NLU is unavailable).
  const detectMode = React.useCallback(
    (text: string): AiMode => {
      const t = text.toLowerCase();
      // Questions and help topics are answered from docs, not turned into a draft.
      if (isInformationalQuestion(text)) return "support";
      if (/support|bug|issue|help|how do|how to|what is|privacy|terms/.test(t)) return "support";
      if (/invoice|bill\s|billing|receipt|charge/.test(t)) return "invoice";
      if (/contract|agreement|proposal|nda|retainer/.test(t)) return "contract";
      if (/welcome|onboard|kickoff/.test(t)) return "welcome_document";
      if (/\bproject\b/.test(t)) return "project";
      if (/\bclient\b|\bcustomer\b|\bcontact\b/.test(t)) return "client";
      if (/\btime\b|\bhours?\b|\bminutes?\b|\blog\b|\bbillable\b/.test(t)) return "time_entry";
      return mode;
    },
    [mode],
  );

  // ----- Submit handler -----

  const handleSubmit = React.useCallback(() => {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    push({ role: "user", content: text });

    startTransition(async () => {
      // 1. Interpret the message (intent + structured fields + resolved ids).
      const interpreted = await interpretAiMessageAction({
        message: text,
        currentWorkflow: mode === "general" ? undefined : mode,
        collected,
      });
      const nlu: AiInterpretation | null = interpreted.ok ? interpreted.data : null;

      // 1b. If a contract draft is open, revise it in place — unless the user
      // is starting a brand-new document or confidently switching workflow.
      if (activeContract) {
        const chat = conversationalReply(text);
        if (chat) {
          push({ role: "assistant", content: chat });
          return;
        }
        const switchingAway =
          !!nlu?.confident && nlu.intent !== "general" && nlu.intent !== "contract";
        const startsNewContract =
          /\b(create|draft|start|generate|prepare|make)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(contract|proposal|agreement)\b/i.test(
            text,
          ) ||
          /\b(new|another|second|separate|different)\s+(contract|proposal|agreement)\b/i.test(text);
        if (!switchingAway && !startsNewContract) {
          const res = await refineContractFromAiAction({
            contractId: activeContract.id,
            instruction: text,
          });
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          setActiveContract(res.data);
          push({
            role: "assistant",
            content: (
              <ContractDraftPreview
                preview={res.data}
                onApproveAndSend={handleContractApproveAndSend}
                onWhatsApp={handleContractWhatsApp}
                onOpen={() => router.push(`/dashboard/contracts/${res.data.id}`)}
              />
            ),
          });
          router.refresh();
          return;
        }
        // Starting fresh / switching: drop the refinement context and continue.
        setActiveContract(null);
      }

      // 2. Decide the target workflow.
      //    - From the home screen, an informational question ("what about
      //      billing?", "how do invoices work?") is answered from the docs
      //      instead of opening a workflow.
      //    - Otherwise the home screen enters the detected workflow; mid-flow we
      //      only switch when the NLU is confident the user changed task.
      let targetMode: AiMode = mode;
      if (mode === "general" && isInformationalQuestion(text)) {
        targetMode = "general";
      } else if (nlu) {
        const intent = nlu.intent;
        const isSwitch = nlu.confident && intent !== "general" && intent !== mode;
        if (mode === "general") {
          // A support/question intent is answered from docs (general handler);
          // an actionable intent opens its workflow.
          targetMode = intent === "support" || intent === "general" ? "general" : intent;
        } else if (isSwitch) {
          targetMode = intent;
        }
      } else if (mode === "general") {
        // NLU unavailable — fall back to keyword routing.
        targetMode = detectMode(text);
      }

      const switching = targetMode !== mode;
      if (switching) setMode(targetMode);

      // 3. Merge newly extracted fields onto what we already collected.
      const baseFields: AiFields = switching ? {} : { ...collected };
      const merged: AiFields = { ...baseFields, ...(nlu?.fields ?? {}) };

      // If we were waiting on a specific field and the NLU did not capture it,
      // treat the whole message as that field's answer. For an optional prompt a
      // "skip" reply is recorded as a sentinel so it counts as addressed (and is
      // never re-asked) without inventing a value.
      if (
        pendingField &&
        pendingField.field !== "clientId" &&
        !merged[pendingField.field]
      ) {
        merged[pendingField.field] =
          pendingField.optional && isSkipReply(text) ? AI_SKIP_SENTINEL : text;
      }

      setCollected(merged);
      setPendingField(null);

      // 4. Resolve client/project — prefer the NLU match. When switching
      // workflows, never inherit the previous one's client/project; only a
      // client/project named in this very message carries over.
      const cId = nlu?.clientId || (switching ? "" : clientId);
      const pId = nlu?.projectId || (switching ? "" : projectId);
      if (cId !== clientId) setClientId(cId);
      if (pId !== projectId) setProjectId(pId);

      await runWorkflow(targetMode, merged, cId, pId, text);
    });
  }, [
    input,
    pending,
    activeContract,
    handleContractApproveAndSend,
    handleContractWhatsApp,
    router,
    mode,
    collected,
    pendingField,
    clientId,
    projectId,
    push,
    detectMode,
    runWorkflow,
  ]);

  // ----- Render -----

  return (
    <>
      {/* Top bar trigger — desktop */}
      <div className="hidden items-center gap-1 md:flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-sm font-semibold"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="h-4 w-4" /> Ask AI
        </Button>
      </div>
      {/* Top bar trigger — mobile */}
      {!open && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      )}
      {open && (
        <div className="md:hidden flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Close AI panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Full-height right-side panel (desktop: docked rail; mobile/PWA:
          full-screen overlay portaled to the body so it isn't trapped inside
          the hidden md-only rail). */}
      {mounted && (isMobile || panelSlot) ? createPortal((
        <div
          data-open={open ? "true" : "false"}
          className={cn(
            "stackivo-ai-panel flex h-full w-full flex-col bg-background shadow-[inset_1px_0_0_hsl(var(--border))]",
            !open && "pointer-events-none",
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 text-left font-semibold"
              onClick={() => setMode("general")}
            >
              <StackivoMark className="h-6 w-6" bare />
              New conversation
            </button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleNewConversation}
                aria-label="New conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 md:inline-flex"
                onClick={() => {
                  setExpanded((value) => {
                    const next = !value;
                    setPanelWidth(next ? RESIZE_EXPANDED : RESIZE_DEFAULT);
                    return next;
                  });
                }}
                aria-label={expanded ? "Collapse AI panel" : "Expand AI panel"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label="Close AI panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div
            className="stackivo-ai-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize AI panel"
            onPointerDown={(event) => {
              resizeActiveRef.current = true;
              resizeStartXRef.current = event.clientX;
              resizeStartWidthRef.current = panelWidthRef.current;
              event.preventDefault();
            }}
          />

          {/* Scrollable messages area */}
          <div
            ref={scrollRef}
            className="scrollbar-modern min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/15 [background-image:radial-gradient(hsl(var(--border)/0.35)_1px,transparent_1px)] [background-size:18px_18px] px-5 py-5 md:px-6"
          >
            {/* Greeting + quick actions (general mode, no conversation yet) */}
            {mode === "general" && messages.length <= 1 && (
              <>
                <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                      Stackivo AI
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight">What are we doing today?</h2>
                    <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                      Chat freely, pick a workflow, or let AI draft the document or action you need.
                    </p>
                  </div>
                  <div className="flex justify-center md:justify-end">
                    <div className="relative flex h-28 w-full max-w-[240px] items-center justify-center overflow-hidden rounded-3xl border bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),hsl(var(--background))_75%)]">
                      <span className="absolute left-10 top-8 h-14 w-14 rounded-full bg-primary/20 blur-sm" />
                      <span className="absolute left-16 top-5 h-16 w-16 rounded-full bg-primary/15" />
                      <span className="absolute right-10 top-8 h-14 w-14 rounded-full bg-primary/80 shadow-[0_0_30px_rgba(59,130,246,0.18)]" />
                      <StackivoMark className="relative h-14 w-14 shadow-lg" />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.mode}
                      type="button"
                      onClick={() => selectMode(action.mode)}
                      className={cn(
                        "flex min-h-24 items-start gap-3 rounded-2xl border bg-background/95 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5",
                        mode === action.mode && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
                      )}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-5">{action.title}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{action.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Message bubbles */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                    message.role === "user"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "mr-auto bg-muted/60",
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border bg-background px-4 py-3 shadow-sm">
                  <span className="flex items-center gap-1">
                    {[0, 1, 2].map((item) => (
                      <span
                        key={item}
                        className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
                        style={{ animationDelay: `${item * 120}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="sticky bottom-0 border-t bg-background px-4 py-3">
            <div className="rounded-2xl border bg-background p-3 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15">
              <Textarea
                value={input}
                data-testid="ai-chat-input"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  pendingField?.placeholder ??
                  pendingField?.question ??
                  MODE_PLACEHOLDERS[mode] ??
                  (mode === "general" ? "Describe what you want to do…" : "Type your answer…")
                }
                rows={3}
                className="min-h-[72px] resize-none border-0 p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
                  {mode === "general" ? "Ask" : QUICK_ACTIONS.find((a) => a.mode === mode)?.title ?? "Ask"}
                </span>
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={handleSubmit}
                  disabled={pending || !input.trim()}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ), isMobile ? document.body : (panelSlot ?? document.body)) : null}
    </>
  );
}
