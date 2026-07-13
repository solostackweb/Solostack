import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { formatCurrencyAmount } from "@/lib/format";
import { getUnbilledTime } from "@/features/time/server";
import type { AutomationRecipeRow } from "@/lib/supabase/types";

export type AutomationTone = "info" | "warning" | "danger";

export interface AutomationRecipeRecord {
  id: string;
  triggerKey: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface AutomationSuggestionRecord {
  id: string;
  triggerKey: string;
  title: string;
  description: string;
  prompt: string;
  href: string;
  tone: AutomationTone;
}

const DEFAULT_RECIPES = [
  {
    trigger_key: "invoice_overdue_followup",
    name: "Overdue invoice follow-up",
    description: "Suggest a reminder when an invoice crosses its due date.",
  },
  {
    trigger_key: "invoice_due_soon_review",
    name: "Due-soon invoice review",
    description: "Suggest a gentle pre-due reminder for invoices due soon.",
  },
  {
    trigger_key: "proposal_followup",
    name: "Proposal follow-up",
    description: "Suggest a follow-up when a sent proposal has gone quiet.",
  },
  {
    trigger_key: "unbilled_time_invoice",
    name: "Unbilled time invoice",
    description: "Suggest invoicing billable time that has not been billed.",
  },
  {
    trigger_key: "contract_expiry_followup",
    name: "Contract expiry follow-up",
    description: "Suggest action before a sent contract expires.",
  },
] as const;

function mapRecipe(row: AutomationRecipeRow): AutomationRecipeRecord {
  return {
    id: row.id,
    triggerKey: row.trigger_key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
  };
}

async function requireUserId() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function ensureRecipes(userId: string): Promise<AutomationRecipeRecord[]> {
  const supabase = await getServerSupabase();
  const rows = DEFAULT_RECIPES.map((recipe) => ({
    ...recipe,
    user_id: userId,
    enabled: true,
  }));

  await supabase
    .from("automation_recipes")
    .upsert(rows as never, { onConflict: "user_id,trigger_key", ignoreDuplicates: true });

  const { data, error } = await supabase
    .from("automation_recipes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return DEFAULT_RECIPES.map((recipe, index) => ({
      id: `default-${index}`,
      triggerKey: recipe.trigger_key,
      name: recipe.name,
      description: recipe.description,
      enabled: true,
    }));
  }

  return (data as unknown as AutomationRecipeRow[]).map(mapRecipe);
}

function daysBetween(fromIso: string, to = Date.now()): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((to - t) / 86_400_000);
}

function isEnabled(
  recipes: AutomationRecipeRecord[],
  triggerKey: string,
): boolean {
  return recipes.find((recipe) => recipe.triggerKey === triggerKey)?.enabled ?? true;
}

export async function getAutomationLiteSnapshot(): Promise<{
  recipes: AutomationRecipeRecord[];
  suggestions: AutomationSuggestionRecord[];
}> {
  const userId = await requireUserId();
  if (!userId) return { recipes: [], suggestions: [] };

  const supabase = await getServerSupabase();
  const recipes = await ensureRecipes(userId);
  const suggestions: AutomationSuggestionRecord[] = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in3 = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000).toISOString();

  if (isEnabled(recipes, "invoice_overdue_followup")) {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, currency, due_date")
      .in("status", ["sent", "viewed", "overdue", "partially_paid"])
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(1);
    const invoice = (data?.[0] as
      | {
          id: string;
          invoice_number: string;
          total_amount: number;
          currency: string;
          due_date: string;
        }
      | undefined);
    if (invoice) {
      const days = Math.max(0, daysBetween(invoice.due_date));
      suggestions.push({
        id: `overdue-${invoice.id}`,
        triggerKey: "invoice_overdue_followup",
        title: `Follow up ${invoice.invoice_number}`,
        description: `${formatCurrencyAmount(Number(invoice.total_amount), invoice.currency)} is ${days === 0 ? "due today" : `${days}d overdue`}.`,
        prompt: `Draft and prepare a polite payment reminder for invoice ${invoice.invoice_number}. Amount: ${formatCurrencyAmount(Number(invoice.total_amount), invoice.currency)}. It is ${days === 0 ? "due today" : `${days} days overdue`}. Ask me before sending.`,
        href: `/dashboard/invoices/${invoice.id}`,
        tone: days > 7 ? "danger" : "warning",
      });
    }
  }

  if (isEnabled(recipes, "invoice_due_soon_review")) {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, currency, due_date")
      .in("status", ["sent", "viewed", "partially_paid"])
      .gte("due_date", today)
      .lte("due_date", in3)
      .order("due_date", { ascending: true })
      .limit(1);
    const invoice = (data?.[0] as
      | {
          id: string;
          invoice_number: string;
          total_amount: number;
          currency: string;
          due_date: string;
        }
      | undefined);
    if (invoice) {
      suggestions.push({
        id: `due-${invoice.id}`,
        triggerKey: "invoice_due_soon_review",
        title: `Invoice ${invoice.invoice_number} is due soon`,
        description: `Prepare a soft reminder before ${invoice.due_date}.`,
        prompt: `Draft a gentle pre-due reminder for invoice ${invoice.invoice_number}. Amount: ${formatCurrencyAmount(Number(invoice.total_amount), invoice.currency)}. Due date: ${invoice.due_date}. Ask me before sending.`,
        href: `/dashboard/invoices/${invoice.id}`,
        tone: "info",
      });
    }
  }

  if (isEnabled(recipes, "proposal_followup")) {
    const { data } = await supabase
      .from("proposals")
      .select("id, title, status, total_amount, currency, sent_at, viewed_at, updated_at")
      .in("status", ["sent", "viewed"])
      .lte("updated_at", threeDaysAgo)
      .order("updated_at", { ascending: true })
      .limit(1);
    const proposal = (data?.[0] as
      | {
          id: string;
          title: string;
          status: string;
          total_amount: number;
          currency: string;
          updated_at: string;
        }
      | undefined);
    if (proposal) {
      suggestions.push({
        id: `proposal-${proposal.id}`,
        triggerKey: "proposal_followup",
        title: `Follow up proposal`,
        description: `${proposal.title} has been ${proposal.status} for ${daysBetween(proposal.updated_at)}d.`,
        prompt: `Draft a concise follow-up for proposal ${proposal.title}. Value: ${formatCurrencyAmount(Number(proposal.total_amount), proposal.currency)}. Status: ${proposal.status}. Ask me before sending.`,
        href: `/dashboard/proposals/${proposal.id}`,
        tone: "info",
      });
    }
  }

  if (isEnabled(recipes, "unbilled_time_invoice")) {
    const unbilled = await getUnbilledTime().catch(() => null);
    if (unbilled && unbilled.totalAmount > 0) {
      const hours = Math.round((unbilled.totalSeconds / 3600) * 10) / 10;
      suggestions.push({
        id: "unbilled-time",
        triggerKey: "unbilled_time_invoice",
        title: "Invoice unbilled time",
        description: `${hours}h worth ${formatCurrencyAmount(unbilled.totalAmount, "INR")} is ready to bill.`,
        prompt: `Create an invoice draft for my unbilled time. Total unbilled time: ${hours} hours, estimated value ${formatCurrencyAmount(unbilled.totalAmount, "INR")}. Ask me to confirm before creating.`,
        href: "/dashboard/time?status=unbilled",
        tone: "warning",
      });
    }
  }

  if (isEnabled(recipes, "contract_expiry_followup")) {
    const { data } = await supabase
      .from("contracts")
      .select("id, title, expires_at")
      .in("status", ["sent", "viewed"])
      .not("expires_at", "is", null)
      .gte("expires_at", now.toISOString())
      .lte("expires_at", in7)
      .order("expires_at", { ascending: true })
      .limit(1);
    const contract = (data?.[0] as
      | { id: string; title: string; expires_at: string }
      | undefined);
    if (contract) {
      suggestions.push({
        id: `contract-${contract.id}`,
        triggerKey: "contract_expiry_followup",
        title: "Contract may expire soon",
        description: `${contract.title} expires in ${Math.ceil((new Date(contract.expires_at).getTime() - now.getTime()) / 86_400_000)}d.`,
        prompt: `Draft a short follow-up for contract ${contract.title}, which expires on ${contract.expires_at.slice(0, 10)}. Ask me before sending.`,
        href: `/dashboard/contracts/${contract.id}`,
        tone: "warning",
      });
    }
  }

  return {
    recipes,
    suggestions: suggestions.slice(0, 4),
  };
}
