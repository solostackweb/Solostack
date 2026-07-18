"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Eraser,
  Lightbulb,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import {
  answerFromDocsAction,
  answerBusinessQuestionAction,
  getAiUsageAction,
  getAssistantSuggestionsAction,
  listInvoicesForAiAction,
  listContractsForAiAction,
  listClientsForAiAction,
  listProjectsForAiAction,
  listWelcomeDocsForAiAction,
} from "@/features/ai-workflows/global-actions";
import { clearIvoMemoriesAction } from "@/features/ai-workflows/memory-actions";
import type { AssistantSuggestion } from "@/features/ai-workflows/suggestions";
import type {
  StackivoAiAssistantProps,
  AiMode,
  Message,
  AiInvoicePreview,
  AiContractPreview,
  AiWelcomeDocPreview,
  AiConfirmSummary,
  AiEntityOption,
  AiInvoiceListRow,
  AiContractListRow,
  AiClientListRow,
  AiProjectListRow,
  AiWelcomeDocListRow,
} from "./assistant-types";
import {
  ASSISTANT_NAME,
  QUICK_ACTIONS,
  MODE_PLACEHOLDERS,
  newId,
  formatMoney,
  modeIntro,
  conversationalReply,
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
import {
  NO_CLIENT_SENTINEL,
  NO_PROJECT_SENTINEL,
  type AiFields,
  type AiInterpretation,
  type AiMissingField,
} from "@/features/ai-workflows/types";
import { IVO_ASK_EVENT, type IvoAskDetail } from "./ivo-entry-point";
import {
  appendIvoMessageAction,
  planIvoWorkflowProgressAction,
  processIvoMessageAction,
  resumeIvoConversationAction,
  saveIvoConversationStateAction,
  startNewIvoConversationAction,
} from "@/features/ai-workflows/conversation-actions";
import {
  approveInvoiceIvoToolAction,
  createClientIvoToolAction,
  createContractDraftIvoToolAction,
  createMeetingDraftIvoToolAction,
  createProposalDraftIvoToolAction,
  createInvoiceDraftIvoToolAction,
  createProjectIvoToolAction,
  createTimeEntryIvoToolAction,
  createUnbilledTimeInvoiceIvoToolAction,
  createWelcomeDraftIvoToolAction,
  emailContractIvoToolAction,
  emailInvoiceIvoToolAction,
  emailWelcomeDocumentIvoToolAction,
  forwardToSupportIvoToolAction,
  markInvoicePaidIvoToolAction,
  prepareContractWhatsAppIvoToolAction,
  prepareInvoiceWhatsAppIvoToolAction,
  prepareWelcomeWhatsAppIvoToolAction,
  publishWelcomeDocumentIvoToolAction,
  refineContractIvoToolAction,
  refineInvoiceIvoToolAction,
  refineWelcomeDocumentIvoToolAction,
  rejectIvoToolAction,
  remindOverdueInvoicesIvoToolAction,
  saveWelcomeTemplateIvoToolAction,
} from "@/features/ai-workflows/tool-actions";
import type {
  IvoConversationSnapshot,
  IvoPendingConfirmation,
  IvoResolvedMessageBlock,
  IvoRuntimePromptBlock,
  IvoToolResponseDescriptor,
  IvoWorkflowNextAction,
  IvoWorkflowTool,
  IvoWorkflowState,
} from "@/features/ai-workflows/conversation-types";

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

type ProcessIvoResult = Awaited<ReturnType<typeof processIvoMessageAction>>;

/**
 * Send a message through the streaming endpoint, surfacing live progress
 * ("Reading your invoices…") while the agent works. Returns null when the
 * stream is unavailable so callers can fall back to the plain server action —
 * streaming is progressive enhancement, never a hard dependency.
 */
async function processIvoMessageStreaming(
  payload: Parameters<typeof processIvoMessageAction>[0],
  onStatus: (status: string) => void,
  onDelta: (text: string) => void,
): Promise<ProcessIvoResult | null> {
  try {
    const res = await fetch("/api/ivo/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: ProcessIvoResult | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = frame.match(/^event: (.+)$/m)?.[1];
        const data = frame.match(/^data: (.+)$/m)?.[1];
        if (!event || !data) continue;
        try {
          const parsed = JSON.parse(data);
          if (event === "status" && typeof parsed?.text === "string") {
            onStatus(parsed.text);
          } else if (event === "delta" && typeof parsed?.text === "string") {
            onDelta(parsed.text);
          } else if (event === "result") {
            result = parsed as ProcessIvoResult;
          }
        } catch {
          /* skip malformed frame */
        }
      }
    }
    return result;
  } catch {
    return null;
  }
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
  const [conversationId, setConversationId] = React.useState<string | null>(null);
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
  const [pendingConfirm, setPendingConfirm] = React.useState<IvoPendingConfirmation | null>(null);
  const [pendingProposal, setPendingProposal] = React.useState<"overdue_reminders" | null>(null);
  /** Live progress line from the streaming endpoint ("Reading your invoices…"). */
  const [agentStatus, setAgentStatus] = React.useState<string | null>(null);
  /** The reply text growing token-by-token while the model writes it. */
  const [liveReply, setLiveReply] = React.useState<string>("");
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
  const pendingUnbilledClientRef = React.useRef<{
    send: boolean;
    choices: Array<{ id: string; name: string }>;
  } | null>(null);
  const runWorkflowRef = React.useRef<
    (
      workflow: AiMode,
      fields: AiFields,
      cId: string,
      pId: string,
      text: string,
      confirm?: boolean,
      toolRequestKey?: string,
      plannedAction?: IvoWorkflowNextAction,
    ) => Promise<void>
  >(async () => {});
  const resizeActiveRef = React.useRef(false);
  const resizeStartXRef = React.useRef(0);
  const resizeStartWidthRef = React.useRef(440);
  const panelWidthRef = React.useRef(440);
  const conversationIdRef = React.useRef<string | null>(null);
  const conversationLoadRef = React.useRef<Promise<IvoConversationSnapshot | null> | null>(null);
  const conversationHydratedRef = React.useRef(false);
  const conversationWriteQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const activeRunIdRef = React.useRef<string | null>(null);
  const deliveryRequestKeysRef = React.useRef<
    Map<string, { requestId: string; activeCalls: number }>
  >(new Map());

  const getDeliveryRequestKey = React.useCallback((scope: string) => {
    const existing = deliveryRequestKeysRef.current.get(scope);
    if (existing) {
      existing.activeCalls += 1;
      return existing.requestId;
    }
    const created = crypto.randomUUID();
    deliveryRequestKeysRef.current.set(scope, { requestId: created, activeCalls: 1 });
    return created;
  }, []);

  const releaseDeliveryRequestKey = React.useCallback((scope: string, requestId: string) => {
    const current = deliveryRequestKeysRef.current.get(scope);
    if (!current || current.requestId !== requestId) return;
    current.activeCalls -= 1;
    if (current.activeCalls <= 0) {
      deliveryRequestKeysRef.current.delete(scope);
    }
  }, []);

  const RESIZE_MIN = 420;
  const RESIZE_MAX = 720;

  const handleNewConversation = React.useCallback(() => {
    conversationHydratedRef.current = true;
    const priorLoad = conversationLoadRef.current;
    const priorWrites = conversationWriteQueueRef.current;
    setConversationId(null);
    conversationLoadRef.current = Promise.all([
      priorLoad?.catch(() => null) ?? Promise.resolve(null),
      priorWrites.catch(() => undefined),
    ]).then(async () => {
      conversationIdRef.current = null;
      const result = await startNewIvoConversationAction();
      if (!result.ok) {
        conversationLoadRef.current = null;
        return null;
      }
      conversationIdRef.current = result.data.id;
      setConversationId(result.data.id);
      return result.data;
    });
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
    setPendingProposal(null);
    activeRunIdRef.current = null;
    pendingSupportForwardRef.current = null;
    pendingUnbilledClientRef.current = null;
    transcriptRef.current = [];
    setMessages([]);
  }, []);

  const [clearingMemory, setClearingMemory] = React.useState(false);
  const handleClearMemory = React.useCallback(async () => {
    if (clearingMemory) return;
    const confirmed = window.confirm(
      "Reset Ivo's memory? This deletes every preference Ivo has saved. Your conversations, clients, and documents are not affected.",
    );
    if (!confirmed) return;
    setClearingMemory(true);
    const res = await clearIvoMemoriesAction();
    setClearingMemory(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.cleared > 0
        ? `Cleared ${res.cleared} saved ${res.cleared === 1 ? "memory" : "memories"}.`
        : "Ivo's memory was already empty.",
    );
  }, [clearingMemory]);

  const ensureConversation = React.useCallback(() => {
    if (conversationIdRef.current) {
      return Promise.resolve<IvoConversationSnapshot | null>(null);
    }
    if (!conversationLoadRef.current) {
      conversationLoadRef.current = resumeIvoConversationAction().then((result) => {
        if (!result.ok) {
          conversationLoadRef.current = null;
          return null;
        }
        conversationIdRef.current = result.data.id;
        setConversationId(result.data.id);
        return result.data;
      });
    }
    return conversationLoadRef.current;
  }, []);

  React.useEffect(() => { setMounted(true); }, []);

  // Restore the active textual conversation and resumable workflow state once.
  React.useEffect(() => {
    if (!open || conversationHydratedRef.current) return;
    conversationHydratedRef.current = true;
    void ensureConversation().then((snapshot) => {
      if (!snapshot || transcriptRef.current.length > 0) return;
      const restored: Message[] = snapshot.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        suggestions: message.suggestions,
        tip: message.tip,
        persistedBlock: message.block,
      }));
      const state = snapshot.state;
      const lastText = snapshot.messages.at(-1)?.content;
      if (state.pendingField && lastText !== state.pendingField.question) {
        restored.push({
          id: `resume-${snapshot.id}`,
          role: "assistant",
          content: state.pendingField.question,
        });
      }
      transcriptRef.current = snapshot.messages
        .map(({ role, content }) => ({ role, content }))
        .slice(-12);
      setMessages(restored);

      // Resume the most recently persisted entity card from canonical data.
      // Only genuine drafts become refinement targets; published/sent records
      // remain visible but cannot accidentally be edited through a stale card.
      const lastBlock = [...snapshot.messages]
        .reverse()
        .find((message) => message.block)?.block;
      if (lastBlock?.type === "entity_preview" && lastBlock.entityType === "invoice") {
        const preview = lastBlock.data as unknown as AiInvoicePreview;
        setLastInvoicePreview(preview);
        if (lastBlock.variant === "draft" && preview.status === "draft") {
          setActiveInvoice(preview);
        }
      } else if (lastBlock?.type === "entity_preview" && lastBlock.entityType === "contract") {
        const preview = lastBlock.data as unknown as AiContractPreview;
        if (lastBlock.variant === "draft" && preview.status === "draft") {
          setActiveContract(preview);
        }
      } else if (lastBlock?.type === "entity_preview" && lastBlock.entityType === "welcome_document") {
        const preview = lastBlock.data as unknown as AiWelcomeDocPreview;
        if (lastBlock.variant === "draft" && preview.status === "draft") {
          setActiveWelcomeDoc(preview);
        }
      }

      setMode(state.mode);
      setCollected(state.collected);
      setPendingField(state.pendingField);
      setPendingConfirm(state.pendingConfirmation);
      setPendingProposal(state.pendingProposal);
      setClientId(state.clientId);
      setProjectId(state.projectId);
    });
  }, [ensureConversation, open]);

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

  const lastPushRef = React.useRef<{ key: string | null; id: string; at: number }>({
    key: null,
    id: "",
    at: 0,
  });
  const push = React.useCallback((message: Omit<Message, "id">) => {
    const messageId = newId();
    const persistedContent = typeof message.content === "string"
      ? message.content
      : message.persistence?.content;

    // Drop an assistant card that is an exact repeat of the one just pushed
    // (nothing in between). A re-entrant workflow step can otherwise render the
    // same question or draft card twice. A legitimate re-ask always has the
    // user's answer between the two, so its signature differs and it survives.
    const dedupeKey =
      message.dedupeKey ??
      (message.persistence?.block
        ? `block:${JSON.stringify(message.persistence.block)}`
        : persistedContent
          ? `text:${persistedContent}`
          : null);
    if (
      message.role === "assistant" &&
      dedupeKey &&
      lastPushRef.current.key === dedupeKey &&
      Date.now() - lastPushRef.current.at < 6000
    ) {
      return lastPushRef.current.id;
    }
    lastPushRef.current = { key: dedupeKey, id: messageId, at: Date.now() };
    // Only plain text enters model conversation memory. Rich blocks persist a
    // safe entity reference and a textual fallback, not their rendered data.
    if (typeof message.content === "string") {
      transcriptRef.current = [
        ...transcriptRef.current,
        { role: message.role, content: message.content },
      ].slice(-12);
    }
    if (persistedContent) {
      // Persistence is deliberately best-effort: a temporary database problem
      // must not block the visible assistant response. The stable client id
      // makes retries safe across React transitions and double-clicks.
      const targetConversation = conversationIdRef.current
        ? Promise.resolve(conversationIdRef.current)
        : ensureConversation().then(() => conversationIdRef.current);
      conversationWriteQueueRef.current = conversationWriteQueueRef.current
        .then(async () => {
          const activeConversationId = await targetConversation;
          if (!activeConversationId) return;
          await appendIvoMessageAction({
            conversationId: activeConversationId,
            clientMessageId: messageId,
            role: message.role,
            kind: message.persistence?.kind ?? "text",
            content: persistedContent,
            suggestions: message.suggestions,
            tip: message.tip,
            block: message.persistence?.block,
          });
        })
        .catch(() => {
          // Server actions already classify/log persistence failures. Keep the
          // queue alive so one failed write cannot suppress later messages.
        });
    }
    setMessages((prev) => [...prev, { ...message, id: messageId }]);
    return messageId;
  }, [ensureConversation]);

  // Persist the minimal state required to resume a partially completed flow.
  // Rich previews are rebuilt from canonical domain records rather than being
  // serialized into the conversation table.
  React.useEffect(() => {
    if (!conversationId) return;
    const state: IvoWorkflowState = {
      version: 1,
      mode,
      collected,
      pendingField,
      pendingConfirmation: pendingConfirm,
      pendingProposal,
      clientId,
      projectId,
    };
    const timer = window.setTimeout(() => {
      void saveIvoConversationStateAction({ conversationId, state });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [clientId, collected, conversationId, mode, pendingConfirm, pendingField, pendingProposal, projectId]);

  const emailInvoiceWithIvo = React.useCallback(async (invoiceId: string, fixedRequestId?: string) => {
    await ensureConversation();
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) return { ok: false as const, error: "I couldn't start this delivery." };
    const scope = `invoice.email:${invoiceId}`;
    const requestId = fixedRequestId ?? getDeliveryRequestKey(scope);
    try {
      return await emailInvoiceIvoToolAction({
        conversationId: activeConversationId,
        runId: activeRunIdRef.current ?? undefined,
        invoiceId,
        requestId,
      });
    } finally {
      if (!fixedRequestId) releaseDeliveryRequestKey(scope, requestId);
    }
  }, [ensureConversation, getDeliveryRequestKey, releaseDeliveryRequestKey]);

  const emailContractWithIvo = React.useCallback(async (contractId: string) => {
    await ensureConversation();
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) return { ok: false as const, error: "I couldn't start this delivery." };
    const scope = `contract.email:${contractId}`;
    const requestId = getDeliveryRequestKey(scope);
    try {
      return await emailContractIvoToolAction({
        conversationId: activeConversationId,
        runId: activeRunIdRef.current ?? undefined,
        contractId,
        requestId,
      });
    } finally {
      releaseDeliveryRequestKey(scope, requestId);
    }
  }, [ensureConversation, getDeliveryRequestKey, releaseDeliveryRequestKey]);

  const emailWelcomeWithIvo = React.useCallback(async (welcomeDocId: string) => {
    await ensureConversation();
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) return { ok: false as const, error: "I couldn't start this delivery." };
    const scope = `welcome_document.email:${welcomeDocId}`;
    const requestId = getDeliveryRequestKey(scope);
    try {
      return await emailWelcomeDocumentIvoToolAction({
        conversationId: activeConversationId,
        runId: activeRunIdRef.current ?? undefined,
        welcomeDocId,
        requestId,
      });
    } finally {
      releaseDeliveryRequestKey(scope, requestId);
    }
  }, [ensureConversation, getDeliveryRequestKey, releaseDeliveryRequestKey]);

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
          const email = await emailInvoiceWithIvo(preview.id);
          if (!email.ok) { push({ role: "assistant", content: email.error }); return; }
        }
        if (channel === "whatsapp" || channel === "both") {
          await ensureConversation();
          const activeConversationId = conversationIdRef.current;
          if (!activeConversationId) {
            push({ role: "assistant", content: "I couldn't safely prepare this WhatsApp share. Please try again." });
            return;
          }
          const wa = await prepareInvoiceWhatsAppIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            invoiceId: preview.id,
          });
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
    [emailInvoiceWithIvo, ensureConversation, push, router],
  );

  const handleInvoiceApprove = React.useCallback(
    (preview: AiInvoicePreview, emitUserMessage = true) => {
      if (emitUserMessage) {
        push({ role: "user", content: `Approve ${preview.invoiceNumber}` });
      }
      startTransition(async () => {
        await ensureConversation();
        const activeConversationId = conversationIdRef.current;
        if (!activeConversationId) {
          push({ role: "assistant", content: "I couldn't start this approval. Please try again." });
          return;
        }
        const res = await approveInvoiceIvoToolAction({
          conversationId: activeConversationId,
          runId: activeRunIdRef.current ?? undefined,
          invoiceId: preview.id,
        });
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
          persistence: {
            kind: "preview",
            content: "Invoice approved and ready for delivery.",
            block: { type: "entity_preview", entityType: "invoice", entityId: fresh.id, variant: "delivery" },
          },
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
    [ensureConversation, handleInvoiceDelivery, push, router],
  );

  // ----- Welcome doc handlers -----

  const handleWelcomeDocDelivery = React.useCallback(
    (preview: AiWelcomeDocPreview, channel: "email" | "whatsapp") => {
      push({ role: "user", content: channel === "email" ? "Send by email" : "Open WhatsApp" });
      startTransition(async () => {
        if (channel === "email") {
          const res = await emailWelcomeWithIvo(preview.id);
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          push({ role: "assistant", content: "Done. Welcome document emailed to the client." });
        } else {
          await ensureConversation();
          const activeConversationId = conversationIdRef.current;
          if (!activeConversationId) {
            push({ role: "assistant", content: "I couldn't safely prepare this WhatsApp share. Please try again." });
            return;
          }
          const res = await prepareWelcomeWhatsAppIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            welcomeDocId: preview.id,
          });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          window.open(res.data.url, "_blank", "noopener,noreferrer");
          push({ role: "assistant", content: "WhatsApp is open with the welcome document link ready to send." });
        }
        router.refresh();
      });
    },
    [emailWelcomeWithIvo, ensureConversation, push, router],
  );

  const handleWelcomeDocApprove = React.useCallback(
    (preview: AiWelcomeDocPreview) => {
      push({ role: "user", content: `Approve and publish ${preview.title}` });
      startTransition(async () => {
        await ensureConversation();
        const activeConversationId = conversationIdRef.current;
        if (!activeConversationId) {
          push({ role: "assistant", content: "I couldn't start this publishing action. Please try again." });
          return;
        }
        const res = await publishWelcomeDocumentIvoToolAction({
          conversationId: activeConversationId,
          runId: activeRunIdRef.current ?? undefined,
          welcomeDocId: preview.id,
        });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        push({
          role: "assistant",
          persistence: {
            kind: "preview",
            content: "Welcome document published and ready for delivery.",
            block: { type: "entity_preview", entityType: "welcome_document", entityId: preview.id, variant: "delivery" },
          },
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
    [ensureConversation, handleWelcomeDocDelivery, push, router],
  );

  const handleSaveWelcomeTemplate = React.useCallback(
    (preview: AiWelcomeDocPreview) => {
      push({ role: "user", content: "Save as a template" });
      const scope = `welcome_document.save_template:${preview.id}`;
      const requestId = getDeliveryRequestKey(scope);
      startTransition(async () => {
        try {
          await ensureConversation();
          const activeConversationId = conversationIdRef.current;
          if (!activeConversationId) {
            push({ role: "assistant", content: "I couldn't safely save this template. Please try again." });
            return;
          }
          const res = await saveWelcomeTemplateIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            requestId,
            welcomeDocId: preview.id,
            title: preview.title || "Welcome template",
          });
          push({
            role: "assistant",
            content: res.ok
              ? "Saved as a reusable template — you'll see it next time you create a welcome document."
              : res.error || "Could not save the template.",
          });
        } finally {
          releaseDeliveryRequestKey(scope, requestId);
        }
      });
    },
    [ensureConversation, getDeliveryRequestKey, push, releaseDeliveryRequestKey],
  );

  // ----- Contract handlers -----

  const handleContractApproveAndSend = React.useCallback(
    (preview: AiContractPreview) => {
      push({ role: "user", content: `Approve and email ${preview.title}` });
      startTransition(async () => {
        const res = await emailContractWithIvo(preview.id);
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        setActiveContract(null);
        push({
          role: "assistant",
          content: `${preview.kind === "proposal" ? "Proposal" : "Contract"} sent to ${preview.clientEmail ?? "the selected client"}.`,
        });
        router.refresh();
      });
    },
    [emailContractWithIvo, push, router],
  );

  const handleContractWhatsApp = React.useCallback(
    (preview: AiContractPreview) => {
      push({ role: "user", content: `Open WhatsApp for ${preview.title}` });
      startTransition(async () => {
        await ensureConversation();
        const activeConversationId = conversationIdRef.current;
        if (!activeConversationId) {
          push({ role: "assistant", content: "I couldn't safely prepare this WhatsApp share. Please try again." });
          return;
        }
        const res = await prepareContractWhatsAppIvoToolAction({
          conversationId: activeConversationId,
          runId: activeRunIdRef.current ?? undefined,
          contractId: preview.id,
        });
        if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
        setActiveContract(null);
        window.open(res.data.url, "_blank", "noopener,noreferrer");
        push({ role: "assistant", content: `WhatsApp is open with the ${preview.kind === "proposal" ? "proposal" : "contract"} link ready to send.` });
        router.refresh();
      });
    },
    [ensureConversation, push, router],
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
    await ensureConversation();
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId) {
      push({ role: "assistant", content: "I couldn't safely start these reminders. Please try again." });
      return;
    }
    const res = await remindOverdueInvoicesIvoToolAction({
      conversationId: activeConversationId,
      runId: activeRunIdRef.current ?? undefined,
    });
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
  }, [ensureConversation, push, router]);

  // ----- One-tap action: invoice unbilled tracked time -----

  const runInvoiceUnbilled = React.useCallback(
    async (cId: string | undefined, opts: { send?: boolean; requestId: string }) => {
      push({ role: "assistant", content: "Pulling your unbilled time…" });
      await ensureConversation();
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId) {
        push({ role: "assistant", content: "I couldn't safely start this invoice. Please try again." });
        return;
      }
      const res = await createUnbilledTimeInvoiceIvoToolAction({
        conversationId: activeConversationId,
        runId: activeRunIdRef.current ?? undefined,
        requestId: opts.requestId,
        clientId: cId,
      });
      if (!res.ok) {
        if (res.clientChoices?.length) {
          pendingUnbilledClientRef.current = {
            send: Boolean(opts.send),
            choices: res.clientChoices,
          };
          push({
            role: "assistant",
            content: res.error,
            suggestions: res.clientChoices.map((choice) => choice.name),
          });
        } else {
          push({ role: "assistant", content: res.error });
        }
        return;
      }
      pendingUnbilledClientRef.current = null;
      const d = res.data;
      const amt = formatMoney(Math.round(d.totalAmount), d.currency);
      let sentOk = false;
      if (opts?.send) {
        const sent = await emailInvoiceWithIvo(d.id, opts.requestId);
        sentOk = sent.ok;
      }
      push({
        role: "assistant",
        persistence: {
          kind: "preview",
          content: `${opts?.send && sentOk ? "Created and sent" : "Created draft"} invoice ${d.invoiceNumber}.`,
          block: {
            type: "entity_preview",
            entityType: "invoice",
            entityId: d.id,
            variant: opts?.send && sentOk ? "delivery" : "draft",
          },
        },
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
    [emailInvoiceWithIvo, ensureConversation, push, router],
  );

  const handleContractRowSend = React.useCallback(
    (id: string) => {
      push({ role: "user", content: "Email contract" });
      startTransition(async () => {
        const res = await emailContractWithIvo(id);
        push({ role: "assistant", content: res.ok ? "Contract sent ✓" : res.error });
        router.refresh();
      });
    },
    [emailContractWithIvo, push, router],
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
        persistence: {
          kind: "result",
          content: "Contract list.",
          block: { type: "entity_list", entityType: "contract", entityIds: rows.map((row) => row.id) },
        },
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
      persistence: {
        kind: "result",
        content: "Client list.",
        block: { type: "entity_list", entityType: "client", entityIds: rows.map((row) => row.id) },
      },
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
        persistence: {
          kind: "result",
          content: "Project list.",
          block: { type: "entity_list", entityType: "project", entityIds: rows.map((row) => row.id) },
        },
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
        persistence: {
          kind: "result",
          content: "Welcome document list.",
          block: { type: "entity_list", entityType: "welcome_document", entityIds: rows.map((row) => row.id) },
        },
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
      push({ role: "user", content: "Mark invoice paid" });
      startTransition(async () => {
        await ensureConversation();
        const activeConversationId = conversationIdRef.current;
        if (!activeConversationId) {
          push({ role: "assistant", content: "I couldn't start this status change. Please try again." });
          return;
        }
        const res = await markInvoicePaidIvoToolAction({
          conversationId: activeConversationId,
          runId: activeRunIdRef.current ?? undefined,
          invoiceId: id,
        });
        push({
          role: "assistant",
          content: res.ok ? "Marked paid ✓" : res.error,
        });
        router.refresh();
      });
    },
    [ensureConversation, push, router],
  );

  const handleRowRemind = React.useCallback(
    (id: string) => {
      push({ role: "user", content: "Email invoice reminder" });
      startTransition(async () => {
        const res = await emailInvoiceWithIvo(id);
        push({
          role: "assistant",
          content: res.ok ? "Reminder sent ✓" : res.error || "Couldn't send that reminder.",
        });
        router.refresh();
      });
    },
    [emailInvoiceWithIvo, push, router],
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
        persistence: {
          kind: "result",
          content: "Invoice list.",
          block: { type: "entity_list", entityType: "invoice", entityIds: rows.map((row) => row.id) },
        },
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
      toolRequestKey = crypto.randomUUID(),
      plannedAction?: IvoWorkflowNextAction,
    ) => {
      let effectiveToolRequestKey = toolRequestKey;
      let sequencedTool: IvoWorkflowTool | null = null;
      const actionInput = {
        fields,
        clientId: cId || undefined,
        projectId: pId || undefined,
        prompt: text || undefined,
        confirm,
      };

      if (
        (workflow === "client" ||
          workflow === "project" ||
          workflow === "time_entry" ||
          workflow === "invoice" ||
          workflow === "contract" ||
          workflow === "welcome_document") &&
        !conversationIdRef.current
      ) {
        await ensureConversation();
      }
      // Show a pre-create summary and wait for the user to approve it.
      const showConfirm = (
        summary: AiConfirmSummary,
        response: IvoToolResponseDescriptor,
      ) => {
        const confirmationTarget =
          workflow === "client" && sequencedTool === "client.create"
            ? { workflow: "client" as const, tool: "client.create" as const }
            : workflow === "project" && sequencedTool === "project.create"
              ? { workflow: "project" as const, tool: "project.create" as const }
              : workflow === "time_entry" && sequencedTool === "time_entry.create"
                ? { workflow: "time_entry" as const, tool: "time_entry.create" as const }
                : null;
        if (!confirmationTarget) {
          push({ role: "assistant", content: "I couldn't safely prepare that confirmation." });
          return;
        }
        setPendingField(null);
        // Remember the pending creation so a typed "yes"/"cancel" works too.
        setPendingConfirm({
          ...confirmationTarget,
          fields,
          cId,
          pId,
          toolRequestKey: effectiveToolRequestKey,
          summary,
        });
        push({
          role: "assistant",
          persistence: response,
          content: (
            <ConfirmBlock
              summary={summary}
              onConfirm={() => {
                setPendingConfirm(null);
                push({ role: "user", content: "Confirm" });
                startTransition(async () => {
                  await runWorkflowRef.current(
                    workflow,
                    fields,
                    cId,
                    pId,
                    "",
                    true,
                    effectiveToolRequestKey,
                    {
                      kind: "invoke_tool",
                      tool: confirmationTarget.tool,
                      requestId: effectiveToolRequestKey,
                    },
                  );
                });
              }}
              onCancel={() => {
                setPendingConfirm(null);
                if (conversationIdRef.current) {
                  void rejectIvoToolAction({
                    conversationId: conversationIdRef.current,
                    idempotencyKey: effectiveToolRequestKey,
                  });
                }
                finish();
                push({ role: "assistant", content: "No problem — cancelled. What next?" });
              }}
            />
          ),
        });
      };

      const askMissing = (missing: AiMissingField, prompt: IvoRuntimePromptBlock) => {
        setPendingField(missing);
        if (prompt.type === "picker" && prompt.pickerType === "client") {
          const { label, allowSkip } = prompt;
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
            persistence: {
              kind: "picker",
              content: label,
              block: { type: "picker", pickerType: "client", label, allowSkip },
            },
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
        } else if (prompt.type === "picker" && prompt.pickerType === "project") {
          const { label, allowSkip } = prompt;
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
            persistence: {
              kind: "picker",
              content: label,
              block: { type: "picker", pickerType: "project", label, allowSkip },
            },
            content: (
              <ProjectPicker
                projects={options}
                label={label}
                allowSkip={allowSkip}
                onSelect={(id) =>
                  proceed(id, projects.find((p) => p.id === id)?.name ?? "Selected project")
                }
                onSkip={() => proceed(NO_PROJECT_SENTINEL, "No project (internal)")}
              />
            ),
          });
        } else if (prompt.type === "picker" && prompt.pickerType === "state") {
          const { label } = prompt;
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
            persistence: {
              kind: "picker",
              content: label,
              block: { type: "picker", pickerType: "state", label, allowSkip: false },
            },
            content: <StatePicker label={label} onSelect={proceed} />,
          });
        } else if (prompt.type === "picker" && prompt.pickerType === "welcome_template") {
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
            persistence: {
              kind: "picker",
              content: prompt.label,
              block: {
                type: "picker",
                pickerType: "welcome_template",
                label: prompt.label,
                allowSkip: prompt.allowSkip,
              },
            },
            content: <WelcomeTemplatePicker onSelect={proceed} />,
          });
        } else if (prompt.type === "question") {
          push({
            role: "assistant",
            dedupeKey: `ask:${missing.field}:${prompt.content}`,
            content: (
              <>
                <span className="block">{prompt.content}</span>
                {prompt.placeholder ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {prompt.placeholder}
                  </span>
                ) : null}
                {prompt.optional ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Optional — reply “skip” to leave it out.
                  </span>
                ) : null}
              </>
            ),
            suggestions: prompt.suggestions,
            tip: prompt.tip,
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
        setPendingProposal(null);
        activeRunIdRef.current = null;
      };

      let nextAction = plannedAction;
      if (!confirm) {
        if (
          nextAction === undefined &&
          workflow !== "general" &&
          workflow !== "support"
        ) {
          if (!conversationIdRef.current) {
            push({ role: "assistant", content: "I couldn't continue that workflow. Please try again." });
            return;
          }
          const progress = await planIvoWorkflowProgressAction({
            conversationId: conversationIdRef.current,
            workflow,
            fields,
            clientId: cId,
            projectId: pId,
          });
          if (!progress.ok) {
            push({ role: "assistant", content: progress.error });
            return;
          }
          nextAction = progress.nextAction;
        }
        if (!nextAction && (workflow === "general" || workflow === "support")) {
          nextAction = { kind: "answer_support" };
        }
        if (nextAction?.kind === "ask_field") {
          askMissing(nextAction.field, nextAction.prompt);
          return;
        }
      }

      if (nextAction?.kind === "answer_support") {
        await runSupport(text, workflow === "support");
        if (workflow === "support") finish();
        return;
      }
      if (nextAction?.kind !== "invoke_tool") {
        push({ role: "assistant", content: "I couldn't select a safe next action. Please try again." });
        return;
      }
      sequencedTool = nextAction.tool;
      effectiveToolRequestKey = nextAction.requestId;

      const toolActionInput = conversationIdRef.current
        ? {
            ...actionInput,
            conversationId: conversationIdRef.current,
            runId: activeRunIdRef.current ?? undefined,
            idempotencyKey: effectiveToolRequestKey,
          }
        : null;

      switch (sequencedTool) {
        case "invoice.draft": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this draft. Please try again." });
            return;
          }
          const res = await createInvoiceDraftIvoToolAction(toolActionInput);
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          const preview = res.data.preview;
          setLastInvoicePreview(preview);
          finish();
          // Keep the draft open for in-panel refinement (e.g. "set amount to 60000").
          setActiveInvoice(preview);
          push({
            role: "assistant",
            persistence: res.response,
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

        case "client.create": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this action. Please try again." });
            return;
          }
          const res = await createClientIvoToolAction(toolActionInput);
          if (!res.ok) {
            if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary, res.response);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          push({
            role: "assistant",
            persistence: res.response,
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

        case "project.create": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this action. Please try again." });
            return;
          }
          const res = await createProjectIvoToolAction(toolActionInput);
          if (!res.ok) {
            if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary, res.response);
            else push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          push({
            role: "assistant",
            persistence: res.response,
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

        case "proposal.create": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this proposal. Please try again." });
            return;
          }
          const res = await createProposalDraftIvoToolAction(toolActionInput);
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          const p = res.proposal;
          push({
            role: "assistant",
            content: (
              <div className="space-y-3">
                <p className="font-medium">Proposal draft created</p>
                <div className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.clientName} · {p.currency} {p.total.toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Open it to add packages, adjust pricing, and send.
                </p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => router.push(`/dashboard/proposals/${p.id}`)}
                >
                  Open proposal
                </Button>
              </div>
            ),
            suggestions: ["Create an invoice", "Draft a contract"],
          });
          router.refresh();
          return;
        }

        case "meeting.create": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't schedule that call. Please try again." });
            return;
          }
          const res = await createMeetingDraftIvoToolAction(toolActionInput);
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          const m = res.meeting;
          const shareUrl =
            typeof window !== "undefined"
              ? `${window.location.origin}/m/${m.publicToken}`
              : `/m/${m.publicToken}`;
          push({
            role: "assistant",
            content: (
              <div className="space-y-3">
                <p className="font-medium">Call scheduled</p>
                <div className="rounded-md border bg-background p-3 text-sm">
                  <p className="font-medium">{m.topic}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.clientName} · {m.durationMinutes} min
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this link so {m.clientName} can pick a time from your
                  availability:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied");
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push(`/dashboard/meetings/${m.id}`)}
                  >
                    Open meeting
                  </Button>
                </div>
              </div>
            ),
            suggestions: ["What meetings do I have coming up?"],
          });
          router.refresh();
          return;
        }

        case "contract.draft": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this draft. Please try again." });
            return;
          }
          const res = await createContractDraftIvoToolAction(toolActionInput);
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          // Proposals are their own document type — the tool created a real
          // proposal in the Proposals feature. Hand off to the builder (where
          // packages, pricing, and sending live) instead of a contract card.
          if ("kind" in res && res.kind === "proposal") {
            finish();
            const p = res.proposal;
            push({
              role: "assistant",
              content: (
                <div className="space-y-3">
                  <p className="font-medium">Proposal draft created</p>
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <p className="font-medium">{p.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.clientName} · {p.currency} {p.total.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open it to add packages, adjust pricing, and send.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => router.push(`/dashboard/proposals/${p.id}`)}
                  >
                    Open proposal
                  </Button>
                </div>
              ),
              suggestions: ["Create an invoice", "Draft a contract"],
            });
            router.refresh();
            return;
          }
          finish();
          // Keep the draft open for in-panel refinement: follow-up messages
          // revise this contract instead of starting a new workflow.
          setActiveContract(res.data);
          push({
            role: "assistant",
            persistence: res.response,
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

        case "welcome_document.draft": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this draft. Please try again." });
            return;
          }
          const res = await createWelcomeDraftIvoToolAction(toolActionInput);
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          finish();
          // Keep the draft open for in-panel refinement.
          setActiveWelcomeDoc(res.data);
          push({
            role: "assistant",
            persistence: res.response,
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

        case "time_entry.create": {
          if (!toolActionInput) {
            push({ role: "assistant", content: "I couldn't start this action. Please try again." });
            return;
          }
          const res = await createTimeEntryIvoToolAction(toolActionInput);
          if (!res.ok) {
            if ("needsConfirm" in res && res.needsConfirm) showConfirm(res.summary, res.response);
            else push({ role: "assistant", content: res.error });
            return;
          }
          const entry = res.data;
          finish();
          push({
            role: "assistant",
            persistence: res.response,
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

        default: {
          push({ role: "assistant", content: "I couldn't execute that action safely." });
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
      ensureConversation,
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
      setPendingProposal(null);
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

  // ----- Submit handler -----

  const handleSubmit = React.useCallback((override?: string) => {
    const text = (override ?? input).trim();
    if (!text || pending) return;
    setInput("");
    const userMessageId = push({ role: "user", content: text });

    // Resolve an outstanding "forward this to support?" offer before anything
    // else, so a yes/no acts on it instead of being re-interpreted.
    const fwd = pendingSupportForwardRef.current;
    if (fwd) {
      const lc = text.trim().toLowerCase().replace(/[!.]+$/g, "");
      if (/^(yes,? forward to support|yes|forward( it)?|please( do)?|go ahead|yep|yeah|sure|do it)$/.test(lc)) {
        pendingSupportForwardRef.current = null;
        startTransition(async () => {
          await ensureConversation();
          const activeConversationId = conversationIdRef.current;
          if (!activeConversationId) {
            push({ role: "assistant", content: "I couldn't safely forward this just now. Please try again." });
            return;
          }
          const ticket = await forwardToSupportIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            requestId: userMessageId,
            message: fwd,
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

    const pendingUnbilled = pendingUnbilledClientRef.current;
    if (pendingUnbilled) {
      if (isNegative(text) || isAbandonFlow(text)) {
        pendingUnbilledClientRef.current = null;
        push({ role: "assistant", content: "No problem — I won't create that invoice." });
        return;
      }
      const normalized = text.trim().toLowerCase();
      const choice = pendingUnbilled.choices.find((candidate) => {
        const name = candidate.name.trim().toLowerCase();
        return normalized === name || normalized.includes(name);
      });
      if (!choice) {
        push({
          role: "assistant",
          content: "Which client's unbilled time should I invoice?",
          suggestions: pendingUnbilled.choices.map((candidate) => candidate.name),
        });
        return;
      }
      pendingUnbilledClientRef.current = null;
      startTransition(async () => {
        await runInvoiceUnbilled(choice.id, {
          send: pendingUnbilled.send,
          requestId: userMessageId,
        });
      });
      return;
    }

    // A confirmation summary is showing — let a typed "yes"/"create"/"cancel"
    // act on it, just like the buttons.
    const pc = pendingConfirmRef.current;
    if (pc) {
      if (isAffirmative(text)) {
        setPendingConfirm(null);
        startTransition(async () => {
          await runWorkflowRef.current(
            pc.workflow,
            pc.fields,
            pc.cId,
            pc.pId,
            "",
            true,
            pc.toolRequestKey,
            { kind: "invoke_tool", tool: pc.tool, requestId: pc.toolRequestKey },
          );
        });
        return;
      }
      if (isNegative(text)) {
        setPendingConfirm(null);
        if (conversationIdRef.current) {
          void rejectIvoToolAction({
            conversationId: conversationIdRef.current,
            idempotencyKey: pc.toolRequestKey,
          });
        }
        setMode("general");
        setCollected({});
        setPendingField(null);
        setClientId("");
        setProjectId("");
        push({ role: "assistant", content: "No problem — cancelled. What next?" });
        return;
      }
      // Otherwise treat it as an edit/new input and re-interpret normally.
      if (conversationIdRef.current) {
        void rejectIvoToolAction({
          conversationId: conversationIdRef.current,
          idempotencyKey: pc.toolRequestKey,
        });
      }
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
      setPendingProposal(null);
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
      !pendingProposal &&
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

    // Small-talk fast path — greetings, thanks, "who are you", goodbyes answer
    // INSTANTLY on-device instead of paying a full server + model round-trip
    // (and an AI-quota message). Short messages only, so "hi, invoice Acme
    // 5000" still reaches the agent intact.
    if (!pendingField && text.trim().length <= 40) {
      const chat = conversationalReply(text, userFirstName);
      if (chat) {
        push({ role: "assistant", content: chat });
        return;
      }
    }

    // Local short-circuit for conversational remarks while a field is pending.
    // Field answers — including optional skips — go through the server runtime
    // so persisted state and the rendered workflow cannot disagree.
    if (pendingField && pendingField.field !== "clientId") {
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
      // The server runtime owns persistence, quota/rate policy, NLU, and the
      // durable run record. The client only renders the resulting plan.
      await ensureConversation();
      const activeConversationId = conversationIdRef.current;
      if (!activeConversationId) {
        push({ role: "assistant", content: "I couldn't start the conversation just now. Please try again." });
        return;
      }
      const payload: Parameters<typeof processIvoMessageAction>[0] = {
        conversationId: activeConversationId,
        clientMessageId: userMessageId,
        message: text,
        currentWorkflow: mode === "general" ? undefined : mode,
        pendingField: pendingField
          ? { field: pendingField.field, optional: pendingField.optional }
          : undefined,
        pendingProposal: pendingProposal ?? undefined,
        activeDraft: activeContract
          ? { entityType: "contract", entityId: activeContract.id }
          : activeInvoice
            ? { entityType: "invoice", entityId: activeInvoice.id }
            : activeWelcomeDoc
              ? { entityType: "welcome_document", entityId: activeWelcomeDoc.id }
              : undefined,
        collected,
        clientId,
        projectId,
        history: transcriptRef.current.slice(0, -1),
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      };
      // Stream-first (live progress + token streaming), server action as the
      // resilient fallback.
      const streamed = await processIvoMessageStreaming(
        payload,
        setAgentStatus,
        (delta) => setLiveReply((current) => current + delta),
      );
      setAgentStatus(null);
      setLiveReply("");
      const processed = streamed ?? (await processIvoMessageAction(payload));
      if (!processed.ok && processed.reason === "quota") {
        const nextTier =
          processed.plan === "free"
            ? "Upgrade to Pro for 100 messages a month."
            : processed.plan === "pro"
              ? "Upgrade to Business for 500 messages a month."
              : "Email support@stackivo.me if you need a higher limit.";
        setAiUsage((u) => (u && u.limit >= 0 ? { ...u, used: u.limit } : u));
        push({
          role: "assistant",
          content: `You've used all ${processed.limit} AI messages included in your ${processed.plan} plan this month. ${nextTier} Your quota resets at the start of next month.`,
        });
        return;
      }
      const usageConsumed = processed.ok
        ? processed.data.usageConsumed
        : "usageConsumed" in processed && processed.usageConsumed;
      if (usageConsumed) {
        setAiUsage((u) => (u && u.limit >= 0 ? { ...u, used: u.used + 1 } : u));
      }
      if (!processed.ok) {
        push({ role: "assistant", content: processed.error });
        return;
      }
      activeRunIdRef.current = processed.data.runId;
      const nlu: AiInterpretation = processed.data.interpretation;
      const decision = processed.data.decision;
      // The agent loop writes its own reply (`say`) and optional quick-reply
      // chips. A `reply` decision means the text IS the complete answer.
      const say = processed.data.say;
      const sayChips = processed.data.suggestions;

      if (decision.kind === "reply") {
        if (pendingProposal) setPendingProposal(null);
        push({ role: "assistant", content: say || "Okay.", suggestions: sayChips });
        return;
      }
      if (decision.kind === "overdue_reminders" && decision.action === "propose") {
        setPendingProposal("overdue_reminders");
        push({
          role: "assistant",
          content:
            say ||
            "Want me to email a payment reminder to every client with an overdue invoice? (Safe to run once a day — it won't double-send.)",
          suggestions: ["Yes, send reminders", "Not now"],
        });
        return;
      }
      if (say) {
        push({ role: "assistant", content: say, suggestions: sayChips });
      }

      if (decision.kind === "overdue_reminders") {
        if (decision.action === "execute") {
          setPendingProposal(null);
          await runRemindOverdue();
        } else if (decision.action === "dismiss") {
          setPendingProposal(null);
          push({ role: "assistant", content: "No problem — I'm here when you need." });
        } else {
          setPendingProposal("overdue_reminders");
          push({
            role: "assistant",
            content:
              "Want me to email a payment reminder to every client with an overdue invoice? (Safe to run once a day — it won't double-send.)",
            suggestions: ["Yes, send reminders", "Not now"],
          });
        }
        return;
      }
      if (decision.kind === "unbilled_invoice") {
        if (pendingProposal) setPendingProposal(null);
        await runInvoiceUnbilled(decision.clientId, {
          send: decision.send,
          requestId: userMessageId,
        });
        return;
      }
      // Any unrelated reply abandons an outstanding reminder proposal rather
      // than leaving a stale approval context active in the conversation.
      if (pendingProposal) setPendingProposal(null);

      // Read-only routing and target-workflow selection now come from the
      // authenticated server runtime instead of a second client-side router.
      if (decision.kind === "list") {
        if (decision.entityType === "invoice") await runListInvoices(decision.filter);
        else if (decision.entityType === "contract") await runListContracts(decision.filter);
        else if (decision.entityType === "client") await runListClients();
        else if (decision.entityType === "project") await runListProjects(decision.filter);
        else await runListWelcomeDocs(decision.filter);
        return;
      }
      if (decision.kind === "business_query") {
        await runQuery(text);
        return;
      }
      if (decision.kind === "support") {
        await runSupport(text, true);
        return;
      }

      // Draft ownership/status and refine-vs-new selection are server-owned.
      if (decision.kind === "refine" && decision.entityType === "contract" && activeContract) {
        const chat = conversationalReply(text, userFirstName);
        if (chat) {
          push({ role: "assistant", content: chat });
          return;
        }
          const res = await refineContractIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            contractId: activeContract.id,
            requestId: userMessageId,
            instruction: text,
          });
          if (!res.ok) {
            push({ role: "assistant", content: res.error });
            return;
          }
          setActiveContract(res.data);
          push({
            role: "assistant",
            persistence: {
              kind: "preview",
              content: "Contract draft updated and ready for review.",
              block: { type: "entity_preview", entityType: "contract", entityId: res.data.id, variant: "draft" },
            },
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

      if (decision.kind === "refine" && decision.entityType === "invoice" && activeInvoice) {
        const chat = conversationalReply(text, userFirstName);
        if (chat) { push({ role: "assistant", content: chat }); return; }
          const res = await refineInvoiceIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            invoiceId: activeInvoice.id,
            requestId: userMessageId,
            instruction: text,
          });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          setActiveInvoice(res.data);
          setLastInvoicePreview(res.data);
          push({
            role: "assistant",
            persistence: {
              kind: "preview",
              content: "Invoice draft updated and ready for review.",
              block: { type: "entity_preview", entityType: "invoice", entityId: res.data.id, variant: "draft" },
            },
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

      if (decision.kind === "refine" && decision.entityType === "welcome_document" && activeWelcomeDoc) {
        const chat = conversationalReply(text, userFirstName);
        if (chat) { push({ role: "assistant", content: chat }); return; }
          const res = await refineWelcomeDocumentIvoToolAction({
            conversationId: activeConversationId,
            runId: activeRunIdRef.current ?? undefined,
            welcomeDocId: activeWelcomeDoc.id,
            requestId: userMessageId,
            instruction: text,
          });
          if (!res.ok) { push({ role: "assistant", content: res.error }); return; }
          setActiveWelcomeDoc(res.data);
          push({
            role: "assistant",
            persistence: {
              kind: "preview",
              content: "Welcome document draft updated and ready for review.",
              block: { type: "entity_preview", entityType: "welcome_document", entityId: res.data.id, variant: "draft" },
            },
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
      if (decision.kind === "refine") {
        push({
          role: "assistant",
          content: "That draft is no longer available for refinement. Open it from the workspace to review its current status.",
        });
        return;
      }

      // A new workflow or explicit switch closes the local refinement target;
      // the server has already decided this message should not edit it.
      if (activeContract) setActiveContract(null);
      if (activeInvoice) setActiveInvoice(null);
      if (activeWelcomeDoc) setActiveWelcomeDoc(null);

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

      if (decision.kind === "field_error") {
        push({ role: "assistant", content: decision.message });
        if (pendingField) {
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
        }
        return;
      }

      if (decision.kind !== "workflow") {
        push({
          role: "assistant",
          content: "I couldn't continue that workflow safely. Please try again.",
        });
        return;
      }

      // The server returns the complete canonical state for the next workflow
      // step: validated fields plus client/project carry-over or reset.
      const { targetMode, switching, fields: merged, clientId: cId, projectId: pId } = decision;
      if (switching) setMode(targetMode);
      setCollected(merged);
      setPendingField(null);
      if (cId !== clientId) setClientId(cId);
      if (pId !== projectId) setProjectId(pId);

      await runWorkflow(
        targetMode,
        merged,
        cId,
        pId,
        text,
        false,
        decision.nextAction.kind === "invoke_tool"
          ? decision.nextAction.requestId
          : crypto.randomUUID(),
        decision.nextAction,
      );
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
    pendingProposal,
    clientId,
    projectId,
    push,
    ensureConversation,
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

  const renderPersistedBlock = (block: IvoResolvedMessageBlock) => {
    if (block.type === "picker") {
      const options = ((block.data as { options?: AiEntityOption[] }).options ?? []);
      if (block.pickerType === "client") {
        const proceed = (id: string, display: string) => {
          setClientId(id);
          setPendingField(null);
          push({ role: "user", content: display });
          startTransition(async () => runWorkflowRef.current(mode, collected, id, projectId, ""));
        };
        return (
          <ClientPicker
            clients={options}
            label={block.label}
            allowSkip={block.allowSkip}
            onSelect={(id) => proceed(id, options.find((option) => option.id === id)?.name ?? "Selected client")}
            onSkip={() => proceed(NO_CLIENT_SENTINEL, "No client (internal)")}
          />
        );
      }
      if (block.pickerType === "project") {
        const proceed = (id: string, display: string) => {
          setProjectId(id);
          setPendingField(null);
          push({ role: "user", content: display });
          startTransition(async () => runWorkflowRef.current(mode, collected, clientId, id, ""));
        };
        return (
          <ProjectPicker
            projects={options}
            label={block.label}
            allowSkip={block.allowSkip}
            onSelect={(id) => proceed(id, options.find((option) => option.id === id)?.name ?? "Selected project")}
            onSkip={() => proceed(NO_PROJECT_SENTINEL, "No project (internal)")}
          />
        );
      }
      if (block.pickerType === "state") {
        return (
          <StatePicker
            label={block.label}
            onSelect={(stateName) => {
              const nextFields = { ...collected, state: stateName };
              setCollected(nextFields);
              setPendingField(null);
              push({ role: "user", content: stateName });
              startTransition(async () => runWorkflowRef.current(mode, nextFields, clientId, projectId, ""));
            }}
          />
        );
      }
      return (
        <WelcomeTemplatePicker
          onSelect={(templateId, display) => {
            const nextFields = { ...collected, welcomeTemplate: templateId };
            setCollected(nextFields);
            setPendingField(null);
            push({ role: "user", content: display });
            startTransition(async () => runWorkflowRef.current(mode, nextFields, clientId, projectId, ""));
          }}
        />
      );
    }

    if (block.type === "entity_list") {
      const rows = (block.data as { rows?: unknown[] }).rows ?? [];
      if (block.entityType === "invoice") {
        return <InvoiceListBlock rows={rows as AiInvoiceListRow[]} onMarkPaid={handleRowMarkPaid} onRemind={handleRowRemind} />;
      }
      if (block.entityType === "contract") {
        return <ContractListBlock rows={rows as AiContractListRow[]} onSend={handleContractRowSend} />;
      }
      if (block.entityType === "client") {
        return (
          <ClientListBlock
            rows={rows as AiClientListRow[]}
            onInvoice={(name) => submitRef.current?.(`Create an invoice for ${name}`)}
          />
        );
      }
      if (block.entityType === "project") {
        return (
          <ProjectListBlock
            rows={rows as AiProjectListRow[]}
            onInvoice={(name) => submitRef.current?.(`Create an invoice for project ${name}`)}
          />
        );
      }
      return (
        <WelcomeDocListBlock
          rows={rows as AiWelcomeDocListRow[]}
          onCreate={() => submitRef.current?.("Help me prepare a welcome document for a client")}
        />
      );
    }

    if (block.type === "entity_result") {
      const data = block.data as Record<string, unknown>;
      if (block.entityType === "client") {
        return (
          <ResultBlock
            title="Client created"
            description={`Added ${String(data.name ?? "the client")} to your workspace.`}
            actionLabel="Open clients"
            onAction={() => router.push("/dashboard/clients")}
          />
        );
      }
      if (block.entityType === "project") {
        return (
          <ResultBlock
            title="Project created"
            description={`${String(data.name ?? "Project")} is ready.`}
            actionLabel="Open projects"
            onAction={() => router.push("/dashboard/projects")}
          />
        );
      }
      return (
        <ResultBlock
          title="Time entry logged"
          description={`${String(data.description ?? "Time entry")} — ${Number(data.hours ?? 0)}h ${Number(data.minutes ?? 0)}m${data.billable ? " · billable" : " · non-billable"}.`}
          actionLabel="Open time tracker"
          onAction={() => router.push("/dashboard/time")}
        />
      );
    }

    if (block.type === "confirmation") {
      const summary = block.data as unknown as AiConfirmSummary;
      return (
        <ConfirmBlock
          summary={summary}
          onConfirm={() => {
            const confirmation = pendingConfirmRef.current;
            if (!confirmation || confirmation.toolRequestKey !== block.requestId) return;
            setPendingConfirm(null);
            push({ role: "user", content: "Confirm" });
            startTransition(async () => {
              await runWorkflowRef.current(
                confirmation.workflow,
                confirmation.fields,
                confirmation.cId,
                confirmation.pId,
                "",
                true,
                confirmation.toolRequestKey,
                {
                  kind: "invoke_tool",
                  tool: confirmation.tool,
                  requestId: confirmation.toolRequestKey,
                },
              );
            });
          }}
          onCancel={() => {
            const confirmation = pendingConfirmRef.current;
            if (!confirmation || confirmation.toolRequestKey !== block.requestId) return;
            setPendingConfirm(null);
            if (conversationIdRef.current) {
              void rejectIvoToolAction({
                conversationId: conversationIdRef.current,
                idempotencyKey: confirmation.toolRequestKey,
              });
            }
            setMode("general");
            setCollected({});
            setPendingField(null);
            setClientId("");
            setProjectId("");
            push({ role: "assistant", content: "No problem — cancelled. What next?" });
          }}
        />
      );
    }

    if (block.entityType === "invoice") {
      const preview = block.data as unknown as AiInvoicePreview;
      return block.variant === "delivery" ? (
        <InvoiceDeliveryActions
          preview={preview}
          onDeliver={handleInvoiceDelivery}
          onOpen={() => router.push(`/dashboard/invoices/${preview.id}`)}
        />
      ) : (
        <InvoiceDraftPreview
          preview={preview}
          onApprove={handleInvoiceApprove}
          onOpen={() => router.push(`/dashboard/invoices/${preview.id}`)}
        />
      );
    }

    if (block.entityType === "contract") {
      const preview = block.data as unknown as AiContractPreview;
      return (
        <ContractDraftPreview
          preview={preview}
          onApproveAndSend={handleContractApproveAndSend}
          onWhatsApp={handleContractWhatsApp}
          onOpen={() => router.push(`/dashboard/contracts/${preview.id}`)}
        />
      );
    }

    const preview = block.data as unknown as AiWelcomeDocPreview;
    return block.variant === "delivery" ? (
      <WelcomeDocDeliveryActions
        preview={preview}
        onDeliver={handleWelcomeDocDelivery}
        onOpen={() => router.push(`/dashboard/welcome/${preview.id}`)}
      />
    ) : (
      <WelcomeDocDraftPreview
        preview={preview}
        onApprove={handleWelcomeDocApprove}
        onOpen={() => router.push(`/dashboard/welcome/${preview.id}`)}
        onSaveTemplate={handleSaveWelcomeTemplate}
      />
    );
  };

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
                onClick={handleClearMemory}
                disabled={clearingMemory}
                aria-label="Reset Ivo's memory"
                title="Reset Ivo's memory — forget all saved preferences"
              >
                <Eraser className="h-4 w-4" />
              </Button>
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
                    {message.persistedBlock
                      ? renderPersistedBlock(message.persistedBlock)
                      : message.role === "assistant" && typeof message.content === "string"
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

            {/* Typing indicator — live progress, then the reply streaming in */}
            {pending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border/70 bg-background px-4 py-3 shadow-sm">
                  {liveReply ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {liveReply.replace(/\n?\s*\[chips\][\s\S]*$/i, "")}
                      <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded bg-primary/70 align-middle" />
                    </p>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        {[0, 1, 2].map((item) => (
                          <span
                            key={item}
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
                            style={{ animationDelay: `${item * 120}ms` }}
                          />
                        ))}
                      </span>
                      {agentStatus ? (
                        <span className="text-xs text-muted-foreground">{agentStatus}</span>
                      ) : null}
                    </span>
                  )}
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
