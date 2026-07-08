"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Lightbulb,
  Plus,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
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
  answerBusinessQuestionAction,
  consumeAiMessageQuotaAction,
  getAiUsageAction,
  getAssistantSuggestionsAction,
  remindOverdueInvoicesFromAiAction,
  invoiceUnbilledTimeFromAiAction,
  listInvoicesForAiAction,
  markInvoicePaidFromAiAction,
  listContractsForAiAction,
  listClientsForAiAction,
  listProjectsForAiAction,
  listWelcomeDocsForAiAction,
} from "@/features/ai-workflows/global-actions";
import type { AssistantSuggestion } from "@/features/ai-workflows/suggestions";
import type {
  StackivoAiAssistantProps,
  AiMode,
  Message,
  AiInvoicePreview,
  AiContractPreview,
  AiWelcomeDocPreview,
  AiConfirmSummary,
} from "./assistant-types";
import {
  ASSISTANT_NAME,
  QUICK_ACTIONS,
  MODE_PLACEHOLDERS,
  newId,
  formatMoney,
  modeIntro,
  conversationalReply,
  isBusinessDataQuestion,
  isInformationalQuestion,
  isSkipReply,
  fieldValidationError,
  isAffirmative,
  isNegative,
  isAbandonFlow,
} from "./assistant-helpers";
import {
  ResultBlock,
  ConfirmBlock,
  InvoiceDraftPreview,
  InvoiceDeliveryActions,
  ClientPicker,
  ProjectPicker,
  StatePicker,
  WelcomeTemplatePicker,
  ContractDraftPreview,
  WelcomeDocDraftPreview,
  WelcomeDocDeliveryActions,
  InvoiceListBlock,
  ContractListBlock,
  ClientListBlock,
  ProjectListBlock,
  WelcomeDocListBlock,
} from "./assistant-previews";
import { createTicketAction } from "@/features/support/ticket-actions";
import {
  AI_SKIP_SENTINEL,
  NO_CLIENT_SENTINEL,
  NO_PROJECT_SENTINEL,
  type AiFields,
  type AiInterpretation,
  type AiMissingField,
} from "@/features/ai-workflows/types";
import { IVO_ASK_EVENT, type IvoAskDetail } from "./ivo-entry-point";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Product/docs Q&A is live. Unknown or weakly-covered questions still require
 * explicit user confirmation before creating a human support ticket.
 */
const SUPPORT_ENABLED = true;

function formatAssistantMessageContent(content: string): string {
  return content
    .replace(/\s+(\d+\.\s+)/g, "\n$1")
    .replace(/\s+([-*]\s+)/g, "\n$1")
    .replace(/([.!?])\s+(Next:|Focus:|Watch:|Tip:)/g, "$1\n$2")
    .replace(/^\n+/, "")
    .trim();
}

export function StackivoAiAssistant({ clients, projects, user }: StackivoAiAssistantProps) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [panelSlot, setPanelSlot] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [panelWidth, setPanelWidth] = React.useState(440);
  const [mode, setMode] = React.useState<AiMode>("general");
  const [input, setInput] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<AssistantSuggestion[]>([]);
  const [aiUsage, setAiUsage] = React.useState<{ used: number; limit: number; plan: string } | null>(null);
  const suggestionsLoaded = React.useRef(false);
  const submitRef = React.useRef<((text?: string) => void) | null>(null);
  const userFirstName = React.useMemo(
    () => user?.name?.trim().split(/\s+/)[0] ?? "",
    [user?.name],
  );

  // Load proactive "Today" nudges once when the panel first opens.
  React.useEffect(() => {
    if (!open || suggestionsLoaded.current) return;
    suggestionsLoaded.current = true;
    void getAssistantSuggestionsAction().then((res) => {
      if (res.ok) setSuggestions(res.data.suggestions);
    });
  }, [open]);
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
  // Empty by default — the polished hero + quick-action grid IS the greeting,
  // so we don't also push a "Good to see you" bubble (that double-rendered and
  // looked cut off behind the hero).
  const [messages, setMessages] = React.useState<Message[]>(() => []);
  // Time-of-day greeting for the empty state — small humanising touch.
  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastInvoicePreviewRef = React.useRef<AiInvoicePreview | null>(null);
  // Plain-text transcript of the conversation (string turns only) so the model
  // has memory for corrections, references, and follow-up questions.
  const transcriptRef = React.useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  // Mirror of pendingConfirm read inside the submit handler without stale closures.
  const pendingConfirmRef = React.useRef<typeof pendingConfirm>(null);
  // When a docs answer doesn't fully resolve a support question, we OFFER to
  // forward it to the human support team and hold the original question here.
  // We never file a ticket without the user saying yes.
  const pendingSupportForwardRef = React.useRef<string | null>(null);
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
    pendingSupportForwardRef.current = null;
    transcriptRef.current = [];
    setMessages([]);
  }, []);

  React.useEffect(() => { setMounted(true); }, []);

  // Refresh the AI usage indicator each time the panel opens.
  React.useEffect(() => {
    if (!open) return;
    let active = true;
    getAiUsageAction().then((u) => {
      if (active) setAiUsage(u);
    });
    return () => {
      active = false;
    };
  }, [open]);

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
      if (messages.length > 0 || pending) {
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
        // Merge the fresh, server-read invoice (reflects any edits) over the
        // in-memory preview so the delivery card shows the CORRECT total.
        const fresh: AiInvoicePreview = {
          ...preview,
          status: "sent",
          ...(res.data
            ? {
                invoiceNumber: res.data.invoiceNumber,
                totalAmount: res.data.totalAmount,
                currency: res.data.currency,
                dueDate: res.data.dueDate,
                clientName: res.data.clientName ?? preview.clientName,
                clientEmail: res.data.clientEmail ?? preview.clientEmail,
                clientPhone: res.data.clientPhone ?? preview.clientPhone,
              }
            : {}),
        };
        push({
          role: "assistant",
          content: (
            <InvoiceDeliveryActions
              preview={fresh}
              onDeliver={handleInvoiceDelivery}
              onOpen={() => router.push(`/dashboard/invoices/${preview.id}`)}
            />
          ),
        });
        setLastInvoicePreview(fresh);
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
  //
  // Answers product/docs questions directly. If the docs are not enough, Ivo
  // offers to forward the issue to support, but never files a ticket silently.
  const runSupport = React.useCallback(
    async (text: string, fileTicket: boolean) => {
      if (!SUPPORT_ENABLED) {
        push({
          role: "assistant",
          content:
            "For product help or questions, email support@stackivo.me or use the chat bubble in the bottom-right — the team will get back to you. Meanwhile, I can help you create invoices, contracts, welcome docs, clients, projects, and time logs.",
        });
        return;
      }
      // Greetings and meta questions ("hi", "can I ask you a question") get a
      // natural reply instead of an empty docs lookup.
      const chat = conversationalReply(text, userFirstName);
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

      push({ role: "assistant", content: answer });
      // If the docs didn't confidently cover it, OFFER to forward to the human
      // support team — never file a ticket silently.
      if (fileTicket && !usedDocs) {
        pendingSupportForwardRef.current = text;
        push({
          role: "assistant",
          content:
            "If that didn't fully answer it, I can forward this to the Stackivo support team so a human can follow up by email. Want me to?",
          suggestions: ["Yes, forward to support", "No thanks"],
        });
      }
    },
    [push, userFirstName],
  );

  // ----- Data-aware Q&A (answers about the user's own business numbers) -----

  const runQuery = React.useCallback(
    async (text: string) => {
      const res = await answerBusinessQuestionAction({
        question: text,
        history: transcriptRef.current.slice(0, -1),
      });
      push({
        role: "assistant",
        content: res.ok
          ? res.data.answer
          : "I couldn't pull that just now — give it a moment and try again, or open Pulse for the full picture.",
        suggestions:
          res.ok && res.data.suggestions && res.data.suggestions.length > 0
            ? res.data.suggestions
            : undefined,
      });
    },
    [push],
  );

  // ----- One-tap action: chase overdue invoices -----

  const runRemindOverdue = React.useCallback(async () => {
    push({ role: "assistant", content: "Sending reminders…" });
    const res = await remindOverdueInvoicesFromAiAction();
    if (!res.ok) {
      push({ role: "assistant", content: res.error });
      return;
    }
    const { sent, skipped, total } = res.data;
    const summary =
      total === 0
        ? "Good news — you have no overdue invoices right now. 🎉"
        : sent > 0
          ? `Done — I emailed a payment reminder to ${sent} client${sent === 1 ? "" : "s"}.${
              skipped > 0 ? ` ${skipped} skipped (missing client email or share link).` : ""
            }`
          : `I couldn't send those — ${skipped} skipped (missing a client email or share link). Add those and try again.`;
    push({ role: "assistant", content: summary });
    router.refresh();
  }, [push, router]);

  // ----- One-tap action: invoice unbilled tracked time -----

  const runInvoiceUnbilled = React.useCallback(
    async (cId?: string, opts?: { send?: boolean }) => {
      push({ role: "assistant", content: "Pulling your unbilled time…" });
      const res = await invoiceUnbilledTimeFromAiAction({ clientId: cId });
      if (!res.ok) {
        push({ role: "assistant", content: res.error });
        return;
      }
      const d = res.data;
      const amt = formatMoney(Math.round(d.totalAmount), d.currency);
      let sentOk = false;
      if (opts?.send) {
        const sent = await emailInvoiceFromAiAction({ invoiceId: d.id });
        sentOk = sent.ok;
      }
      push({
        role: "assistant",
        content: (
          <span>
            {opts?.send && sentOk ? "Created and sent" : "Created draft"} invoice{" "}
            <strong>{d.invoiceNumber}</strong> for {d.clientName} — {amt} from {d.hours}h
            across {d.lineCount} line{d.lineCount === 1 ? "" : "s"}.
            {opts?.send && !sentOk ? " (Couldn't email it — open to send manually.)" : ""}{" "}
            <a
              href={`/dashboard/invoices/${d.id}`}
              className="font-medium text-primary underline underline-offset-2"
            >
              {opts?.send && sentOk ? "Open →" : "Open to review and send →"}
            </a>
          </span>
        ),
      });
      router.refresh();
    },
    [push, router],
  );

  const handleContractRowSend = React.useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await sendContractFromAiAction({ contractId: id });
        push({ role: "assistant", content: res.ok ? "Contract sent ✓" : res.error });
        router.refresh();
      });
    },
    [push, router],
  );

  const runListContracts = React.useCallback(
    async (filter: "pending" | "all") => {
      const res = await listContractsForAiAction({ filter });
      if (!res.ok) {
        push({ role: "assistant", content: res.error });
        return;
      }
      const { rows } = res.data;
      if (rows.length === 0) {
        push({
          role: "assistant",
          content:
            filter === "pending"
              ? "No contracts are awaiting signature."
              : "No contracts yet.",
        });
        return;
      }
      push({ role: "assistant", content: "Here are your contracts:" });
      push({
        role: "assistant",
        content: <ContractListBlock rows={rows} onSend={handleContractRowSend} />,
      });
    },
    [push, handleContractRowSend],
  );

  const runListClients = React.useCallback(async () => {
    const res = await listClientsForAiAction();
    if (!res.ok) {
      push({ role: "assistant", content: res.error });
      return;
    }
    const { rows } = res.data;
    if (rows.length === 0) {
      push({ role: "assistant", content: "You haven't added any clients yet." });
      return;
    }
    push({ role: "assistant", content: "Here are your clients:" });
    push({
      role: "assistant",
      content: (
        <ClientListBlock
          rows={rows}
          onInvoice={(name) => submitRef.current?.(`Create an invoice for ${name}`)}
        />
      ),
    });
  }, [push]);

  const runListProjects = React.useCallback(
    async (filter: "active" | "all") => {
      const res = await listProjectsForAiAction({ filter });
      if (!res.ok) {
        push({ role: "assistant", content: res.error });
        return;
      }
      const { rows } = res.data;
      if (rows.length === 0) {
        push({
          role: "assistant",
          content:
            filter === "active"
              ? "No active projects yet. I can help you create one when you're ready."
              : "No projects yet. I can help you create your first one.",
          suggestions: ["Help me create a project"],
        });
        return;
      }
      push({
        role: "assistant",
        content: `Here ${rows.length === 1 ? "is" : "are"} your ${
          filter === "active" ? "active " : ""
        }project${rows.length === 1 ? "" : "s"}:`,
      });
      push({
        role: "assistant",
        content: (
          <ProjectListBlock
            rows={rows}
            onInvoice={(name) => submitRef.current?.(`Create an invoice for project ${name}`)}
          />
        ),
      });
    },
    [push],
  );

  const runListWelcomeDocs = React.useCallback(
    async (filter: "open" | "all") => {
      const res = await listWelcomeDocsForAiAction({ filter });
      if (!res.ok) {
        push({ role: "assistant", content: res.error });
        return;
      }
      const { rows } = res.data;
      if (rows.length === 0) {
        push({
          role: "assistant",
          content:
            filter === "open"
              ? "No active welcome documents yet. I can help you prepare one for a client."
              : "No welcome documents yet. I can help you draft the first one.",
          suggestions: ["Help me prepare a welcome document"],
        });
        return;
      }
      const needsAttention = rows.filter(
        (r) => r.status === "draft" || (r.status === "published" && !r.sentAt),
      ).length;
      push({
        role: "assistant",
        content:
          needsAttention > 0
            ? `Here are your welcome documents. ${needsAttention} need attention before they are fully sent.`
            : "Here are your welcome documents. Nothing obvious needs attention right now.",
      });
      push({
        role: "assistant",
        content: (
          <WelcomeDocListBlock
            rows={rows}
            onCreate={() => submitRef.current?.("Help me prepare a welcome document for a client")}
          />
        ),
      });
    },
    [push],
  );

  // ----- Interactive invoice list (Open / Mark paid / Remind per row) -----

  const handleRowMarkPaid = React.useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await markInvoicePaidFromAiAction({ invoiceId: id });
        push({
          role: "assistant",
          content: res.ok ? "Marked paid ✓" : res.error,
        });
        router.refresh();
      });
    },
    [push, router],
  );

  const handleRowRemind = React.useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await emailInvoiceFromAiAction({ invoiceId: id });
        push({
          role: "assistant",
          content: res.ok ? "Reminder sent ✓" : res.error || "Couldn't send that reminder.",
        });
        router.refresh();
      });
    },
    [push, router],
  );

  const runListInvoices = React.useCallback(
    async (filter: "unpaid" | "overdue" | "all") => {
      const res = await listInvoicesForAiAction({ filter });
      if (!res.ok) {
        push({ role: "assistant", content: res.error });
        return;
      }
      const { rows } = res.data;
      if (rows.length === 0) {
        push({
          role: "assistant",
          content:
            filter === "overdue"
              ? "No overdue invoices — you're all caught up. 🎉"
              : filter === "all"
                ? "No invoices yet."
                : "No unpaid invoices right now.",
        });
        return;
      }
      push({
        role: "assistant",
        content: `Here ${rows.length === 1 ? "is" : "are"} your ${
          filter === "all" ? "" : filter + " "
        }invoice${rows.length === 1 ? "" : "s"}:`,
      });
      push({
        role: "assistant",
        content: (
          <InvoiceListBlock
            rows={rows}
            onMarkPaid={handleRowMarkPaid}
            onRemind={handleRowRemind}
          />
        ),
      });
    },
    [push, handleRowMarkPaid, handleRowRemind],
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

    // Resolve an outstanding "forward this to support?" offer before anything
    // else, so a yes/no acts on it instead of being re-interpreted.
    const fwd = pendingSupportForwardRef.current;
    if (fwd) {
      const lc = text.trim().toLowerCase().replace(/[!.]+$/g, "");
      if (/^(yes,? forward to support|yes|forward( it)?|please( do)?|go ahead|yep|yeah|sure|do it)$/.test(lc)) {
        pendingSupportForwardRef.current = null;
        startTransition(async () => {
          const ticket = await createTicketAction({
            category: "how-to",
            subject: fwd.slice(0, 180),
            message: fwd,
            channel: "chat",
            page: typeof window !== "undefined" ? window.location.pathname : undefined,
          });
          push({
            role: "assistant",
            content: ticket.ok
              ? "Done — I've forwarded this to the Stackivo support team. They'll follow up by email. Anything else?"
              : "I couldn't reach support just now — please email support@stackivo.me and the team will help.",
          });
        });
        return;
      }
      if (/^(no,? thanks?|no|nope|nah|not now|it'?s ok|i'?m good|that'?s ok|all good)$/.test(lc)) {
        pendingSupportForwardRef.current = null;
        push({ role: "assistant", content: "No problem — I won't forward it. Anything else I can help with?" });
        return;
      }
      // Anything else: drop the offer and interpret the message normally.
      pendingSupportForwardRef.current = null;
    }

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

    // A bare "yes"/"no" with nothing in progress would otherwise fall through to
    // the docs/support path and dead-end. Answer helpfully with next-step options.
    if (
      mode === "general" &&
      !pendingField &&
      !pendingConfirmRef.current &&
      !activeContract &&
      !activeInvoice &&
      !activeWelcomeDoc &&
      (isAffirmative(text) || isNegative(text))
    ) {
      push({
        role: "assistant",
        content: isAffirmative(text)
          ? "Happy to help — what would you like to do?"
          : "No problem. What would you like to do next?",
        suggestions: ["Create an invoice", "Draft a contract", "Who owes me money?"],
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
      const chat = conversationalReply(text, userFirstName);
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
      // 0. Monthly AI-message quota (per plan). Counts once per answered
      //    message; over the cap we stop before any model call and nudge upgrade.
      const quota = await consumeAiMessageQuotaAction();
      if (!quota.ok) {
        const nextTier =
          quota.plan === "free"
            ? "Upgrade to Pro for 100 messages a month."
            : quota.plan === "pro"
              ? "Upgrade to Business for 500 messages a month."
              : "Email support@stackivo.me if you need a higher limit.";
        setAiUsage((u) => (u && u.limit >= 0 ? { ...u, used: u.limit } : u));
        push({
          role: "assistant",
          content: `You've used all ${quota.limit} AI messages included in your ${quota.plan} plan this month. ${nextTier} Your quota resets at the start of next month.`,
        });
        return;
      }
      setAiUsage((u) => (u && u.limit >= 0 ? { ...u, used: u.used + 1 } : u));

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
        const chat = conversationalReply(text, userFirstName);
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
        const chat = conversationalReply(text, userFirstName);
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
        const chat = conversationalReply(text, userFirstName);
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
        const chat = conversationalReply(text, userFirstName);
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

      // 1b2. Bulk action: chase overdue invoices. Detected before the data-query
      //      short-circuit (so "overdue" isn't read as a plain question), with a
      //      one-tap confirm because it sends outbound email.
      {
        const lc = text.trim().toLowerCase();
        if (lc === "yes, send reminders") {
          await runRemindOverdue();
          return;
        }
        if (lc === "not now" && !pendingField) {
          push({ role: "assistant", content: "No problem — I'm here when you need." });
          return;
        }
        if (
          /\b(send|chase|remind)\b/.test(lc) &&
          /(reminder|overdue|unpaid|outstanding|past[- ]?due)/.test(lc) &&
          /(overdue|unpaid|outstanding|past[- ]?due|reminder)/.test(lc) &&
          !pendingField
        ) {
          push({
            role: "assistant",
            content:
              "Want me to email a payment reminder to every client with an overdue invoice? (Safe to run once a day — it won't double-send.)",
            suggestions: ["Yes, send reminders", "Not now"],
          });
          return;
        }
      }

      // 1b3. Bill unbilled tracked time into a draft invoice.
      {
        const lc = text.trim().toLowerCase();
        if (/unbilled/.test(lc) && /\b(invoice|bill)\b/.test(lc) && !pendingField) {
          await runInvoiceUnbilled(nlu?.clientId, { send: /\bsend\b/.test(lc) });
          return;
        }
      }

      // 1b4. Interactive invoice list ("show my overdue/unpaid invoices") with
      //      per-row Open / Mark paid / Remind actions.
      {
        const lc = text.trim().toLowerCase();
        if (/\b(show|list|view|see)\b/.test(lc) && /\binvoices?\b/.test(lc) && !pendingField) {
          const f: "unpaid" | "overdue" | "all" = /overdue/.test(lc)
            ? "overdue"
            : /\ball\b/.test(lc)
              ? "all"
              : "unpaid";
          await runListInvoices(f);
          return;
        }
        if (/\b(show|list|view|see)\b/.test(lc) && /\b(contracts?|proposals?)\b/.test(lc) && !pendingField) {
          await runListContracts(/\b(all|every)\b/.test(lc) ? "all" : "pending");
          return;
        }
        if (/\b(show|list|view|see)\b/.test(lc) && /\b(clients?|customers?)\b/.test(lc) && !pendingField) {
          await runListClients();
          return;
        }
        if (
          /\b(show|list|view|see|review)\b/.test(lc) &&
          /\b(projects?|engagements?|work)\b/.test(lc) &&
          !pendingField
        ) {
          await runListProjects(/\b(all|every|completed|archived|cancelled)\b/.test(lc) ? "all" : "active");
          return;
        }
        if (
          /\b(show|list|view|see|review|attention)\b/.test(lc) &&
          /\b(welcome|onboarding)\b/.test(lc) &&
          /\b(docs?|documents?|guides?)\b/.test(lc) &&
          !pendingField
        ) {
          await runListWelcomeDocs(/\b(all|every|archived)\b/.test(lc) ? "all" : "open");
          return;
        }
      }

      // 1c. A question about the user's OWN business numbers (revenue, overdue,
      //     who paid, unbilled, top clients…) is answered from their data, not
      //     routed into a create workflow. Skip while answering a field prompt.
      if (
        (nlu?.intent === "query" || isBusinessDataQuestion(text)) &&
        (mode === "general" || !pendingField)
      ) {
        await runQuery(text);
        return;
      }

      // 1g. A confident product/how-to/support question is answered from docs
      //     here (works from the home screen too), and if the docs don't cover
      //     it we OFFER to forward it — without entering a sticky support mode.
      if (nlu?.intent === "support" && nlu.confident && (mode === "general" || !pendingField)) {
        await runSupport(text, true);
        return;
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
          targetMode =
            intent === "support" || intent === "general" || intent === "query"
              ? "general"
              : intent;
        } else if (isSwitch && intent !== "query") {
          // "query" is a data-question intent, not a workflow mode — it is
          // short-circuited elsewhere, so never use it as a target mode.
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
    runQuery,
    runSupport,
    runRemindOverdue,
    runInvoiceUnbilled,
    runListInvoices,
    runListContracts,
    runListClients,
    runListProjects,
    runListWelcomeDocs,
    userFirstName,
  ]);

  // Keep a live ref to handleSubmit so list rows (rendered as message content)
  // can dispatch a follow-up prompt without depending on declaration order.
  submitRef.current = handleSubmit;

  React.useEffect(() => {
    const handleAskIvo = (event: Event) => {
      const detail = (event as CustomEvent<IvoAskDetail>).detail;
      const prompt = detail?.prompt?.trim();
      setOpen(true);
      if (prompt) {
        window.setTimeout(() => submitRef.current?.(prompt), 80);
      }
    };
    window.addEventListener(IVO_ASK_EVENT, handleAskIvo);
    return () => window.removeEventListener(IVO_ASK_EVENT, handleAskIvo);
  }, []);

  // ----- Render -----

  return (
    <>
      {/* Top bar trigger — desktop (hidden while the panel is open so it
          doesn't duplicate the panel's own header). */}
      {!open && (
        <div className="hidden items-center gap-1 md:flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-tour="ai-assistant"
            className="gap-1.5 text-sm font-semibold"
            onClick={() => setOpen(true)}
          >
            <Sparkles className="h-4 w-4" /> Ask Ivo
          </Button>
        </div>
      )}
      {/* Top bar trigger — mobile */}
      {!open && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(true)}
          aria-label="Ask Ivo"
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
            <div className="flex min-w-0 flex-1 items-center gap-2.5 font-semibold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-500 text-white shadow-sm shadow-primary/20">
                {(() => {
                  const HeaderIcon =
                    mode === "general"
                      ? Sparkles
                      : QUICK_ACTIONS.find((a) => a.mode === mode)?.icon ?? Sparkles;
                  return <HeaderIcon className="h-4 w-4" />;
                })()}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate">
                  {mode === "general"
                    ? ASSISTANT_NAME
                    : QUICK_ACTIONS.find((a) => a.mode === mode)?.title ?? "New conversation"}
                </span>
                {mode === "general" ? (
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    Connected to your workspace
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {aiUsage && aiUsage.limit >= 0 ? (
                <span
                  className={cn(
                    "mr-1 hidden items-center rounded-full border px-2 py-1 text-[11px] font-semibold tabular-nums sm:inline-flex",
                    aiUsage.used >= aiUsage.limit
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-primary/20 bg-primary/5 text-primary",
                  )}
                  title={`${Math.min(aiUsage.used, aiUsage.limit)}/${aiUsage.limit} AI messages this month · ${aiUsage.plan} plan`}
                >
                  {Math.min(aiUsage.used, aiUsage.limit)}/{aiUsage.limit}
                  <span className="ml-1 text-muted-foreground">AI</span>
                </span>
              ) : null}
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
            {mode === "general" && messages.length === 0 && !pending && (
              <div className="motion-safe:animate-page-enter">
                {/* Hero — animated mark + warm greeting, centered. */}
                <div className="flex flex-col items-center pb-6 pt-4 text-center">
                  <span className="relative mb-4 flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 rounded-2xl bg-primary/15 motion-safe:animate-ping [animation-duration:2.8s]" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.04))] ring-1 ring-primary/15">
                      <StackivoMark className="h-8 w-8" />
                    </span>
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/70">
                    {ASSISTANT_NAME} · Stackivo AI
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
                    {greeting}{userFirstName ? `, ${userFirstName}` : ""} — I&apos;m {ASSISTANT_NAME}
                  </h2>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    Tell me what you need in plain words. I&apos;ll help with the admin and keep the next step clear.
                  </p>
                </div>

                {/* Even 2-column grid of the six core workflows (the panel is
                    portaled, so viewport `md:` breakpoints don't reflect its real
                    width — a fixed 2-col grid stays balanced at any size). Support
                    gets its own full-width row below so nothing is left orphaned. */}
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.filter((a) => a.mode !== "support").map((action, i) => (
                    <button
                      key={action.mode}
                      type="button"
                      onClick={() => selectMode(action.mode)}
                      style={{ animationDelay: `${i * 45}ms` }}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl border bg-background/95 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm motion-safe:animate-page-enter",
                        mode === action.mode && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
                      )}
                      title={action.description}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate text-sm font-medium leading-tight">
                        {action.title}
                      </span>
                    </button>
                  ))}
                </div>

                {SUPPORT_ENABLED && QUICK_ACTIONS.filter((a) => a.mode === "support").map((action) => (
                  <button
                    key={action.mode}
                    type="button"
                    onClick={() => selectMode(action.mode)}
                    className="group mt-2 flex w-full items-center gap-2.5 rounded-xl border border-dashed bg-background/95 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                      <action.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">
                        Ask a question or get help
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Docs, billing, account — or reach the team
                      </span>
                    </span>
                  </button>
                ))}

                {suggestions.length > 0 ? (
                  <div className="mt-5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      For you today
                    </p>
                    <div className="space-y-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSubmit(s.prompt)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl border bg-background/95 p-2.5 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm",
                            s.tone === "alert" && "border-amber-500/30 bg-amber-500/[0.04]",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              s.tone === "alert" ? "bg-amber-500" : "bg-primary",
                            )}
                          />
                          <span className="min-w-0 leading-snug">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
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
                  className={cn(
                    "flex flex-col motion-safe:animate-page-enter",
                    message.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[88%] whitespace-pre-line px-4 py-3 text-sm leading-relaxed",
                      message.role === "user"
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "mr-auto rounded-2xl rounded-bl-md border border-border/70 bg-background shadow-sm",
                    )}
                  >
                    {message.role === "assistant" && typeof message.content === "string"
                      ? formatAssistantMessageContent(message.content)
                      : message.content}
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                        >
                          <Sparkles className="h-3 w-3 shrink-0 text-primary" />
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
                <div className="rounded-2xl rounded-bl-md border border-border/70 bg-background px-4 py-3 shadow-sm">
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
            <div className="flex items-end gap-2 rounded-2xl border bg-background py-2 pl-3.5 pr-2 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15">
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
                  (mode === "general" ? `Message ${ASSISTANT_NAME}…` : "Type your answer…")
                }
                rows={1}
                className="max-h-[140px] min-h-[24px] flex-1 resize-none border-0 bg-transparent p-0 py-1.5 text-sm leading-relaxed shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => handleSubmit()}
                disabled={pending || !input.trim()}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 space-y-1 px-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lightbulb className="h-3 w-3 shrink-0 text-primary/60" />
                Tip: use
                <Plus className="inline h-3 w-3 shrink-0" />
                to start fresh, or just ask Ivo to switch tasks.
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
