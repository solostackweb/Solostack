"use server";

import { getServerSupabase } from "./server";

/**
 * Call the compute_next_recurring_date RPC function.
 * Returns the next generation date as ISO string.
 */
export async function compute_next_recurring_date(
  frequency: string,
  interval: number,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  startDate: Date,
  afterDate: Date,
): Promise<Date> {
  const supabase = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("compute_next_recurring_date", {
    p_frequency: frequency,
    p_interval: interval,
    p_day_of_month: dayOfMonth,
    p_day_of_week: dayOfWeek,
    p_start_date: startDate.toISOString().split("T")[0],
    p_after_date: afterDate.toISOString().split("T")[0],
  });

  if (error) {
    console.error("[recurring] compute_next_recurring_date failed:", error.message);
    // Fallback: simple date arithmetic
    return fallbackNextDate(frequency, interval, dayOfMonth, dayOfWeek, startDate, afterDate);
  }

  return new Date(data as string);
}

/**
 * Call the client_invoice_metrics Postgres RPC.
 * Returns invoice count and paid total for a client.
 */
export async function rpcClientInvoiceMetrics(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: { p_client_id: string },
): Promise<Array<{ invoice_count: number; paid_total: number }>> {
  const { data, error } = await supabase.rpc("client_invoice_metrics", params);
  if (error) {
    console.error("[rpc] client_invoice_metrics failed:", error.message);
    return [];
  }
  return (data as Array<{ invoice_count: number; paid_total: number }>) ?? [];
}

/**
 * Call the client_revenue_summary Postgres RPC.
 * Returns top clients by paid revenue.
 */
export async function rpcClientRevenueSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: { p_limit: number },
): Promise<Array<{ client_id: string | null; total_paid: number; invoice_count: number }>> {
  const { data, error } = await supabase.rpc("client_revenue_summary", params);
  if (error) {
    console.error("[rpc] client_revenue_summary failed:", error.message);
    return [];
  }
  return (data as Array<{ client_id: string | null; total_paid: number; invoice_count: number }>) ?? [];
}

/**
 * Call the invoice_status_summary Postgres RPC.
 * Returns count and total for invoices in a given status.
 */
export async function rpcInvoiceStatusSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: { p_status: string },
): Promise<Array<{ invoice_count: number; total_amount: number }>> {
  const { data, error } = await supabase.rpc("invoice_status_summary", params);
  if (error) {
    console.error("[rpc] invoice_status_summary failed:", error.message);
    return [];
  }
  return (data as Array<{ invoice_count: number; total_amount: number }>) ?? [];
}

function fallbackNextDate(
  frequency: string,
  interval: number,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  startDate: Date,
  afterDate: Date,
): Date {
  let next = new Date(afterDate);
  if (next < startDate) next = new Date(startDate);

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + interval * 7);
      if (dayOfWeek !== null) {
        while (next.getDay() !== dayOfWeek) {
          next.setDate(next.getDate() + 1);
        }
      }
      break;
    case "monthly":
      next.setMonth(next.getMonth() + interval);
      if (dayOfMonth !== null) {
        next.setDate(dayOfMonth);
        // Handle "last day of month" (31)
        if (dayOfMonth === 31) {
          next = new Date(next.getFullYear(), next.getMonth() + 1, 0);
        }
      }
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + interval * 3);
      if (dayOfMonth !== null) {
        next.setDate(dayOfMonth);
        if (dayOfMonth === 31) {
          next = new Date(next.getFullYear(), next.getMonth() + 1, 0);
        }
      }
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + interval);
      if (dayOfMonth !== null) {
        next.setDate(dayOfMonth);
        // Handle Feb 29 on non-leap years
        if (dayOfMonth === 29 && next.getMonth() === 1 && next.getDate() === 28) {
          // Keep Feb 28
        }
      }
      break;
  }

  return next;
}