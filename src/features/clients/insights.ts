import "server-only";

/**
 * Ambient client intelligence — deterministic behavioural insights computed
 * from the client's own invoice history. No LLM round-trip: these render on
 * every profile load instantly, cost nothing, and never hallucinate. Ivo (the
 * agent) offers judgment on top; this strip supplies the ground truth.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { formatCurrencyAmount } from "@/lib/format";

export type ClientInsightTone = "positive" | "info" | "warning" | "danger";

export interface ClientInsight {
  id: string;
  tone: ClientInsightTone;
  text: string;
}

const DAY_MS = 86_400_000;

function daysDiff(fromIso: string, toIso: string): number | null {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / DAY_MS);
}

export async function getClientBehaviorInsights(
  clientId: string,
): Promise<ClientInsight[]> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("invoices")
    .select("total_amount, currency, status, issue_date, due_date, paid_at")
    .eq("client_id", clientId)
    .order("issue_date", { ascending: false })
    .limit(100);

  const invoices = (data as Array<{
    total_amount: number;
    currency: string;
    status: string;
    issue_date: string;
    due_date: string;
    paid_at: string | null;
  }> | null) ?? [];
  if (invoices.length === 0) return [];

  const insights: ClientInsight[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const currency = invoices[0]?.currency ?? "INR";

  const paid = invoices.filter((invoice) => invoice.status === "paid" && invoice.paid_at);
  const open = invoices.filter((invoice) =>
    ["sent", "viewed", "overdue", "partially_paid"].includes(invoice.status),
  );
  const overdueNow = open.filter((invoice) => invoice.due_date < today);

  // Payment speed + punctuality, from real paid_at timestamps.
  if (paid.length >= 2) {
    const paySpans = paid
      .map((invoice) => daysDiff(invoice.issue_date, invoice.paid_at!))
      .filter((days): days is number => days !== null && days >= 0);
    const lateDays = paid
      .map((invoice) => daysDiff(invoice.due_date, invoice.paid_at!))
      .filter((days): days is number => days !== null);
    if (paySpans.length >= 2) {
      const avgToPay = Math.round(paySpans.reduce((a, b) => a + b, 0) / paySpans.length);
      const lateCount = lateDays.filter((days) => days > 0).length;
      const lateShare = lateCount / lateDays.length;
      if (lateShare >= 0.5) {
        const avgLate = Math.round(
          lateDays.filter((d) => d > 0).reduce((a, b) => a + b, 0) / Math.max(1, lateCount),
        );
        insights.push({
          id: "pays-late",
          tone: "warning",
          text: `Tends to pay ~${avgLate}d past the due date (${lateCount} of ${lateDays.length} invoices late). Consider Net-7 terms or a part-advance.`,
        });
      } else {
        insights.push({
          id: "pays-well",
          tone: "positive",
          text: `Reliable payer — settles in ~${avgToPay} days, ${lateDays.length - lateCount} of ${lateDays.length} invoices on time.`,
        });
      }
    }
  }

  // Live receivables position.
  if (overdueNow.length > 0) {
    const total = overdueNow.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    insights.push({
      id: "overdue-now",
      tone: "danger",
      text: `${formatCurrencyAmount(total, currency)} overdue right now across ${overdueNow.length} invoice${overdueNow.length === 1 ? "" : "s"}.`,
    });
  } else if (open.length > 0) {
    const total = open.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    insights.push({
      id: "outstanding",
      tone: "info",
      text: `${formatCurrencyAmount(total, currency)} outstanding, nothing overdue.`,
    });
  }

  // Relationship value trend.
  if (paid.length >= 1) {
    const paidTotal = paid.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    const avgValue = paidTotal / paid.length;
    const last = paid[0];
    const daysSinceLast = last?.paid_at ? daysDiff(last.paid_at, new Date().toISOString()) : null;
    if (daysSinceLast !== null && daysSinceLast > 90) {
      insights.push({
        id: "gone-quiet",
        tone: "info",
        text: `No payment in ${Math.round(daysSinceLast / 30)} months — a check-in or new proposal could revive this relationship.`,
      });
    } else {
      insights.push({
        id: "value",
        tone: "info",
        text: `Typical invoice ${formatCurrencyAmount(avgValue, currency)} · ${formatCurrencyAmount(paidTotal, currency)} paid across ${paid.length} invoice${paid.length === 1 ? "" : "s"}.`,
      });
    }
  }

  return insights.slice(0, 3);
}
