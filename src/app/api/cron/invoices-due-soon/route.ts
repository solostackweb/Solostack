/**
 * Pre-due invoice reminder cron.
 *
 *   GET /api/cron/invoices-due-soon
 *
 * Runs once per day. Finds every invoice whose `due_date` is 3 days or
 * 1 day away and whose status is `sent` or `viewed`, then emails the
 * client a friendly pre-due heads-up.
 *
 * This is the complement of `invoices-overdue`, which fires AFTER the
 * due date. Together they bracket the due date:
 *   Day -3, -1 → due-soon emails (this route)
 *   Day +1, +7, +14 → overdue reminders (invoices-overdue route)
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Idempotency: the `dispatchDelivery` idempotencyKey is keyed on
 * `invoice-due-soon:${invoiceId}:${dueDate}` so a retry on the same
 * day cannot duplicate the email.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { dispatchDelivery } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { renderInvoiceReminderEmail } from "@/features/email/templates";
import { getInvoiceShareUrl } from "@/features/documents/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InvoiceForDueSoon {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  currency: string;
  total_amount: number;
  due_date: string;
  public_token: string | null;
  status: string;
}

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = getAdminSupabase();

  // Pre-due reminders fire at D-3 and D-1 (3 days before and the day before
  // the due date). Compute both target date strings (UTC) and match due_date
  // against either.
  const todayIso = new Date().toISOString().slice(0, 10);
  const targetDates = [1, 3].map((offset) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });

  const { data: rows, error } = await admin
    .from("invoices")
    .select(
      "id, user_id, client_id, invoice_number, currency, total_amount, due_date, public_token, status",
    )
    .in("status", ["sent", "viewed"])
    .in("due_date", targetDates)
    .limit(1000);

  if (error) {
    log.error("cron.invoices_due_soon.query_failed", { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const invoices = (rows ?? []) as unknown as InvoiceForDueSoon[];
  let remindersSent = 0;
  let remindersFailed = 0;
  let skipped = 0;

  for (const inv of invoices) {
    if (!inv.public_token || !inv.client_id) {
      skipped += 1;
      continue;
    }

    const { data: client } = await admin
      .from("clients")
      .select("email, full_name")
      .eq("id", inv.client_id)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    if (!c?.email) {
      skipped += 1;
      continue;
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select(
        "business_name, legal_name, full_name, email, notification_preferences",
      )
      .eq("id", inv.user_id)
      .maybeSingle();
    const p = profile as
      | {
          business_name?: string | null;
          legal_name?: string | null;
          full_name?: string | null;
          email?: string | null;
          notification_preferences?: { emailInvoiceOverdue?: boolean } | null;
        }
      | null;

    // Respect the same opt-out flag as the overdue reminders. If a
    // freelancer has turned off overdue emails, we also skip pre-due.
    if (p?.notification_preferences?.emailInvoiceOverdue === false) {
      skipped += 1;
      continue;
    }

    const senderName =
      p?.business_name ?? p?.legal_name ?? p?.full_name ?? "Stackivo";
    const amountFormatted = formatCurrency(
      Number(inv.total_amount) || 0,
      inv.currency,
    );

    // Negative daysOverdue signals a pre-due heads-up: -1 = due tomorrow,
    // -3 = due in 3 days. Derived from this invoice's own due date.
    const daysUntil = daysBetween(todayIso, inv.due_date);
    const rendered = renderInvoiceReminderEmail({
      invoiceNumber: inv.invoice_number,
      amountFormatted,
      dueDate: inv.due_date,
      clientName: c.full_name ?? "there",
      senderName,
      senderEmail: getEmailSender("billing").email,
      message: null,
      publicUrl: getInvoiceShareUrl(inv.public_token),
      daysOverdue: -daysUntil,
    });

    const dispatch = await dispatchDelivery({
      userId: inv.user_id,
      kind: "invoice_reminder",
      entityType: "invoice",
      senderType: "billing",
      entityId: inv.id,
      to: { email: c.email, name: c.full_name ?? undefined },
      replyTo: p?.email ? { email: p.email, name: senderName } : undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      metadata: { invoiceId: inv.id, daysOverdue: -daysUntil, dueDate: inv.due_date },
      tags: ["invoice_due_soon", "billing"],
      // Keyed on invoice + due_date + offset so the D-3 and D-1 reminders are
      // distinct, while a same-day cron rerun cannot double-send either one.
      idempotencyKey: `invoice-due-soon:${inv.id}:${inv.due_date}:d${daysUntil}`,
    });

    if (dispatch.ok) {
      remindersSent += 1;
    } else {
      remindersFailed += 1;
      log.warn("cron.invoices_due_soon.reminder_failed", {
        invoiceId: inv.id,
        error: dispatch.error,
      });
    }
  }

  log.info("cron.invoices_due_soon.summary", {
    targetDates,
    scanned: invoices.length,
    remindersSent,
    remindersFailed,
    skipped,
  });

  return NextResponse.json({
    ok: true,
    targetDates,
    scanned: invoices.length,
    remindersSent,
    remindersFailed,
    skipped,
    time: new Date().toISOString(),
  });
}

function formatCurrency(value: number, currency: string): string {
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${amount}`;
}

/** Whole days from `fromIso` to `toIso` (UTC midnights). */
function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}
