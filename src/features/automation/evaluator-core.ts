import "server-only";

/**
 * Pure automation evaluator — Phase 4 slice 1.
 *
 * Detect actionable moments (overdue invoice, due-soon invoice, stale
 * proposal, unbilled time, expiring contract) from typed, already
 * RLS-scoped rows and turn them into candidates. Pure on purpose: no
 * database, no network, no `Date.now()` — the caller passes `now`, so the
 * same snapshot plus the same clock always produces the same candidates,
 * which is exactly what `evals/automation.eval.ts` pins.
 *
 * Persistence and approval live elsewhere (server.ts); this module decides.
 */

import { formatCurrencyAmount } from "@/lib/format";

export type AutomationTone = "info" | "warning" | "danger";

export type AutomationTriggerKey =
  | "invoice_overdue_followup"
  | "invoice_due_soon_review"
  | "proposal_followup"
  | "unbilled_time_invoice"
  | "contract_expiry_followup";

export type EvaluatorSnapshot = {
  overdueInvoices: InvoiceInput[];
  dueSoonInvoices: InvoiceInput[];
  staleProposals: ProposalInput[];
  unbilled: { totalAmount: number; totalHours: number } | null;
  expiringContracts: ContractInput[];
};

export interface InvoiceInput {
  id: string;
  invoice_number: string;
  total_amount: number;
  currency: string;
  due_date: string;
}

export interface ProposalInput {
  id: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  updated_at: string;
}

export interface ContractInput {
  id: string;
  title: string;
  expires_at: string | null;
}

export interface AutomationCandidate {
  triggerKey: AutomationTriggerKey;
  /** Stable per source moment: `trigger:<entityId>` — the dedupe contract. */
  dedupeKey: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  prompt: string;
  href: string;
  tone: AutomationTone;
}

function daysBetween(fromIso: string, now: Date): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

function evaluateOverdue(
  rows: InvoiceInput[],
  now: Date,
): AutomationCandidate[] {
  const today = now.toISOString().slice(0, 10);
  return rows
    .filter((row) => row.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((row) => {
      const days = Math.max(0, daysBetween(row.due_date, now));
      const amount = formatCurrencyAmount(Number(row.total_amount), row.currency);
      return {
        triggerKey: "invoice_overdue_followup" as const,
        dedupeKey: `invoice_overdue_followup:${row.id}`,
        entityType: "invoice",
        entityId: row.id,
        title: `Follow up ${row.invoice_number}`,
        description: `${amount} is ${days === 0 ? "due today" : `${days}d overdue`}.`,
        prompt: `Draft and prepare a polite payment reminder for invoice ${row.invoice_number}. Amount: ${amount}. It is ${days === 0 ? "due today" : `${days} days overdue`}. Ask me before sending.`,
        href: `/dashboard/invoices/${row.id}`,
        tone: days > 7 ? "danger" : "warning",
      };
    });
}

function evaluateDueSoon(
  rows: InvoiceInput[],
  now: Date,
): AutomationCandidate[] {
  const today = now.toISOString().slice(0, 10);
  const in3 = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  return rows
    .filter((row) => row.due_date >= today && row.due_date <= in3)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((row) => {
      const amount = formatCurrencyAmount(Number(row.total_amount), row.currency);
      return {
        triggerKey: "invoice_due_soon_review" as const,
        dedupeKey: `invoice_due_soon_review:${row.id}`,
        entityType: "invoice",
        entityId: row.id,
        title: `Invoice ${row.invoice_number} is due soon`,
        description: `Prepare a soft reminder before ${row.due_date}.`,
        prompt: `Draft a gentle pre-due reminder for invoice ${row.invoice_number}. Amount: ${amount}. Due date: ${row.due_date}. Ask me before sending.`,
        href: `/dashboard/invoices/${row.id}`,
        tone: "info",
      };
    });
}

function evaluateStaleProposals(
  rows: ProposalInput[],
  now: Date,
): AutomationCandidate[] {
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  return rows
    .filter((row) => row.updated_at <= threeDaysAgo)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .map((row) => {
      const value = formatCurrencyAmount(Number(row.total_amount), row.currency);
      const days = daysBetween(row.updated_at, now);
      return {
        triggerKey: "proposal_followup" as const,
        dedupeKey: `proposal_followup:${row.id}`,
        entityType: "proposal",
        entityId: row.id,
        title: `Follow up proposal`,
        description: `${row.title} has been ${row.status} for ${days}d.`,
        prompt: `Draft a concise follow-up for proposal ${row.title}. Value: ${value}. Status: ${row.status}. Ask me before sending.`,
        href: `/dashboard/proposals/${row.id}`,
        tone: "info",
      };
    });
}

function evaluateUnbilled(
  unbilled: { totalAmount: number; totalHours: number } | null,
): AutomationCandidate[] {
  if (!unbilled || unbilled.totalAmount <= 0) return [];
  const hours = Math.round(unbilled.totalHours * 10) / 10;
  const amount = formatCurrencyAmount(unbilled.totalAmount, "INR");
  return [
    {
      triggerKey: "unbilled_time_invoice" as const,
      dedupeKey: "unbilled_time_invoice:workspace",
      entityType: "workspace",
      entityId: "workspace",
      title: "Invoice unbilled time",
      description: `${hours}h worth ${amount} is ready to bill.`,
      prompt: `Create an invoice draft for my unbilled time. Total unbilled time: ${hours} hours, estimated value ${amount}. Ask me to confirm before creating.`,
      href: "/dashboard/time?status=unbilled",
      tone: "warning",
    },
  ];
}

function evaluateExpiringContracts(
  rows: ContractInput[],
  now: Date,
): AutomationCandidate[] {
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  return rows
    .filter(
      (row) =>
        row.expires_at != null &&
        row.expires_at >= now.toISOString() &&
        row.expires_at <= in7,
    )
    .sort((a, b) =>
      (a.expires_at ?? "").localeCompare(b.expires_at ?? ""),
    )
    .map((row) => {
      const expires = row.expires_at as string;
      const days = Math.ceil((new Date(expires).getTime() - now.getTime()) / 86_400_000);
      return {
        triggerKey: "contract_expiry_followup" as const,
        dedupeKey: `contract_expiry_followup:${row.id}`,
        entityType: "contract",
        entityId: row.id,
        title: "Contract may expire soon",
        description: `${row.title} expires in ${days}d.`,
        prompt: `Draft a short follow-up for contract ${row.title}, which expires on ${expires.slice(0, 10)}. Ask me before sending.`,
        href: `/dashboard/contracts/${row.id}`,
        tone: "warning",
      };
    });
}

/**
 * Evaluate every enabled trigger against the snapshot and merge the
 * per-trigger candidates, oldest-if-present first.
 */
export function evaluateAutomation(
  snapshot: EvaluatorSnapshot,
  now: Date,
  enabled?: Partial<Record<AutomationTriggerKey, boolean>>,
): AutomationCandidate[] {
  const isOn = (key: AutomationTriggerKey) => enabled?.[key] ?? true;
  const candidates: AutomationCandidate[] = [];

  if (isOn("invoice_overdue_followup")) candidates.push(...evaluateOverdue(snapshot.overdueInvoices, now));
  if (isOn("invoice_due_soon_review")) candidates.push(...evaluateDueSoon(snapshot.dueSoonInvoices, now));
  if (isOn("proposal_followup")) candidates.push(...evaluateStaleProposals(snapshot.staleProposals, now));
  if (isOn("unbilled_time_invoice")) candidates.push(...evaluateUnbilled(snapshot.unbilled));
  if (isOn("contract_expiry_followup")) candidates.push(...evaluateExpiringContracts(snapshot.expiringContracts, now));

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.dedupeKey)) return false;
    seen.add(candidate.dedupeKey);
    return true;
  });
}

/**
 * Keep only candidates with no live suggestion already — the persistence
 * dedupe boundary, pure so it can be pinned by evals without a database.
 */
export function filterNewCandidates(
  candidates: AutomationCandidate[],
  liveKeys: Set<string>,
): AutomationCandidate[] {
  return candidates.filter((candidate) => !liveKeys.has(candidate.dedupeKey));
}