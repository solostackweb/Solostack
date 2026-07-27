import "server-only";

/**
 * Proactive assistant suggestions ("Today" nudges).
 *
 * Derived from the same RLS-scoped business-facts snapshot the Q&A uses, so a
 * single read powers both. Each suggestion carries a `prompt` that is sent
 * straight into the assistant when tapped — turning a nudge into a one-tap
 * action that routes through the existing intent handlers.
 */

import { log } from "@/lib/logger";
import { getBusinessFacts } from "./business-context";

export interface AssistantSuggestion {
  id: string;
  /** Short, action-oriented label shown on the chip. */
  title: string;
  /** Sent into the assistant on tap (routes via NLU to a query/workflow). */
  prompt: string;
  tone: "alert" | "info";
}

function inr(n: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
}
const plural = (n: number) => (n === 1 ? "" : "s");

export async function getAssistantSuggestions(): Promise<AssistantSuggestion[]> {
  // Every suggestion quotes a real figure, so a failed snapshot must produce no
  // suggestions rather than an error or a nudge built on missing data. Showing
  // nothing is the honest degradation here: the panel simply opens without
  // chips.
  const f = await getBusinessFacts().catch((error: unknown) => {
    log.warn("ivo.suggestions.facts_unavailable", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  });
  if (!f) return [];
  const out: AssistantSuggestion[] = [];

  if (f.invoices.overdueTotal > 0) {
    out.push({
      id: "overdue",
      tone: "alert",
      title: `${inr(f.invoices.overdueTotal)} overdue across ${f.invoices.overdueCount} invoice${plural(
        f.invoices.overdueCount,
      )} — chase it`,
      prompt: "Give me a collection plan for my overdue invoices",
    });
  }

  if (f.unbilled.totalValue > 0) {
    out.push({
      id: "unbilled",
      tone: "info",
      title: `${inr(f.unbilled.totalValue)} of unbilled time (${f.unbilled.totalHours}h) — invoice it`,
      prompt: "Create an invoice for my unbilled time",
    });
  }

  if (f.invoices.outstandingTotal > 0 && f.invoices.overdueTotal === 0) {
    out.push({
      id: "outstanding",
      tone: "info",
      title: `${inr(f.invoices.outstandingTotal)} outstanding across ${f.invoices.outstandingCount} invoice${plural(
        f.invoices.outstandingCount,
      )}`,
      prompt: "Show my outstanding invoices and tell me who to follow up with",
    });
  }

  if (f.revenue.thisMonthPaid === 0 && f.revenue.last12mPaid > 0) {
    out.push({
      id: "no_month_revenue",
      tone: "info",
      title: "No payments recorded this month yet",
      prompt: "What's my revenue this month?",
    });
  }

  if (
    f.clients.revenueConcentrationTop1Pct != null &&
    f.clients.revenueConcentrationTop1Pct >= 50
  ) {
    out.push({
      id: "concentration",
      tone: "info",
      title: `Your top client is ${Math.round(
        f.clients.revenueConcentrationTop1Pct,
      )}% of revenue`,
      prompt: "Who are my top clients and is my revenue too concentrated?",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "healthy_focus",
      tone: "info",
      title: "No urgent cash-flow flags right now — ask Ivo for today's focus",
      prompt: "What should I focus on today?",
    });
  }

  // Alerts first, then keep it to a tidy handful.
  out.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "alert" ? -1 : 1));
  return out.slice(0, 4);
}
