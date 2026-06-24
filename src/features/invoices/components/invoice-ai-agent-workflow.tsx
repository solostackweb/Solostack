"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Mail, Send, Smartphone, Sparkles, Wand2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClientRecord } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import type { ProjectRecord } from "@/features/projects/server";
import { createInvoiceAction } from "../actions";
import { sendInvoiceAction } from "../delivery";
import { generateInvoiceDraftAction } from "@/features/ai-workflows/actions";
import { ensureInvoicePublicTokenAction } from "@/features/share/actions";
import { buildWaUrl } from "@/lib/whatsapp";
import { useProfile } from "@/features/profile/context";
import { getDisplayName } from "@/features/profile/utils";

interface InvoiceAiAgentWorkflowProps {
  clients: ClientRecord[];
  projects: ProjectRecord[];
  nextInvoiceNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step =
  | "client"
  | "project"
  | "work"
  | "due"
  | "amount"
  | "discount"
  | "notes"
  | "creating"
  | "ready";

interface CreatedInvoice {
  id: string;
  number: string;
  total: number;
  currency: string;
  publicUrl: string;
}

const dueOptions = [
  { label: "7 days", days: 7 },
  { label: "15 days", days: 15 },
  { label: "30 days", days: 30 },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InvoiceAiAgentWorkflow({
  clients,
  projects,
  nextInvoiceNumber,
  open,
  onOpenChange,
}: InvoiceAiAgentWorkflowProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const [pending, startTransition] = React.useTransition();
  const [step, setStep] = React.useState<Step>("client");
  const [clientId, setClientId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [skippedProject, setSkippedProject] = React.useState(false);
  const [work, setWork] = React.useState("");
  const [dueDate, setDueDate] = React.useState(addDays(15));
  const [quantity, setQuantity] = React.useState(1);
  const [rate, setRate] = React.useState(0);
  const [discount, setDiscount] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [created, setCreated] = React.useState<CreatedInvoice | null>(null);
  const [emailSent, setEmailSent] = React.useState(false);
  const [introVisible, setIntroVisible] = React.useState(false);
  const [introTyping, setIntroTyping] = React.useState(false);
  const [visibleQuestions, setVisibleQuestions] = React.useState<Step[]>([]);
  const [typingQuestion, setTypingQuestion] = React.useState<Step | null>(null);
  const conversationRef = React.useRef<HTMLDivElement>(null);
  const conversationEndRef = React.useRef<HTMLDivElement>(null);

  const client = clients.find((item) => item.id === clientId) ?? null;
  const projectOptions = React.useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [clientId, projects],
  );
  const project = projects.find((item) => item.id === projectId) ?? null;
  const subtotal = Math.max(0, quantity * rate);
  const effectiveTotal = Math.max(0, subtotal - discount);
  const invoiceCurrency = (client?.currency || profile?.defaultCurrency || "INR").toUpperCase();
  const isForeignClient = Boolean(client?.isForeign) || invoiceCurrency !== "INR";
  const senderName = getDisplayName(profile) || profile?.businessName || "Stackivo";

  const reset = React.useCallback(() => {
    setStep("client");
    setClientId("");
    setProjectId("");
    setSkippedProject(false);
    setWork("");
    setDueDate(addDays(profile?.invoiceDefaultDueDays ?? 15));
    setQuantity(1);
    setRate(0);
    setDiscount(0);
    setNotes("");
    setCreated(null);
    setEmailSent(false);
    setIntroVisible(false);
    setIntroTyping(false);
    setVisibleQuestions([]);
    setTypingQuestion(null);
  }, [profile?.invoiceDefaultDueDays]);

  React.useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  React.useEffect(() => {
    if (!open) return;
    setIntroTyping(true);
    const introTimer = window.setTimeout(() => {
      setIntroTyping(false);
      setIntroVisible(true);
    }, 850);
    return () => {
      window.clearTimeout(introTimer);
    };
  }, [open]);

  React.useEffect(() => {
    const questionSteps: Step[] = [
      "client",
      "project",
      "work",
      "due",
      "amount",
      "discount",
      "notes",
    ];
    if (!questionSteps.includes(step)) return;
    if (!open || !introVisible || visibleQuestions.includes(step)) return;
    setTypingQuestion(step);
    const timer = window.setTimeout(() => {
      setTypingQuestion(null);
      setVisibleQuestions((prev) => (prev.includes(step) ? prev : [...prev, step]));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [introVisible, open, step, visibleQuestions]);

  React.useEffect(() => {
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        const node = conversationRef.current;
        if (!node) return;
        node.scrollTo({
          top: node.scrollHeight,
          behavior: "smooth",
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [
    introTyping,
    introVisible,
    typingQuestion,
    visibleQuestions,
    step,
    clientId,
    projectId,
    skippedProject,
    work,
    dueDate,
    quantity,
    rate,
    discount,
    notes,
    pending,
    created,
  ]);

  const createInvoice = () => {
    if (!clientId || !work.trim() || rate <= 0) return;
    setStep("creating");
    const finalRate = quantity > 0 ? Math.max(0, effectiveTotal / quantity) : 0;
    const discountNote =
      discount > 0
        ? `Discount applied: ${invoiceCurrency} ${discount.toLocaleString("en-IN")}.`
        : "";
    startTransition(async () => {
      try {
        const aiFd = new FormData();
        aiFd.set(
          "payload",
          JSON.stringify({
            clientId,
            projectId,
            workDescription: work.trim(),
            amount: rate,
            quantity,
            dueDate,
            notes,
          }),
        );
        const aiDraft = await generateInvoiceDraftAction(aiFd);
        const aiLine = aiDraft.ok ? aiDraft.data.items[0] : null;
        const aiNotes = aiDraft.ok ? aiDraft.data.notes : "";
        const aiTerms = aiDraft.ok ? aiDraft.data.terms : "";
        const payload = {
          clientId,
          projectId: projectId || undefined,
          invoiceNumber: nextInvoiceNumber,
          issueDate: todayIso(),
          dueDate,
          currency: invoiceCurrency,
          status: "draft",
          notes:
            [notes.trim(), aiNotes, discountNote]
              .filter(Boolean)
              .join("\n\n") || undefined,
          terms: aiTerms || profile?.invoiceDefaultTerms || undefined,
          lines: [
            {
              description: aiLine?.description || work.trim(),
              quantity,
              unitPrice: finalRate,
              gstRate: profile?.gstRegistered && !isForeignClient ? profile.invoiceDefaultGstRate : 0,
              position: 0,
            },
          ],
        };
        const fd = new FormData();
        fd.set("payload", JSON.stringify(payload));

        const res = await createInvoiceAction(undefined, fd);
        if (!res.ok || !res.data?.id) {
          toast.error(res.ok ? "Could not create invoice." : res.error);
          setStep("notes");
          return;
        }
        const tokenRes = await ensureInvoicePublicTokenAction({ invoiceId: res.data.id });
        const publicUrl =
          tokenRes.ok && tokenRes.data?.token
            ? `${window.location.origin}/i/${tokenRes.data.token}`
            : `${window.location.origin}/dashboard/invoices/${res.data.id}`;
        setCreated({
          id: res.data.id,
          number: nextInvoiceNumber,
          total: effectiveTotal,
          currency: invoiceCurrency,
          publicUrl,
        });
        setStep("ready");
        router.refresh();
      } catch {
        toast.error("Network changed while creating the invoice. Please try again.");
        setStep("notes");
      }
    });
  };

  const sendEmail = React.useCallback(async () => {
    if (!created) return false;
    try {
      const res = await sendInvoiceAction({ invoiceId: created.id });
      if (!res.ok) {
        toast.error(res.error);
        return false;
      }
    } catch {
      toast.error("Network changed while sending the email. Please try again.");
      return false;
    }
    setEmailSent(true);
    toast.success("Invoice emailed to client");
    router.refresh();
    return true;
  }, [created, router]);

  const openWhatsApp = React.useCallback(() => {
    if (!created) return;
    const url = buildWaUrl({
      phone: client?.phone,
      clientName: client ? getClientDisplayName(client) : null,
      documentType: "invoice",
      documentNumber: created.number,
      amount: created.total,
      currency: created.currency,
      senderName,
      shareUrl: created.publicUrl,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }, [client, created, senderName]);

  const sendBoth = React.useCallback(() => {
    startTransition(async () => {
      const ok = emailSent || (await sendEmail());
      if (ok) openWhatsApp();
    });
  }, [emailSent, openWhatsApp, sendEmail, startTransition]);

  const selectedClientName = client ? getClientDisplayName(client) : "";
  const selectedProjectName = project?.name ?? "No project";
  const dueDateLabel = new Date(dueDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <AnimatePresence initial={false}>
      {open && (
      <motion.aside
        initial={{ opacity: 0, y: -10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.985 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-20 flex h-[calc(100vh-11rem)] min-h-[560px] max-h-[720px] w-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl"
      >
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background text-primary shadow-sm">
              <Wand2 className="h-4 w-4" />
            </span>
            Stackivo AI
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
            aria-label="Close Stackivo AI"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <motion.div
          ref={conversationRef}
          className="scrollbar-modern flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.06),transparent_32rem)] px-5 py-5"
          layoutScroll
        >
          {introTyping && <TypingBubble />}
          {introVisible && (
            <AiBubble>
              Hey {getDisplayName(profile) || "there"}, let&apos;s create a new
              invoice. I&apos;ll collect the details, generate the invoice, then help
              you send it by email or WhatsApp.
            </AiBubble>
          )}

          {typingQuestion === "client" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("client") && step === "client"}
            title="Choose a client"
            caption="I’ll use this client’s billing details and contact info."
          >
            <select
              value={clientId}
              onChange={(event) => {
                const selected = event.target.value;
                setClientId(selected);
                setProjectId("");
                setSkippedProject(false);
                if (selected) setStep("project");
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/15"
            >
              <option value="">Select a client</option>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {getClientDisplayName(item)}
                  {item.email ? ` - ${item.email}` : ""}
                </option>
              ))}
            </select>
          </AiQuestion>

          {clientId && step !== "client" && (
            <UserBubble title="Client selected">{selectedClientName}</UserBubble>
          )}

          {typingQuestion === "project" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("project") && step === "project"}
            title="Choose a project"
            caption="I’ll only show projects linked to the selected client."
          >
            <select
              value={projectId}
              onChange={(event) => {
                const selected = event.target.value;
                setProjectId(selected);
                setSkippedProject(false);
                if (selected) setStep("work");
              }}
              disabled={!clientId}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:border-primary/40 focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {projectOptions.length ? "Select a project" : "No project for this client"}
              </option>
              {projectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSkippedProject(true);
                setStep("work");
              }}
              className="mt-2"
            >
              Skip project
            </Button>
          </AiQuestion>

          {(projectId || skippedProject) && !["client", "project"].includes(step) && (
            <UserBubble title="Project">{selectedProjectName}</UserBubble>
          )}

          {typingQuestion === "work" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("work") && step === "work"}
            title="Describe the work"
            caption="A short sentence is enough. I’ll polish it into an invoice line."
          >
            <Textarea
              value={work}
              onChange={(event) => setWork(event.target.value)}
              placeholder="Example: Landing page design, responsive build, and launch support"
              className="resize-none"
              rows={3}
            />
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={work.trim().length < 4}
              onClick={() => setStep("due")}
            >
              Continue
            </Button>
          </AiQuestion>

          {work.trim() && !["client", "project", "work"].includes(step) && (
            <UserBubble title="Work description">{work.trim()}</UserBubble>
          )}

          {typingQuestion === "due" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("due") && step === "due"}
            title="Choose due date"
            caption="Pick a common term or set a specific date."
          >
            <div className="flex flex-wrap gap-2">
              {dueOptions.map((option) => (
                <Choice
                  key={option.label}
                  selected={dueDate === addDays(option.days)}
                  onClick={() => {
                    setDueDate(addDays(option.days));
                    setStep("amount");
                  }}
                >
                  {option.label}
                </Choice>
              ))}
            </div>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => {
                setDueDate(event.target.value);
                setStep("amount");
              }}
              className="mt-3"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setStep("amount")}
            >
              Use default due date
            </Button>
          </AiQuestion>

          {!['client', 'project', 'work', 'due'].includes(step) && (
            <UserBubble title="Due date">{dueDateLabel}</UserBubble>
          )}

          {typingQuestion === "amount" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("amount") && step === "amount"}
            title="Quantity and rate"
            caption="Quantity defaults to 1. I’ll calculate the invoice value from this."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
                placeholder="Quantity"
              />
              <Input
                type="number"
                min="0"
                step="1"
                value={rate || ""}
                onChange={(event) => setRate(Math.max(0, Number(event.target.value) || 0))}
                placeholder="Rate"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={quantity <= 0 || rate <= 0}
              onClick={() => setStep("discount")}
            >
              Continue
            </Button>
          </AiQuestion>

          {rate > 0 && !["client", "project", "work", "due", "amount"].includes(step) && (
            <UserBubble title="Amount">
              Qty {quantity} × {invoiceCurrency} {rate.toLocaleString("en-IN")}
            </UserBubble>
          )}

          {typingQuestion === "discount" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("discount") && step === "discount"}
            title="Any discount?"
            caption="Leave it at zero if there’s no discount."
          >
            <Input
              type="number"
              min="0"
              step="1"
              value={discount || ""}
              onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))}
              placeholder="0"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => setStep("notes")}>
                Continue
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDiscount(0);
                  setStep("notes");
                }}
              >
                Skip discount
              </Button>
            </div>
          </AiQuestion>

          {!['client', 'project', 'work', 'due', 'amount', 'discount'].includes(step) && (
            <UserBubble title="Discount">
              {discount > 0
                ? `${invoiceCurrency} ${discount.toLocaleString("en-IN")}`
                : "No discount"}
            </UserBubble>
          )}

          {typingQuestion === "notes" && <TypingBubble />}
          <AiQuestion
            show={visibleQuestions.includes("notes") && step === "notes"}
            title="Any extra notes or payment terms?"
            caption="Optional. I’ll include your default payment terms if you skip this."
          >
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={profile?.invoiceDefaultTerms ?? "Optional notes for the client"}
              className="resize-none"
              rows={3}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={createInvoice}
              >
                {pending || step === "creating" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Generate invoice
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setNotes("");
                  createInvoice();
                }}
              >
                Skip notes
              </Button>
            </div>
          </AiQuestion>

          {notes.trim() && ["creating", "ready"].includes(step) && (
            <UserBubble title="Notes">{notes.trim()}</UserBubble>
          )}

          {step === "creating" && (
            <AiBubble>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Creating the invoice, assigning the number, and preparing the share link...
              </span>
            </AiBubble>
          )}

          {created && (
            <AiBubble>
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Invoice created
                </div>
                <div className="rounded-md bg-background p-3">
                  <p className="font-medium">{created.number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {client ? getClientDisplayName(client) : "Client"} {project ? `· ${project.name}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    {created.currency} {created.total.toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  How should I send it?
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || emailSent}
                    onClick={() => startTransition(() => void sendEmail())}
                  >
                    <Mail /> {emailSent ? "Emailed" : "Email"}
                  </Button>
                  <Button type="button" variant="outline" onClick={openWhatsApp}>
                    <Smartphone /> WhatsApp
                  </Button>
                  <Button type="button" disabled={pending} onClick={sendBoth}>
                    <Send /> Both
                  </Button>
                </div>
              </div>
            </AiBubble>
          )}
          <div ref={conversationEndRef} aria-hidden className="h-1" />
        </motion.div>
      </motion.aside>
      )}
    </AnimatePresence>
  );
}

function AiQuestion({
  show,
  title,
  caption,
  children,
}: {
  show: boolean;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <AiBubble>
      <p className="font-medium">{title}</p>
      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
      <div className="mt-3">
      {children}
      </div>
    </AiBubble>
  );
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[88%] rounded-lg border bg-background/95 px-4 py-3 text-sm leading-relaxed shadow-sm backdrop-blur animate-in fade-in-0 slide-in-from-bottom-1">
        {children}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <AiBubble>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
    </AiBubble>
  );
}

function UserBubble({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-1">
      <div className="max-w-[78%] rounded-lg bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">
          {title}
        </p>
        <div className="mt-1 font-medium">{children}</div>
      </div>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      {children}
    </button>
  );
}
