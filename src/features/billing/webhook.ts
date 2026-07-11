import "server-only";

/**
 * Razorpay webhook event router.
 *
 * Idempotency: every event is logged into `billing_events` keyed on the
 * Razorpay event id. Repeats are no-ops. Errors are written back onto
 * the row so retries are debuggable.
 *
 * Auth: callers must verify the HMAC signature BEFORE invoking
 * `handleRazorpayEvent` (see `./razorpay/webhook-verify`).
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  BillingEventRow,
  BillingPaymentRow,
  SubscriptionRow,
} from "@/lib/supabase/types";
import {
  fetchInvoice,
  fetchPayment,
  fetchSubscription,
  type RazorpayPayment,
  type RazorpaySubscription,
} from "./razorpay/client";
import { syncSubscriptionFromRazorpay } from "./server";

interface WebhookEnvelope {
  entity: "event";
  event: string;
  account_id?: string;
  contains?: string[];
  payload: Record<
    string,
    {
      entity: Record<string, unknown> & { id?: string };
    }
  >;
  created_at: number;
}

/**
 * Process a verified Razorpay webhook payload.
 *
 * Returns `{ ok: true }` for every event, even unknown ones — Razorpay
 * retries on non-2xx, and we don't want to retry events we genuinely
 * don't care about. Specific failures bubble up as thrown errors so the
 * route handler can return 500 and trigger Razorpay's retry queue.
 */
export async function handleRazorpayEvent(args: {
  eventId: string;
  rawBody: string;
}): Promise<{ ok: true; deduplicated?: boolean }> {
  const admin = getAdminSupabase();

  let event: WebhookEnvelope;
  try {
    event = JSON.parse(args.rawBody) as WebhookEnvelope;
  } catch {
    throw new Error("Invalid JSON in webhook body");
  }

  // --- Idempotency log ----------------------------------------------------
  const { data: existing } = await admin
    .from("billing_events")
    .select("id, processed_at")
    .eq("event_id", args.eventId)
    .maybeSingle();
  const existingRow = existing as Pick<BillingEventRow, "id" | "processed_at"> | null;
  if (existingRow?.processed_at) {
    return { ok: true, deduplicated: true };
  }

  let logId = existingRow?.id;
  if (!logId) {
    const { data: inserted } = await admin
      .from("billing_events")
      .insert({
        event_id: args.eventId,
        event_type: event.event,
        payload: event as unknown as BillingEventRow["payload"],
      } as never)
      .select("id")
      .single();
    logId = (inserted as { id: string } | null)?.id;
  }

  try {
    await dispatch(event);
    if (logId) {
      await admin
        .from("billing_events")
        .update({ processed_at: new Date().toISOString(), error: null } as never)
        .eq("id", logId);
    }
    return { ok: true };
  } catch (err) {
    if (logId) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("billing_events")
        .update({ error: message } as never)
        .eq("id", logId);
    }
    throw err;
  }
}

// --- Dispatcher ------------------------------------------------------------

async function dispatch(event: WebhookEnvelope): Promise<void> {
  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.completed":
    case "subscription.cancelled":
    case "subscription.paused":
    case "subscription.resumed":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.updated": {
      const sub = (event.payload.subscription?.entity as unknown as
        | RazorpaySubscription
        | undefined) ?? null;
      if (sub?.id) await syncSubscriptionFromRazorpay(sub);
      // For `charged` events the embedded subscription may be stale —
      // pull the canonical state to be safe.
      if (sub?.id && event.event === "subscription.charged") {
        const fresh = await fetchSubscription(sub.id);
        await syncSubscriptionFromRazorpay(fresh);
      }
      // Record the captured payment if present.
      if (event.payload.payment?.entity) {
        await persistPayment(
          event.payload.payment.entity as unknown as RazorpayPayment,
        );
      }
      return;
    }

    case "payment.captured":
    case "payment.failed":
    case "payment.authorized": {
      const payment = event.payload.payment?.entity as unknown as
        | RazorpayPayment
        | undefined;
      if (!payment) return;
      // Backstop for the Stackivo Managed invoice flow: orders we create
      // tag `notes.flow = "invoice_managed"`. If the payer's browser
      // closed before the synchronous verify call ran, this webhook is
      // what flips the invoice to paid + generates the receipt. The
      // handler is idempotent — re-running it on a paid invoice is a
      // no-op.
      const notes = payment.notes ?? null;
      if (
        notes &&
        notes.flow === "invoice_managed" &&
        typeof notes.invoice_id === "string"
      ) {
        await applyInvoicePaymentEvent(payment, notes.invoice_id);
        return;
      }
      // Otherwise treat as a subscription / billing payment.
      await persistPayment(payment);
      return;
    }

    case "invoice.paid": {
      // An invoice always has an associated payment id — fetch & persist.
      const invoice = event.payload.invoice?.entity as unknown as
        | { payment_id?: string; subscription_id?: string }
        | undefined;
      if (invoice?.payment_id) {
        const payment = await fetchPayment(invoice.payment_id);
        await persistPayment(payment);
      }
      if (invoice?.subscription_id) {
        const fresh = await fetchSubscription(invoice.subscription_id);
        await syncSubscriptionFromRazorpay(fresh);
      }
      return;
    }

    case "virtual_account.credited": {
      // Smart Collect: client paid a per-invoice virtual UPI VPA.
      // Payload shape: { virtual_account: { entity: {...} }, payment: { entity: {...} } }
      const va = event.payload.virtual_account?.entity as unknown as
        | { id?: string; amount_paid?: number; status?: string }
        | undefined;
      const payment = event.payload.payment?.entity as unknown as
        | RazorpayPayment
        | undefined;
      if (!va?.id || !payment) return;
      await applySmartCollectPayment(va.id, payment);
      return;
    }

    default:
      // Unknown / uninteresting event — log only.
      return;
  }
}

// --- Invoice-payment backstop ---------------------------------------------

/**
 * Idempotent webhook-side mirror of `verifyInvoicePaymentAction`.
 *
 * Called when a `payment.*` event arrives for an order tagged
 * `notes.flow = "invoice_managed"`. The synchronous verify path in the
 * checkout flow has usually already done this work — but if the payer
 * closed the tab mid-flow, this is what gets the invoice to `paid`.
 *
 * Lives here (rather than in the invoices feature) because all webhook
 * fan-out runs through this dispatcher; the dynamic import keeps the
 * subscription path's bundle small.
 */
async function applyInvoicePaymentEvent(
  p: RazorpayPayment,
  invoiceId: string,
): Promise<void> {
  // Only act on captured payments. Failed / authorized events are logged
  // as attempts but don't move the invoice.
  if (p.status !== "captured") {
    await recordAttempt(p, invoiceId, p.status === "failed" ? "failed" : "authorized");
    return;
  }

  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select(
      "id, user_id, client_id, invoice_number, currency, total_amount, status",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  const invoice = invoiceRow as
    | {
        id: string;
        user_id: string;
        client_id: string | null;
        invoice_number: string;
        currency: string;
        total_amount: number;
        status: string;
      }
    | null;
  if (!invoice) return;

  // Record the attempt regardless — useful for reconciliation.
  await recordAttempt(p, invoiceId, "captured");

  if (invoice.status === "paid") {
    // Synchronous verify path already handled it; nothing more to do.
    return;
  }

  const paidAtIso = new Date(p.created_at * 1000).toISOString();
  const total = Number(invoice.total_amount);

  await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: paidAtIso,
      payment_status: "captured",
      payment_method: "razorpay",
      payment_method_used: "stackivo_managed",
      payment_reference: p.id,
      payment_amount: total,
      payment_recorded_at: paidAtIso,
    } as never)
    .eq("id", invoice.id)
    .neq("status", "paid");

  // Receipt — lazy import to keep this module's compile graph tight.
  let payerEmail: string | null = null;
  let payerName: string | null = null;
  if (invoice.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("email, full_name")
      .eq("id", invoice.client_id)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    payerEmail = c?.email ?? null;
    payerName = c?.full_name ?? null;
  }
  try {
    const { generateReceiptForInvoice } = await import(
      "@/features/invoices/receipts"
    );
    await generateReceiptForInvoice({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      paymentMethod: "stackivo_managed",
      amount: total,
      currency: invoice.currency,
      paidAt: paidAtIso,
      payerEmail,
      payerName,
      reference: p.id,
    });
  } catch {
    /* receipt generation failure is non-fatal — the row exists; receipt can be regenerated. */
  }

  // Activity + notification + receipt email.
  await admin.from("activity_events").insert({
    user_id: invoice.user_id,
    kind: "invoice_paid",
    entity_type: "invoice",
    entity_id: invoice.id,
    title: `Invoice ${invoice.invoice_number} paid`,
    metadata: {
      via: "webhook_backstop",
      payment_id: p.id,
      amount: total,
      currency: invoice.currency,
    },
  } as never);
  await admin.from("notifications").insert({
    user_id: invoice.user_id,
    type: "invoice_paid",
    title: `Invoice ${invoice.invoice_number} paid`,
    message: `Payment captured. Payout in 1-2 business days.`,
  } as never);
  if (payerEmail) {
    const { sendInvoiceReceiptAction } = await import(
      "@/features/invoices/delivery"
    );
    void sendInvoiceReceiptAction({
      invoiceId: invoice.id,
      toEmail: payerEmail,
      toName: payerName,
    });
  }
}

// --- Smart Collect payment handler ----------------------------------------

/**
 * Handles `virtual_account.credited` — a client paid a per-invoice virtual
 * UPI VPA created by Smart Collect. Marks the invoice paid and closes the VA.
 */
async function applySmartCollectPayment(
  virtualAccountId: string,
  p: RazorpayPayment,
): Promise<void> {
  // Resolve the invoice from the virtual account id.
  const { resolveVirtualAccountInvoice, closeInvoiceVirtualAccount } =
    await import("./razorpay/smart-collect");

  const invoiceId = await resolveVirtualAccountInvoice(virtualAccountId);
  if (!invoiceId) return; // VA not tracked — probably not ours.

  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select(
      "id, user_id, client_id, invoice_number, currency, total_amount, status",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  const invoice = invoiceRow as {
    id: string;
    user_id: string;
    client_id: string | null;
    invoice_number: string;
    currency: string;
    total_amount: number;
    status: string;
  } | null;
  if (!invoice) return;

  // Record attempt regardless.
  await recordAttempt(p, invoiceId, p.status === "captured" ? "captured" : "failed", "upi_smart");

  if (invoice.status === "paid") return; // Already handled.

  if (p.status !== "captured") return; // Only act on captured.

  const paidAtIso = new Date(p.created_at * 1000).toISOString();
  const total = Number(invoice.total_amount);

  await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: paidAtIso,
      payment_status: "captured",
      payment_method: "upi",
      payment_method_used: "upi_smart",
      payment_reference: p.id,
      payment_amount: total,
      payment_recorded_at: paidAtIso,
    } as never)
    .eq("id", invoice.id)
    .neq("status", "paid");

  // Close the virtual account so it can't receive duplicate payments.
  await closeInvoiceVirtualAccount(invoiceId);

  // Receipt + notification.
  let payerEmail: string | null = null;
  let payerName: string | null = null;
  if (invoice.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("email, full_name")
      .eq("id", invoice.client_id)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    payerEmail = c?.email ?? null;
    payerName = c?.full_name ?? null;
  }

  try {
    const { generateReceiptForInvoice } = await import(
      "@/features/invoices/receipts"
    );
    await generateReceiptForInvoice({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      paymentMethod: "upi_smart",
      amount: total,
      currency: invoice.currency,
      paidAt: paidAtIso,
      payerEmail,
      payerName,
      reference: p.id,
    });
  } catch {
    /* receipt generation failure is non-fatal */
  }

  await admin.from("activity_events").insert({
    user_id: invoice.user_id,
    kind: "invoice_paid",
    entity_type: "invoice",
    entity_id: invoice.id,
    title: `Invoice ${invoice.invoice_number} paid`,
    metadata: {
      via: "smart_collect",
      payment_id: p.id,
      amount: total,
      currency: invoice.currency,
    },
  } as never);

  await admin.from("notifications").insert({
    user_id: invoice.user_id,
    type: "invoice_paid",
    title: `Invoice ${invoice.invoice_number} paid`,
    message: `UPI payment received. Payout in 1-2 business days.`,
  } as never);

  if (payerEmail) {
    const { sendInvoiceReceiptAction } = await import(
      "@/features/invoices/delivery"
    );
    void sendInvoiceReceiptAction({
      invoiceId: invoice.id,
      toEmail: payerEmail,
      toName: payerName,
    });
  }
}

async function recordAttempt(
  p: RazorpayPayment,
  invoiceId: string,
  status: "created" | "authorized" | "captured" | "failed" | "refunded",
  paymentMethod: "stackivo_managed" | "upi_smart" | "upi_manual" = "stackivo_managed",
): Promise<void> {
  const admin = getAdminSupabase();
  await admin
    .from("invoice_payment_attempts")
    .upsert(
      {
        invoice_id: invoiceId,
        user_id: (p.notes?.user_id as string | undefined) ?? "",
        razorpay_order_id: p.order_id,
        razorpay_payment_id: p.id,
        amount: p.amount / 100,
        currency: p.currency,
        status,
        payment_method: paymentMethod,
        payout_status: status === "captured" ? "pending" : "not_applicable",
        error_code: p.error_code ?? null,
        error_description: p.error_description ?? null,
      } as never,
      { onConflict: "razorpay_payment_id" },
    );
}

// --- Helpers ---------------------------------------------------------------

async function persistPayment(p: RazorpayPayment): Promise<void> {
  const admin = getAdminSupabase();

  // Resolve the user from the linked subscription, if any.
  let userId: string | null = null;
  let subscriptionRowId: string | null = null;
  let razorpaySubscriptionId: string | null = null;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let discountAmount = 0;

  // Razorpay payments include `notes.user_id` when we set it on the parent
  // subscription. Fall back to looking up via the subscription row.
  if (p.notes && typeof p.notes.user_id === "string") {
    userId = p.notes.user_id;
  }

  // payments tied to a subscription have `invoice_id` populated; the invoice
  // exposes the subscription_id we can use to look up the row.
  if (p.invoice_id) {
    try {
      const invoice = await fetchInvoice(p.invoice_id);
      razorpaySubscriptionId = invoice.subscription_id ?? null;
    } catch {
      // Keep the older fallback below; webhook retries will repair this later.
    }
  }

  if (razorpaySubscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id, user_id, razorpay_subscription_id, coupon_id, coupon_code, coupon_discount_amount")
      .eq("razorpay_subscription_id", razorpaySubscriptionId)
      .maybeSingle();
    const row = data as Pick<
      SubscriptionRow,
      | "id"
      | "user_id"
      | "razorpay_subscription_id"
      | "coupon_id"
      | "coupon_code"
      | "coupon_discount_amount"
    > | null;
    if (row) {
      userId = userId ?? row.user_id;
      subscriptionRowId = row.id;
      razorpaySubscriptionId = row.razorpay_subscription_id;
      couponId = row.coupon_id;
      couponCode = row.coupon_code;
      discountAmount = row.coupon_discount_amount ?? 0;
    }
  }

  if (!userId) {
    // Nothing to attribute the payment to. Skip rather than corrupt.
    return;
  }

  const row: Partial<BillingPaymentRow> &
    Pick<BillingPaymentRow, "user_id" | "razorpay_payment_id" | "amount" | "status"> = {
    user_id: userId,
    subscription_row_id: subscriptionRowId,
    razorpay_payment_id: p.id,
    razorpay_order_id: p.order_id,
    razorpay_subscription_id: razorpaySubscriptionId,
    razorpay_invoice_id: p.invoice_id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    method: p.method ?? null,
    card_last4: p.card?.last4 ?? null,
    card_network: p.card?.network ?? null,
    description: p.description ?? null,
    error_code: p.error_code ?? null,
    error_description: p.error_description ?? null,
    coupon_id: couponId,
    coupon_code: couponCode,
    discount_amount: discountAmount,
    captured_at:
      p.status === "captured" ? new Date(p.created_at * 1000).toISOString() : null,
  };

  // Upsert keyed on the unique `razorpay_payment_id`.
  await admin
    .from("billing_payments")
    .upsert(row as never, { onConflict: "razorpay_payment_id" });

  // On capture, update the user's last_payment_at for the dashboard.
  if (p.status === "captured" && userId) {
    await admin
      .from("subscriptions")
      .update({
        last_payment_at: new Date(p.created_at * 1000).toISOString(),
      } as never)
      .eq("user_id", userId);

    if (couponId && razorpaySubscriptionId) {
      const { data: redemptionBefore } = await admin
        .from("billing_coupon_redemptions")
        .select("status")
        .eq("razorpay_subscription_id", razorpaySubscriptionId)
        .maybeSingle();
      const wasPaid =
        (redemptionBefore as { status?: string } | null)?.status === "paid";

      await admin
        .from("billing_coupon_redemptions")
        .update({
          status: "paid",
          paid_at: new Date(p.created_at * 1000).toISOString(),
        } as never)
        .eq("razorpay_subscription_id", razorpaySubscriptionId);

      if (!wasPaid) {
        await admin.rpc("increment_coupon_redemption", {
          p_coupon_id: couponId,
        } as never);
      }
    }
  }
}
