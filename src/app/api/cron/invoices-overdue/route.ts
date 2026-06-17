/**
 * Overdue invoice cron.
 *
 *   GET /api/cron/invoices-overdue
 *
 * Intended to be called by an external cron service once per day.
 * Walks every invoice whose status is `sent` and whose `due_date` is in
 * the past, flips it to `overdue`, notifies the freelancer, and (for
 * invoices exactly N days overdue: 1, 7, 14) emails the client a polite
 * reminder.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Idempotency: marking `overdue → overdue` is a no-op; the reminder
 * email uses an `idempotencyKey` keyed on `${invoiceId}:${daysOverdue}`
 * so retries on the same day cannot duplicate the email.
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

/** Days-overdue thresholds at which we send a reminder. */
const REMINDER_DAYS = new Set<number>([1, 7, 14]);

interface InvoiceForCron {
  id: string;
  user_id: string;
  client_id: string | null;
  invoice_number: string;
  currency: string;
  total_amount: number;
  due_date: string | null;
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
  const today = new Date();
  // Use UTC midnight as the cut-off so we don't keep flipping the same
  // invoice on every cron run if it's already past due.
  const todayIso = today.toISOString().slice(0, 10);

  // 1) Pull invoices that are sent but past due. We use a generous page
  //    size; freelancers won't have millions of these. If we ever do,
  //    paginate.
  const { data: rows, error } = await admin
    .from("invoices")
    .select(
      "id, user_id, client_id, invoice_number, currency, total_amount, due_date, public_token, status",
    )
    .in("status", ["sent", "viewed"])
    .lt("due_date", todayIso)
    .limit(1000);

  if (error) {
    log.error("cron.invoices_overdue.query_failed", { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const invoices = (rows ?? []) as unknown as InvoiceForCron[];
  let flipped = 0;
  let remindersSent = 0;
  let remindersFailed = 0;

  for (const inv of invoices) {
    if (!inv.due_date) continue;

    // ---- Flip status to overdue (idempotent) ------------------------------
    if (inv.status !== "overdue") {
      const { error: upErr } = await admin
        .from("invoices")
        .update({ status: "overdue" } as never)
        .eq("id", inv.id);
      if (upErr) {
        log.warn("cron.invoices_overdue.flip_failed", {
          invoiceId: inv.id,
          error: upErr.message,
        });
        continue;
      }
      flipped += 1;

      // Notify the freelancer once, when it first becomes overdue.
      await admin.from("notifications").insert({
        user_id: inv.user_id,
        type: "invoice_overdue",
        title: `Invoice ${inv.invoice_number} is overdue`,
        message: `Due ${inv.due_date} · ${inv.currency} ${inv.total_amount}`,
      } as never);
      await admin.from("activity_events").insert({
        user_id: inv.user_id,
        kind: "invoice_overdue",
        entity_type: "invoice",
        entity_id: inv.id,
        title: `Invoice ${inv.invoice_number} marked overdue`,
        metadata: {
          due_date: inv.due_date,
          amount: Number(inv.total_amount),
          currency: inv.currency,
        },
      } as never);
    }

    // ---- Optional reminder email -----------------------------------------
    const daysOverdue = daysBetween(inv.due_date, todayIso);
    if (!REMINDER_DAYS.has(daysOverdue)) continue;
    if (!inv.public_token || !inv.client_id) continue;

    // Resolve client + freelancer identity. The receipt action does this
    // too — we duplicate it minimally here to keep the cron self-contained.
    const { data: client } = await admin
      .from("clients")
      .select("email, full_name")
      .eq("id", inv.client_id)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    if (!c?.email) continue;

    const { data: profile } = await admin
      .from("user_profiles")
      .select("business_name, legal_name, full_name, email, notification_preferences")
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

    // Respect the freelancer's "send overdue reminders" preference. They
    // can opt out entirely from settings.
    if (p?.notification_preferences?.emailInvoiceOverdue === false) {
      continue;
    }

    const senderName =
      p?.business_name ?? p?.legal_name ?? p?.full_name ?? "Stackivo";
    const amountFormatted = formatCurrency(
      Number(inv.total_amount) || 0,
      inv.currency,
    );

    const rendered = renderInvoiceReminderEmail({
      invoiceNumber: inv.invoice_number,
      amountFormatted,
      dueDate: inv.due_date,
      clientName: c.full_name ?? "there",
      senderName,
      senderEmail: getEmailSender("billing").email,
      message: null,
      publicUrl: getInvoiceShareUrl(inv.public_token),
      daysOverdue,
      // The last threshold in REMINDER_DAYS is framed as the final notice;
      // no further client reminders are sent after it.
      finalNotice: daysOverdue >= Math.max(...REMINDER_DAYS),
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
      metadata: { invoiceId: inv.id, daysOverdue },
      tags: ["invoice_reminder", "billing"],
      // Critical: keyed on the *day-stamp* so a re-run of the cron on
      // the same day cannot re-send the reminder.
      idempotencyKey: `invoice-reminder:${inv.id}:d${daysOverdue}`,
    });

    if (dispatch.ok) {
      remindersSent += 1;
    } else {
      remindersFailed += 1;
      log.warn("cron.invoices_overdue.reminder_failed", {
        invoiceId: inv.id,
        error: dispatch.error,
      });
    }
  }

  log.info("cron.invoices_overdue.summary", {
    scanned: invoices.length,
    flipped,
    remindersSent,
    remindersFailed,
  });

  return NextResponse.json({
    ok: true,
    scanned: invoices.length,
    flipped,
    remindersSent,
    remindersFailed,
    time: new Date().toISOString(),
  });
}

function daysBetween(dueIso: string, todayIso: string): number {
  const due = Date.parse(dueIso);
  const today = Date.parse(todayIso);
  if (Number.isNaN(due) || Number.isNaN(today)) return 0;
  return Math.max(0, Math.floor((today - due) / 86_400_000));
}

function formatCurrency(value: number, currency: string): string {
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${amount}`;
}
