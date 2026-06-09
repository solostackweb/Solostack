"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bookmark,
  Check,
  Clock,
  ExternalLink,
  FileSignature,
  FileText,
  Headphones,
  LayoutDashboard,
  Lightbulb,
  Mail,
  LayoutGrid,
  MessageCircle,
  Plus,
  ReceiptText,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import { INDIAN_STATES } from "@/features/gst/state-codes";
import { BUILTIN_WELCOME_TEMPLATES } from "@/features/welcome-documents/templates";
import { saveAsTemplateAction } from "@/features/welcome-documents/actions";
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
  refineInvoiceFromAiAction,
  refineWelcomeDocFromAiAction,
  sendContractFromAiAction,
  sendWelcomeDocFromAiAction,
  welcomeDocWhatsappFromAiAction,
  answerFromDocsAction,
} from "@/features/ai-workflows/global-actions";
import { submitBugReportAction } from "@/features/support/actions";
import {
  AI_SKIP_SENTINEL,
  NO_CLIENT_SENTINEL,
  NO_PROJECT_SENTINEL,
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
  /** Optional one-tap quick replies shown under an assistant message. */
  suggestions?: string[];
  /** Optional short professional tip shown under an assistant message. */
  tip?: string;
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
  // Greetings — tolerant of common typos (helo, helloo, hii, heyy, gud morning).
  if (/^(hi+|hey+|h(e|a)l+o+|hii+|heyy+|yo+|hiya|hello+|namaste|namaskar|hii?ya|good ?(morning|afternoon|evening|day)|gud ?(morning|mrng|eve))\b/.test(t)) {
    return "Hey! I can create invoices, contracts, and welcome docs, add clients and projects, log time, or answer questions about Stackivo. What would you like to do?";
  }
  if (/^(thanks?|thank ?(you|u)|thnx|thnks|thanx|thx|ty|tysm|great|perfect|awesome|cool|nice|ok+|okay|okey|k|got it|cheers|appreciate it)( (so much|a lot|you|u|man|mate|buddy|bro))?$/.test(t)) {
    return "Anytime! Tell me the next thing you'd like to do.";
  }
  if (/\b(can|could|may) i ask( you)?( a| you a)? ?(question|something|doubt)?\b|^ask you|are you (there|online|here)|you there/.test(t)) {
    return "Of course — go ahead and ask. I can help with invoices, contracts, welcome docs, clients, projects, time logs, or how Stackivo works.";
  }
  if (/what can you do|who are you|what are you|how can you help|what do you do|how do you work/.test(t)) {
    return "I'm your Stackivo workflow assistant. I can draft and send invoices & contracts, prepare welcome documents, add clients and projects, log billable time, and answer questions about how Stackivo works. Just describe what you need — for example, “Invoice Acme 50000 for a landing page.”";
  }
  if (/how are you|how'?s it going|how do you do|how have you been|hope you('| a)re (doing )?(well|good)/.test(t)) {
    return "Doing great, thanks for asking! What can I help you with — invoices, contracts, clients, or a quick question about Stackivo?";
  }
  if (/\bare you (a )?(bot|robot|ai|human|real)\b|who (made|built|created) you|are you chatgpt/.test(t)) {
    return "I'm Stackivo's built-in AI assistant — here to help you run your freelance business. Ask me to create invoices, contracts, welcome docs, clients, or projects, log time, or anything about how Stackivo works.";
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

/**
 * Sanity-check a typed answer against the field it's meant to fill. Returns a
 * gentle correction string when the answer clearly can't work (e.g. no number
 * for an amount, no time unit for a duration, no date for a due date) so the
 * assistant can re-ask instead of silently saving nonsense. Returns null when
 * the answer looks plausible (we stay lenient — better to accept than to nag).
 */
function fieldValidationError(field: string, text: string): string | null {
  const t = text.trim();
  const hasNumber = /\d/.test(t);
  switch (field) {
    case "amount":
      if (!hasNumber)
        return "I need a number for the amount — for example “50000” or “1.5L”. How much should I invoice (before tax)?";
      return null;
    case "duration":
      if (!hasNumber)
        return "Tell me how long in hours/minutes — for example “2h 30m” or “45m”. And is it billable?";
      return null;
    case "dueDate":
      // A date, a relative phrase, or "skip" are all fine.
      if (
        !hasNumber &&
        !/\b(today|tomorrow|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eom|end of)\b/i.test(t)
      )
        return "When is it due? Try “in 15 days”, “next month”, a date like 2026-07-01 — or reply “skip”.";
      return null;
    case "email":
      if (!/^\S+@\S+\.\S+$/.test(t))
        return "That doesn't look like an email address — for example “name@company.com”. What's their email?";
      return null;
    default:
      return null;
  }
}

/** A short affirmative reply to a confirmation prompt ("yes", "go ahead"). */
function isAffirmative(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  return /^(y|yes+|yeah|yep|yup|ok|okay|sure|confirm|confirmed|create|create it|do it|go ahead|proceed|send it|sounds good|looks good|perfect|all good|that'?s right|correct)$/.test(
    t,
  );
}

/** A short negative/cancel reply to a confirmation prompt. */
function isNegative(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  return /^(n|no|nope|nah|cancel|stop|don'?t|do not|abort|discard|wait|never mind|nevermind)$/.test(
    t,
  );
}

/**
 * Detects an intent to ABANDON the current workflow ("leave it", "cancel
 * this", "let's do something else", "forget the contract", "never mind").
 * Used to gracefully exit any in-progress flow (pending question, picker, or
 * open draft) instead of re-asking. Phrased to avoid false positives on real
 * answers — it looks for explicit drop/leave/cancel language.
 */
function isAbandonFlow(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  if (/^(cancel|stop|abort|forget it|never ?mind|leave it|drop it|exit|quit)$/.test(t)) {
    return true;
  }
  return /\b(leave|drop|cancel|forget|skip|abandon|stop)\b.*\b(this|that|the (invoice|contract|proposal|client|project|welcome|document|doc|time)|it)\b/.test(
    t,
  ) ||
    /\b(do|try|create|make|something) (something )?(else|different|other)\b/.test(t) ||
    /\b(let'?s|lets|i want to|can we|how about we) (do|try) something else\b/.test(t) ||
    /\bnever ?mind\b|\bforget (it|the|this|that)\b/.test(t);
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

function ProjectPicker({
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
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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

function StatePicker({
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
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
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

function WelcomeTemplatePicker({
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

export function StackivoAiAssistant({ clients, projects }: StackivoAiAssistantProps) {
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
  // Last created invoice / welcome doc kept open for in-panel refinement, so a
  // follow-up like "set amount to 60000" revises it instead of starting over.
  const [activeInvoice, setActiveInvoice] = React.useState<AiInvoicePreview | null>(null);
  const [activeWelcomeDoc, setActiveWelcomeDoc] =
    React.useState<AiWelcomeDocPreview | null>(null);
  // When a confirmation summary is showing, a typed "yes"/"confirm"/"cancel"
  // acts on it (in addition to the buttons).
  const [pendingConfirm, setPendingConfirm] = React.useState<null | {
    workflow: AiMode;
    fields: AiFields;
    cId: string;
    pId: string;
  }>(null);
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
  // Plain-text transcript of the conversation (string turns only) so the model
  // has memory for corrections, references, and follow-up questions.
  const transcriptRef = React.useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  // Mirror of pendingConfirm read inside the submit handler without stale closures.
  const pendingConfirmRef = React.useRef<typeof pendingConfirm>(null);
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

  const handleNewConversation = React.useCallback(() => {
    setMode("general");
    setCollected({});
    setPendingField(null);
    setInput("");
    setClientId("");
    setProjectId("");
    setLastInvoicePreview(null);
    setActiveContract(null);
    setActiveInvoice(null);
    setActiveWelcomeDoc(null);
    setPendingConfirm(null);
    transcriptRef.current = [];
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
    pendingConfirmRef.current = pendingConfirm;
  }, [pendingConfirm]);

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
    // Record textual turns (skip JSX previews/pickers) as conversation memory.
    if (typeof message.content === "string") {
      transcriptRef.current = [
        ...transcriptRef.current,
        { role: message.role, content: message.content },
      ].slice(-12);
    }
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

  const handleSaveWelcomeTemplate = React.useCallback(
    (preview: AiWelcomeDocPreview) => {
      push({ role: "user", content: "Save as a template" });
      startTransition(async () => {
        const res = await saveAsTemplateAction({
          id: preview.id,
          templateTitle: preview.title || "Welcome template",
        });
        push({
          role: "assistant",
          content: res.ok
            ? "Saved as a reusable template — you'll see it next time you create a welcome document."
            : res.error || "Could not save the template.",
        });
      });
    },
    [push],
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
      const docs = await answerFromDocsAction({
        question: text,
        history: transcriptRef.current.slice(0, -1),
      });
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
        // Remember the pending creation so a typed "yes"/"cancel" works too.
        setPendingConfirm({ workflow, fields, cId, pId });
        push({
          role: "assistant",
          content: (
            <ConfirmBlock
              summary={summary}
              onConfirm={() => {
                setPendingConfirm(null);
                push({ role: "user", content: "Confirm" });
                startTransition(async () => {
                  await runWorkflowRef.current(workflow, fields, cId, pId, "", true);
                });
              }}
              onCancel={() => {
                setPendingConfirm(null);
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
          const allowSkip = workflow === "project" || workflow === "welcome_document";
          const proceed = (id: string, display: string) => {
            // Persist the choice — including the "no client" sentinel — so the
            // next message keeps it and the workflow doesn't re-ask.
            setClientId(id);
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
        } else if (missing.field === "projectId") {
          const label = missing.question || "Which project should I log this time against?";
          // Show projects for the chosen client when one is set, else all.
          const options = cId ? projects.filter((p) => p.clientId === cId) : projects;
          const proceed = (id: string, display: string) => {
            // Persist the choice — including the "no project" sentinel — so the
            // next message keeps it and the workflow doesn't re-ask.
            setProjectId(id);
            setPendingField(null);
            push({ role: "user", content: display });
            startTransition(async () => {
              await runWorkflowRef.current(workflow, fields, cId, id, "");
            });
          };
          push({
            role: "assistant",
            content: (
              <ProjectPicker
                projects={options}
                label={label}
                allowSkip
                onSelect={(id) =>
                  proceed(id, projects.find((p) => p.id === id)?.name ?? "Selected project")
                }
                onSkip={() => proceed(NO_PROJECT_SENTINEL, "No project (internal)")}
              />
            ),
          });
        } else if (missing.field === "state") {
          const label = missing.question || "Which state are they in?";
          const proceed = (stateName: string) => {
            setPendingField(null);
            const nextFields = { ...fields, state: stateName };
            setCollected(nextFields);
            push({ role: "user", content: stateName });
            startTransition(async () => {
              await runWorkflowRef.current(workflow, nextFields, cId, pId, "");
            });
          };
          push({
            role: "assistant",
            content: <StatePicker label={label} onSelect={proceed} />,
          });
        } else if (missing.field === "welcomeTemplate") {
          const proceed = (templateId: string, display: string) => {
            setPendingField(null);
            const nextFields = { ...fields, welcomeTemplate: templateId };
            setCollected(nextFields);
            push({ role: "user", content: display });
            startTransition(async () => {
              await runWorkflowRef.current(workflow, nextFields, cId, pId, "");
            });
          };
          push({
            role: "assistant",
            content: <WelcomeTemplatePicker onSelect={proceed} />,
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
            suggestions: missing.optional
              ? [...(missing.suggestions ?? []), "Skip"]
              : missing.suggestions,
            tip: missing.tip,
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
        setActiveInvoice(null);
        setActiveWelcomeDoc(null);
        setPendingConfirm(null);
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
          // Keep the draft open for in-panel refinement (e.g. "set amount to 60000").
          setActiveInvoice(preview);
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
          // Keep the draft open for in-panel refinement.
          setActiveWelcomeDoc(res.data);
          push({
            role: "assistant",
            content: (
              <WelcomeDocDraftPreview
                preview={res.data}
                onApprove={handleWelcomeDocApprove}
                onOpen={() => router.push(`/dashboard/welcome/${res.data.id}`)}
                onSaveTemplate={handleSaveWelcomeTemplate}
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
      handleSaveWelcomeTemplate,
      projects,
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
      setActiveInvoice(null);
      setActiveWelcomeDoc(null);
      setPendingConfirm(null);
      push({ role: "assistant", content: <span className="block">{modeIntro(nextMode)}</span> });
      // Proactively start the walkthrough by asking the first required field,
      // so picking a workflow doesn't leave the user at a blank prompt with no
      // follow-up. (Support/general are free-form, so they wait for input.)
      if (nextMode !== "general" && nextMode !== "support") {
        startTransition(async () => {
          await runWorkflowRef.current(nextMode, {}, "", "", "");
        });
      }
    },
    [push],
  );

  // Keyword fallback intent detection (used only when the NLU is unavailable).
  const detectMode = React.useCallback(
    (text: string): AiMode => {
      const t = text.toLowerCase();
      const action = /\b(create|make|draft|add|new|start|log|raise|generate|send|prepare|build|issue|set ?up)\b/.test(t);
      const keyword: AiMode | null =
        /invoice|bill\s|billing|receipt|charge/.test(t) ? "invoice"
        : /contract|agreement|proposal|nda|retainer/.test(t) ? "contract"
        : /welcome|onboard|kickoff/.test(t) ? "welcome_document"
        : /\bproject\b/.test(t) ? "project"
        : /\bclient\b|\bcustomer\b|\bcontact\b/.test(t) ? "client"
        : /\btime\b|\bhours?\b|\bminutes?\b|\blog\b|\bbillable\b/.test(t) ? "time_entry"
        : null;
      // A clear command ("help me create a contract") starts that workflow even
      // though it contains "help".
      if (keyword && action) return keyword;
      // Questions and help/pricing topics are answered from docs, not drafted.
      if (isInformationalQuestion(text)) return "support";
      if (/support|bug|issue|help|how do|how to|what is|privacy|terms|pricing|price|\bplans?\b|refund|upgrade|subscription/.test(t)) return "support";
      if (keyword) return keyword;
      return mode;
    },
    [mode],
  );

  // ----- Submit handler -----

  const handleSubmit = React.useCallback((override?: string) => {
    const text = (override ?? input).trim();
    if (!text || pending) return;
    setInput("");
    push({ role: "user", content: text });

    // A confirmation summary is showing — let a typed "yes"/"create"/"cancel"
    // act on it, just like the buttons.
    const pc = pendingConfirmRef.current;
    if (pc) {
      if (isAffirmative(text)) {
        setPendingConfirm(null);
        startTransition(async () => {
          await runWorkflowRef.current(pc.workflow, pc.fields, pc.cId, pc.pId, "", true);
        });
        return;
      }
      if (isNegative(text)) {
        setPendingConfirm(null);
        setMode("general");
        setCollected({});
        setPendingField(null);
        setClientId("");
        setProjectId("");
        push({ role: "assistant", content: "No problem — cancelled. What next?" });
        return;
      }
      // Otherwise treat it as an edit/new input and re-interpret normally.
      setPendingConfirm(null);
    }

    // The user wants to abandon whatever is in progress ("leave it", "cancel
    // this", "let's do something else"). Reset cleanly to the home screen and
    // wait for their next instruction — works for ANY workflow, pending
    // question, picker, or open draft.
    const inProgress =
      mode !== "general" ||
      !!pendingField ||
      !!activeContract ||
      !!activeInvoice ||
      !!activeWelcomeDoc;
    if (inProgress && isAbandonFlow(text)) {
      setMode("general");
      setCollected({});
      setPendingField(null);
      setClientId("");
      setProjectId("");
      setActiveContract(null);
      setActiveInvoice(null);
      setActiveWelcomeDoc(null);
      setPendingConfirm(null);
      push({
        role: "assistant",
        content: "Sure — I've set that aside. What would you like to do next?",
      });
      return;
    }

    // Local short-circuits — handle these WITHOUT a Groq call to save tokens
    // and latency. Only applies mid-flow (a field is pending), where the reply
    // is unambiguous:
    //   • "skip" on an optional field → record the skip and continue.
    //   • a greeting / thanks / meta remark → reply conversationally + re-ask.
    if (pendingField && pendingField.field !== "clientId") {
      if (pendingField.optional && isSkipReply(text)) {
        const merged = { ...collected, [pendingField.field]: AI_SKIP_SENTINEL };
        setCollected(merged);
        setPendingField(null);
        startTransition(async () => {
          await runWorkflowRef.current(mode, merged, clientId, projectId, "");
        });
        return;
      }
      const chat = conversationalReply(text);
      if (chat) {
        push({ role: "assistant", content: chat });
        push({
          role: "assistant",
          content: (
            <>
              <span className="block">{pendingField.question}</span>
              {pendingField.placeholder ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {pendingField.placeholder}
                </span>
              ) : null}
              {pendingField.optional ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  Optional — reply “skip” to leave it out.
                </span>
              ) : null}
            </>
          ),
          suggestions: pendingField.optional
            ? [...(pendingField.suggestions ?? []), "Skip"]
            : pendingField.suggestions,
          tip: pendingField.tip,
        });
        return;
      }
    }

    startTransition(async () => {
      // 1. Interpret the message (intent + structured fields + resolved ids).
      const interpreted = await interpretAiMessageAction({
        message: text,
        currentWorkflow: mode === "general" ? undefined : mode,
        collected,
        history: transcriptRef.current.slice(0, -1),
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

      // 1c. If an invoice draft is open, revise it in place from the message —
      // unless the user is clearly starting a new invoice or switching workflow.
      if (activeInvoice) {
        const chat = conversationalReply(text);
        if (chat) { push({ role: "assistant", content: chat }); return; }
        const switchingAway =
          !!nlu?.confident && nlu.intent !== "general" && nlu.intent !== "invoice";
        const startsNew =
          /\b(create|draft|make|generate|raise|new|another)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(invoice|bill)\b/i.test(text) ||
          /\b(new|another|second|separate|different)\s+invoice\b/i.test(text);
        if (!switchingAway && !startsNew) {
          const res = await refineInvoiceFromAiAction({
            invoiceId: activeInvoice.id,
            instruction: text,
          });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          setActiveInvoice(res.data);
          setLastInvoicePreview(res.data);
          push({
            role: "assistant",
            content: (
              <InvoiceDraftPreview
                preview={res.data}
                onApprove={handleInvoiceApprove}
                onOpen={() => router.push(`/dashboard/invoices/${res.data.id}`)}
              />
            ),
          });
          router.refresh();
          return;
        }
        setActiveInvoice(null);
      }

      // 1d. If a welcome doc draft is open, revise it in place from the message.
      if (activeWelcomeDoc) {
        const chat = conversationalReply(text);
        if (chat) { push({ role: "assistant", content: chat }); return; }
        const switchingAway =
          !!nlu?.confident && nlu.intent !== "general" && nlu.intent !== "welcome_document";
        const startsNew =
          /\b(create|draft|make|generate|prepare|new|another)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(welcome|onboarding)\b/i.test(text) ||
          /\b(new|another)\s+(welcome|onboarding)\b/i.test(text);
        if (!switchingAway && !startsNew) {
          const res = await refineWelcomeDocFromAiAction({
            welcomeDocId: activeWelcomeDoc.id,
            instruction: text,
          });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          setActiveWelcomeDoc(res.data);
          push({
            role: "assistant",
            content: (
              <WelcomeDocDraftPreview
                preview={res.data}
                onApprove={handleWelcomeDocApprove}
                onOpen={() => router.push(`/dashboard/welcome/${res.data.id}`)}
                onSaveTemplate={handleSaveWelcomeTemplate}
              />
            ),
          });
          router.refresh();
          return;
        }
        setActiveWelcomeDoc(null);
      }

      // 1e. Mid-question chit-chat guard. If we're waiting on a specific field
      // and the user types a greeting / thanks / meta remark (not an answer and
      // not a confident switch to another task), reply conversationally and
      // re-ask the SAME question — instead of saving "thanks" as the amount.
      if (
        pendingField &&
        !(nlu?.confident && nlu.intent !== "general" && nlu.intent !== mode)
      ) {
        const chat = conversationalReply(text);
        if (chat) {
          push({ role: "assistant", content: chat });
          push({
            role: "assistant",
            content: (
              <>
                <span className="block">{pendingField.question}</span>
                {pendingField.placeholder ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {pendingField.placeholder}
                  </span>
                ) : null}
                {pendingField.optional ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Optional — reply “skip” to leave it out.
                  </span>
                ) : null}
              </>
            ),
            suggestions: pendingField.optional
              ? [...(pendingField.suggestions ?? []), "Skip"]
              : pendingField.suggestions,
            tip: pendingField.tip,
          });
          return;
        }
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
        // While we're waiting on a specific field answer, the message is an
        // ANSWER, not a command — so don't let an incidental keyword in it
        // (e.g. answering "What work did you do?" with "client call") switch
        // workflows. Only an explicit command ("actually create an invoice")
        // is allowed to switch mid-question.
        const explicitSwitchCommand =
          /\b(create|make|draft|add|new|start|log|raise|generate|prepare|switch to|instead)\b/.test(
            text.toLowerCase(),
          );
        const isSwitch =
          nlu.confident &&
          intent !== "general" &&
          intent !== mode &&
          (!pendingField || pendingField.field === "clientId" || explicitSwitchCommand);
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

      // 2b. Validate a direct answer to a pending field before saving it. If the
      // reply clearly can't fill that field (e.g. text for an amount) and the
      // NLU didn't extract a clean value either, gently re-ask with an example
      // rather than storing nonsense. Optional "skip" always passes.
      if (
        !switching &&
        pendingField &&
        pendingField.field !== "clientId" &&
        !(pendingField.optional && isSkipReply(text)) &&
        !nlu?.fields?.[pendingField.field]
      ) {
        const validationError = fieldValidationError(pendingField.field, text);
        if (validationError) {
          push({ role: "assistant", content: validationError });
          push({
            role: "assistant",
            content: (
              <>
                <span className="block">{pendingField.question}</span>
                {pendingField.placeholder ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {pendingField.placeholder}
                  </span>
                ) : null}
              </>
            ),
            suggestions: pendingField.optional
              ? [...(pendingField.suggestions ?? []), "Skip"]
              : pendingField.suggestions,
            tip: pendingField.tip,
          });
          return;
        }
      }

      // 3. Merge newly extracted fields onto what we already collected.
      const baseFields: AiFields = switching ? {} : { ...collected };
      let merged: AiFields;
      if (!switching && pendingField && pendingField.field !== "clientId") {
        // Direct reply to a specific field prompt: assign the answer to THAT
        // field only and skip generic NLU extraction. Otherwise a numeric reply
        // (e.g. a discount or due-date answer like "345") gets re-read as the
        // invoice amount and clobbers an earlier answer. An optional "skip" is
        // recorded as a sentinel so the field counts as addressed without
        // inventing a value. When the NLU normalised THIS field (e.g. an amount
        // or an ISO date), prefer that clean value over the raw text.
        merged = { ...baseFields };
        const normalized = nlu?.fields?.[pendingField.field]?.trim();
        merged[pendingField.field] =
          pendingField.optional && isSkipReply(text)
            ? AI_SKIP_SENTINEL
            : normalized || text;
      } else {
        merged = { ...baseFields, ...(nlu?.fields ?? {}) };
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
    activeInvoice,
    activeWelcomeDoc,
    handleContractApproveAndSend,
    handleContractWhatsApp,
    handleInvoiceApprove,
    handleWelcomeDocApprove,
    handleSaveWelcomeTemplate,
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
          <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
              <StackivoMark className="h-6 w-6 shrink-0" bare />
              <span className="truncate">
                {mode === "general"
                  ? "New conversation"
                  : QUICK_ACTIONS.find((a) => a.mode === mode)?.title ?? "New conversation"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="What can I do?"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Start a workflow</DropdownMenuLabel>
                  {QUICK_ACTIONS.map((action) => (
                    <DropdownMenuItem
                      key={action.mode}
                      onSelect={() => selectMode(action.mode)}
                      className="gap-2"
                    >
                      <action.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {action.title}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleNewConversation} className="gap-2">
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    New conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
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
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                    Stackivo AI
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">What are we doing today?</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Pick a workflow below, or just describe what you need.
                  </p>
                </div>

                {/* Compact, container-based grid so 7 items lay out cleanly at
                    any panel width (the panel is portaled, so viewport `md:`
                    breakpoints don't reflect its real width). */}
                <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.mode}
                      type="button"
                      onClick={() => selectMode(action.mode)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border bg-background/95 p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/5",
                        mode === action.mode && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
                      )}
                      title={action.description}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 text-sm font-medium leading-tight">
                        {action.title}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Message bubbles */}
            {messages.map((message, index) => {
              // Quick-reply chips appear only under the most recent assistant
              // message, so older questions don't keep stale chips around.
              const isLast = index === messages.length - 1;
              const showSuggestions =
                isLast &&
                !pending &&
                message.role === "assistant" &&
                !!message.suggestions?.length;
              return (
                <div
                  key={message.id}
                  className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}
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
                    {message.role === "assistant" && message.tip ? (
                      <span className="mt-2 flex items-start gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.04] px-2.5 py-1.5 text-xs text-muted-foreground">
                        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
                        <span>{message.tip}</span>
                      </span>
                    ) : null}
                  </div>
                  {showSuggestions ? (
                    <div className="mt-2 flex max-w-[88%] flex-wrap gap-1.5">
                      {message.suggestions!.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={pending}
                          onClick={() => handleSubmit(s)}
                          className="rounded-full border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

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
                  onClick={() => handleSubmit()}
                  disabled={pending || !input.trim()}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 space-y-1 px-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lightbulb className="h-3 w-3 shrink-0 text-primary/60" />
                Tip: use the
                <LayoutGrid className="inline h-3 w-3 shrink-0" />
                menu to switch tasks, or
                <Plus className="inline h-3 w-3 shrink-0" />
                to start a new chat.
              </p>
              <p className="text-center text-[10px] text-muted-foreground/70">
                AI can make mistakes — please review everything before approving or sending.
              </p>
            </div>
          </div>
        </div>
      ), isMobile ? document.body : (panelSlot ?? document.body)) : null}
    </>
  );
}
