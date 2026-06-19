/**
 * Subscription renewal reminder cron.
 *
 *   GET /api/cron/subscription-renewals
 *
 * Runs once per day. Finds active autopay subscriptions whose next charge is
 * ~3 days away and emails the user a courtesy heads-up (amount, date, manage/
 * cancel link). The mandatory 24h pre-debit notification is sent by Razorpay
 * (the payment aggregator); this is an earlier, additional reminder.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`. Idempotency keyed on
 * `sub-renewal:${id}:${nextChargeDate}` so same-day reruns can't double-send.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { dispatchDelivery } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { renderSubscriptionRenewalEmail } from "@/features/email/templates";
import { getPublicAppUrl } from "@/features/documents/urls";
import { PLANS } from "@/features/subscription/plans";

import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How many days before the charge we send the courtesy reminder. */
const REMINDER_LEAD_DAYS = 3;

interface SubRow {
  id: string;
  user_id: string;
  plan: "free" | "pro" | "business";
  billing_cycle: "monthly" | "yearly";
  next_charge_at: string | null;
}

function formatCurrencyPaise(paise: number): string {
  const amount = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(paise / 100);
  return `INR ${amount}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) return new NextResponse("Not configured", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = getAdminSupabase();

  const startedAtMs = Date.now();

  // Target window: the whole UTC day that is REMINDER_LEAD_DAYS from now.
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + REMINDER_LEAD_DAYS);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const { data: rows, error } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, billing_cycle, next_charge_at")
    .eq("status", "active")
    .eq("cancel_at_period_end", false)
    .neq("plan", "free")
    .not("razorpay_subscription_id", "is", null)
    .gte("next_charge_at", start.toISOString())
    .lt("next_charge_at", end.toISOString())
    .limit(1000);

  if (error) {
    log.error("cron.subscription_renewals.query_failed", { error: error.message });
    await recordCronRun({ job: "subscription-renewals", status: "error", startedAtMs, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const subs = (rows ?? []) as unknown as SubRow[];
  const manageUrl = `${getPublicAppUrl()}/dashboard/settings/billing`;
  const billingEmail = getEmailSender("billing").email;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const sub of subs) {
    if (!sub.next_charge_at) {
      skipped += 1;
      continue;
    }
    const { data: profile } = await admin
      .from("user_profiles")
      .select("business_email, email, full_name")
      .eq("id", sub.user_id)
      .maybeSingle();
    const p = profile as
      | { business_email?: string | null; email?: string | null; full_name?: string | null }
      | null;
    const to = p?.business_email ?? p?.email ?? null;
    if (!to) {
      skipped += 1;
      continue;
    }

    const planDef = PLANS[sub.plan];
    const pricePaise =
      sub.billing_cycle === "yearly"
        ? planDef.priceYearlyPaise ?? 0
        : planDef.priceMonthlyPaise ?? 0;

    const rendered = renderSubscriptionRenewalEmail({
      planName: planDef.name,
      amountFormatted: formatCurrencyPaise(pricePaise),
      renewsOn: formatDay(sub.next_charge_at),
      manageUrl,
      senderEmail: billingEmail,
    });

    const dispatch = await dispatchDelivery({
      userId: sub.user_id,
      kind: "custom",
      entityType: "system",
      senderType: "billing",
      entityId: sub.id,
      to: { email: to, name: p?.full_name ?? undefined },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      metadata: { subscriptionId: sub.id, nextChargeAt: sub.next_charge_at },
      tags: ["subscription_renewal", "billing"],
      idempotencyKey: `sub-renewal:${sub.id}:${sub.next_charge_at.slice(0, 10)}`,
    });

    if (dispatch.ok) sent += 1;
    else {
      failed += 1;
      log.warn("cron.subscription_renewals.send_failed", {
        subscriptionId: sub.id,
        error: dispatch.error,
      });
    }
  }

  log.info("cron.subscription_renewals.summary", {
    window: start.toISOString().slice(0, 10),
    scanned: subs.length,
    sent,
    failed,
    skipped,
  });

  await recordCronRun({ job: "subscription-renewals", status: "ok", startedAtMs });
  return NextResponse.json({
    ok: true,
    scanned: subs.length,
    sent,
    failed,
    skipped,
    time: new Date().toISOString(),
  });
}
