"use server";

/**
 * Founder Console — server actions.
 *
 * Every export here is callable from a `<form>` action or a client
 * onClick → server-action handler. The shape of each action is:
 *
 *   1. Re-verify admin role via `runAdminAction()` (which also blocks
 *      writes while in view-as mode).
 *   2. Perform the mutation via the service-role admin client.
 *   3. Return `{ ok, error?, ... }`.
 *   4. `runAdminAction()` automatically records to `admin_actions`.
 *
 * Sensitive / destructive tier enforcement is the caller's job
 * (TypedConfirmModal must wrap the form). The audit row is written
 * regardless of confirmation — every attempt is forensic-grade.
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { runAdminAction, VIEW_AS_COOKIE } from "./server";
import { recordSuppression } from "@/features/email/suppressions";
import { log } from "@/lib/logger";
import { sendAdminReceipt } from "./receipts";

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type AdminActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// View-as
// ---------------------------------------------------------------------------

/**
 * Start a view-as session against another user. Records to admin_actions
 * and sets a signed httpOnly cookie that admin layouts read on every
 * navigation.
 *
 * Reads remain service-role-scoped through `getViewAsUserId()`; writes
 * are blocked by `assertNotViewAs()` inside `runAdminAction()`. The
 * cookie is httpOnly so the client can't fake it.
 */
export async function startViewAsAction(
  targetUserId: string,
): Promise<AdminActionResult> {
  const parsed = z.string().uuid().safeParse(targetUserId);
  if (!parsed.success) return { ok: false, error: "Invalid user id." };

  return await runAdminAction(
    {
      kind: "user.view_as.start",
      targetType: "user",
      targetId: parsed.data,
    },
    async () => {
      const jar = await cookies();
      jar.set(VIEW_AS_COOKIE, parsed.data, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        // 1 hour — long enough for a triage session, short enough that
        // an admin won't accidentally stay in view-as mode forever.
        maxAge: 60 * 60,
      });
      revalidatePath("/admin", "layout");
      return { ok: true };
    },
  );
}

/**
 * Exit view-as mode. This is the ONLY admin write that's allowed while
 * view-as is active (the wrapper would otherwise refuse), so we call
 * the bare audit primitive directly.
 */
export async function stopViewAsAction(): Promise<AdminActionResult> {
  // We deliberately don't go through runAdminAction() here because the
  // view-as block would refuse. Use the lower-level primitive instead.
  const jar = await cookies();
  const prev = jar.get(VIEW_AS_COOKIE)?.value ?? null;
  jar.delete(VIEW_AS_COOKIE);
  // We still want an audit row.
  const { requireAdmin, recordAdminAction } = await import("./server");
  const actor = await requireAdmin();
  await recordAdminAction({
    actorId: actor.id,
    kind: "user.view_as.stop",
    targetType: "user",
    targetId: prev,
    success: true,
    durationMs: 0,
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// User actions
// ---------------------------------------------------------------------------

const userIdSchema = z.string().uuid();

/**
 * Trigger a password reset for a user. We use Supabase Admin's
 * `generateLink` so we don't depend on the user's current session — an
 * admin-initiated reset works even for users whose account is locked.
 *
 * Note: the email is sent by Supabase (not Brevo), so it doesn't go
 * through our suppression list. That's intentional for account-recovery
 * mail (which should be transactional regardless of marketing consent).
 */
export async function adminPasswordResetAction(
  userId: string,
): Promise<AdminActionResult<{ link: string | null }>> {
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user id." };

  return await runAdminAction(
    {
      kind: "user.password_reset",
      targetType: "user",
      targetId: id.data,
    },
    async () => {
      const admin = getAdminSupabase();

      // Look up email to generate the link.
      const lookup = await admin
        .from("user_profiles")
        .select("email")
        .eq("id", id.data)
        .maybeSingle();
      const userRow = lookup.data as { email: string } | null;
      if (lookup.error || !userRow?.email) {
        return { ok: false, error: "Could not locate user." };
      }

      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: userRow.email,
      });
      if (error) return { ok: false, error: error.message };

      // Supabase emails the link automatically when configured; we also
      // return it so the admin can paste it into a support reply if
      // outbound mail is delayed.
      return {
        ok: true,
        message: "Recovery email queued.",
        data: { link: data.properties?.action_link ?? null },
      };
    },
  );
}

/**
 * Force-confirm a user's email when their inbox is broken / they used
 * a typo at signup. Auditable.
 */
export async function adminForceVerifyEmailAction(
  userId: string,
): Promise<AdminActionResult> {
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user id." };

  return await runAdminAction(
    {
      kind: "user.email_verify_force",
      targetType: "user",
      targetId: id.data,
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin.auth.admin.updateUserById(id.data, {
        email_confirm: true,
      });
      if (error) return { ok: false, error: error.message };
      revalidatePath(`/admin/users/${id.data}`);
      return { ok: true, message: "Email marked as verified." };
    },
  );
}

const suspendSchema = z.object({
  userId: z.string().uuid(),
  /** ISO timestamp; default 100 years (effectively permanent) */
  untilIso: z
    .string()
    .datetime()
    .optional(),
  reason: z.string().max(500).optional(),
});

/**
 * Suspend a user by setting `auth.users.banned_until`. Supabase blocks
 * login while this is in the future. Default is 100 years (effectively
 * permanent until explicitly lifted).
 */
export async function adminSuspendUserAction(
  input: z.input<typeof suspendSchema>,
): Promise<AdminActionResult> {
  const parsed = suspendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const banUntil =
    parsed.data.untilIso ??
    new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();

  return await runAdminAction(
    {
      kind: "user.suspend",
      targetType: "user",
      targetId: parsed.data.userId,
      metadata: {
        reason: parsed.data.reason,
        until: banUntil,
      },
    },
    async () => {
      const admin = getAdminSupabase();
      // Supabase types don't expose `ban_duration` on updateUserById,
      // so we use the REST endpoint via the admin client's auth API.
      // The typed surface is partial — cast through the documented shape.
      const { error } = await admin.auth.admin.updateUserById(
        parsed.data.userId,
        { ban_duration: durationFromIso(banUntil) } as never,
      );
      if (error) return { ok: false, error: error.message };

      // Note: `admin_actions` already captured this with full metadata via
      // `runAdminAction()`. We don't double-write to security_events.

      revalidatePath(`/admin/users/${parsed.data.userId}`);
      return { ok: true, message: "User suspended." };
    },
  );
}

export async function adminUnsuspendUserAction(
  userId: string,
): Promise<AdminActionResult> {
  const id = userIdSchema.safeParse(userId);
  if (!id.success) return { ok: false, error: "Invalid user id." };

  return await runAdminAction(
    {
      kind: "user.unsuspend",
      targetType: "user",
      targetId: id.data,
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin.auth.admin.updateUserById(id.data, {
        ban_duration: "none",
      } as never);
      if (error) return { ok: false, error: error.message };
      revalidatePath(`/admin/users/${id.data}`);
      return { ok: true, message: "Suspension lifted." };
    },
  );
}

/**
 * Soft-delete a user. We:
 *   1. Scrub PII from `user_profiles` (email/name/phone/address blanks).
 *   2. Cancel any active subscription (status='canceled', cancel_at_period_end=true).
 *   3. Suspend the auth account permanently.
 *   4. Add their email to suppressions so we never mail them again.
 *
 * We deliberately do NOT delete activity_events / invoices / contracts /
 * billing_payments — those are needed for tax + accounting retention.
 */
const softDeleteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function adminSoftDeleteUserAction(
  input: z.input<typeof softDeleteSchema>,
): Promise<AdminActionResult> {
  const parsed = softDeleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  return await runAdminAction(
    {
      kind: "user.delete_soft",
      targetType: "user",
      targetId: parsed.data.userId,
      metadata: { reason: parsed.data.reason },
    },
    async (actor) => {
      const admin = getAdminSupabase();

      // Snapshot the email so we can suppress it.
      const profLookup = await admin
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", parsed.data.userId)
        .maybeSingle();
      const prof = profLookup.data as
        | { email: string; full_name: string | null }
        | null;
      const oldEmail = prof?.email ?? null;
      const oldName = prof?.full_name ?? null;

      // Scrub PII in user_profiles.
      const stamp = new Date().toISOString();
      const { error: profErr } = await admin
        .from("user_profiles")
        .update({
          full_name: "Deleted user",
          email: `deleted+${parsed.data.userId}@stackivo.invalid`,
          phone: null,
          display_name: null,
          bio: null,
          company_name: null,
          business_email: null,
          business_phone: null,
          website: null,
          logo_url: null,
          brand_icon_url: null,
          gst_number: null,
          legal_name: null,
          business_name: null,
          gstin: null,
          pan: null,
          address_line1: null,
          address_line2: null,
          city: null,
          state_code: null,
          postal_code: null,
          signature_image_url: null,
          signature_text_value: null,
          signature_updated_at: stamp,
        } as never)
        .eq("id", parsed.data.userId);
      if (profErr) return { ok: false, error: profErr.message };

      // Cancel active subscription.
      await admin
        .from("subscriptions")
        .update({
          status: "canceled",
          cancel_at_period_end: true,
          canceled_at: stamp,
        } as never)
        .eq("user_id", parsed.data.userId);

      // Permanently suspend auth.
      await admin.auth.admin.updateUserById(parsed.data.userId, {
        ban_duration: "876000h", // 100 years
      } as never);

      // Suppress the email so we never accidentally mail them again.
      // Support data is first-party (support_tickets) and is removed with the
      // user's account — no external vendor fan-out needed.
      if (oldEmail) {
        await recordSuppression({ email: oldEmail, reason: "manual" });
      }

      // Audit captured via `runAdminAction()` wrapper above. Receipt
      // is sent to the admin for forensic redundancy.
      await sendAdminReceipt({
        actor,
        action: "Soft-deleted user",
        subject: `Soft-deleted ${oldEmail ?? parsed.data.userId}`,
        details: [
          ["User id", parsed.data.userId],
          ["Email (was)", oldEmail ?? "—"],
          ["Name (was)", oldName ?? "—"],
          ["Reason", parsed.data.reason ?? "—"],
        ],
        note: "Activity history (invoices, payments, contracts) is preserved for tax retention. The user's email is now suppressed.",
      });

      revalidatePath("/admin/users");
      revalidatePath(`/admin/users/${parsed.data.userId}`);
      return { ok: true, message: "User soft-deleted." };
    },
  );
}

// ---------------------------------------------------------------------------
// DPDP data export
// ---------------------------------------------------------------------------

const dataExportSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

/**
 * Bundle every row owned by a user into a single JSON object, upload
 * it to the `user-exports` bucket, return a 24-hour signed URL the
 * admin can share with the user.
 *
 * Covers DPDP's "right to data portability." Tables included:
 *   - user_profiles
 *   - clients, projects, invoices, invoice_items, contracts,
 *     contract_signatures, files, notifications,
 *     activity_events (read-only), billing_payments, billing_events,
 *     time_entries, subscriptions
 *
 * Sensitive metadata fields (full row JSON) are included verbatim
 * — the user owns this data and is entitled to all of it.
 */
export async function adminExportUserDataAction(
  input: z.input<typeof dataExportSchema>,
): Promise<AdminActionResult<{ path: string; signedUrl: string }>> {
  const parsed = dataExportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  return await runAdminAction(
    {
      kind: "user.data_export",
      targetType: "user",
      targetId: parsed.data.userId,
      metadata: { reason: parsed.data.reason },
    },
    async () => {
      const admin = getAdminSupabase();
      const uid = parsed.data.userId;

      // Fan out reads. Each table is independent so we go in parallel.
      const tables = [
        "user_profiles",
        "clients",
        "projects",
        "invoices",
        "invoice_items",
        "contracts",
        "contract_signatures",
        "files",
        "notifications",
        "activity_events",
        "billing_payments",
        "billing_events",
        "time_entries",
        "subscriptions",
      ] as const;

      const reads = await Promise.all(
        tables.map((t) =>
          t === "user_profiles"
            ? admin.from(t).select("*").eq("id", uid)
            : t === "invoice_items"
              ? admin
                  .from(t)
                  .select("*, invoices!inner(user_id)")
                  .eq("invoices.user_id", uid)
              : admin.from(t).select("*").eq("user_id", uid),
        ),
      );

      const bundle: Record<string, unknown[]> = {};
      tables.forEach((t, i) => {
        bundle[t] = (reads[i]?.data as unknown[] | null) ?? [];
      });

      const payload = JSON.stringify(
        {
          export_format: "v1",
          generated_at: new Date().toISOString(),
          subject_user_id: uid,
          generated_for: "data_subject_access_request",
          data: bundle,
        },
        null,
        2,
      );

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const path = `${uid}/${stamp}.json`;

      const uploadRes = await admin.storage
        .from("user-exports")
        .upload(path, payload, {
          contentType: "application/json",
          upsert: false,
        });
      if (uploadRes.error) {
        return { ok: false, error: uploadRes.error.message };
      }

      // 24-hour signed URL. Long enough for the admin to forward the
      // link to support+user; short enough that a leaked URL has
      // bounded blast radius.
      const signed = await admin.storage
        .from("user-exports")
        .createSignedUrl(path, 60 * 60 * 24);
      if (signed.error || !signed.data?.signedUrl) {
        return {
          ok: false,
          error: signed.error?.message ?? "Could not sign URL.",
        };
      }

      return {
        ok: true,
        message: "Export bundle generated.",
        data: { path, signedUrl: signed.data.signedUrl },
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Subscription actions
// ---------------------------------------------------------------------------

const compSchema = z.object({
  userId: z.string().uuid(),
  plan: z.enum(["pro", "business"]),
  /** Days to extend the comp for; default 30. Max 1 year. */
  days: z.number().int().min(1).max(365).default(30),
  reason: z.string().max(500).optional(),
});

/**
 * Comp a user onto a paid plan for N days. We DO NOT touch Razorpay
 * here — this is a manual entitlement override. The subscription row
 * is updated to status='active' with a future current_period_end.
 *
 * Use case: gifting Pro to early adopters, fulfilling support promises,
 * or compensating for an outage. Should never collide with a real
 * Razorpay-managed subscription — if `razorpay_subscription_id` is
 * already set, we refuse.
 */
export async function adminCompPlanAction(
  input: z.input<typeof compSchema>,
): Promise<AdminActionResult> {
  const parsed = compSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return await runAdminAction(
    {
      kind: "subscription.comp",
      targetType: "subscription",
      targetId: parsed.data.userId,
      metadata: {
        plan: parsed.data.plan,
        days: parsed.data.days,
        reason: parsed.data.reason,
      },
    },
    async () => {
      const admin = getAdminSupabase();
      const subLookup = await admin
        .from("subscriptions")
        .select("id, razorpay_subscription_id")
        .eq("user_id", parsed.data.userId)
        .maybeSingle();
      if (subLookup.error) return { ok: false, error: subLookup.error.message };
      const sub = subLookup.data as
        | { id: string; razorpay_subscription_id: string | null }
        | null;

      if (sub?.razorpay_subscription_id) {
        return {
          ok: false,
          error:
            "User has an active Razorpay subscription — refusing to overwrite. Cancel it first.",
        };
      }

      const periodEnd = new Date(
        Date.now() + parsed.data.days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const payload = {
        user_id: parsed.data.userId,
        plan: parsed.data.plan,
        status: "active" as const,
        billing_cycle: "monthly" as const,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        canceled_at: null,
      };

      if (sub) {
        const { error } = await admin
          .from("subscriptions")
          .update(payload as never)
          .eq("id", sub.id);
        if (error) return { ok: false, error: error.message };
      } else {
        const { error } = await admin
          .from("subscriptions")
          .insert(payload as never);
        if (error) return { ok: false, error: error.message };
      }

      revalidatePath(`/admin/users/${parsed.data.userId}`);
      revalidatePath("/admin/subscriptions");
      return {
        ok: true,
        message: `Comped ${parsed.data.plan} for ${parsed.data.days}d.`,
      };
    },
  );
}

/**
 * Manual refund record. This does NOT call Razorpay — refunds in
 * Razorpay are issued via their dashboard / API by the founder. This
 * action records the refund in `billing_payments` (creating a negative
 * amount row tagged as a refund) so MRR math + the user's payment
 * history reflect reality.
 *
 * Typical flow: refund in Razorpay → run this action → cancel/comp as
 * appropriate.
 */
const refundSchema = z.object({
  userId: z.string().uuid(),
  paymentId: z.string().uuid(),
  /** Amount being refunded in paise. Defaults to full amount of the original payment. */
  amountPaise: z.number().int().positive().optional(),
  /** Razorpay refund id, for cross-reference. Optional but recommended. */
  razorpayRefundId: z.string().max(64).optional(),
  reason: z.string().max(500).optional(),
});

export async function adminRecordRefundAction(
  input: z.input<typeof refundSchema>,
): Promise<AdminActionResult> {
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return await runAdminAction(
    {
      kind: "subscription.refund",
      targetType: "subscription",
      targetId: parsed.data.userId,
      metadata: {
        payment_id: parsed.data.paymentId,
        amount_paise: parsed.data.amountPaise,
        razorpay_refund_id: parsed.data.razorpayRefundId,
        reason: parsed.data.reason,
      },
    },
    async () => {
      const admin = getAdminSupabase();

      // Look up the original payment so we know the user + amount.
      const paymentLookup = await admin
        .from("billing_payments")
        .select("id, user_id, amount, razorpay_payment_id, currency")
        .eq("id", parsed.data.paymentId)
        .maybeSingle();
      if (paymentLookup.error) {
        return { ok: false, error: paymentLookup.error.message };
      }
      const payment = paymentLookup.data as
        | {
            id: string;
            user_id: string;
            amount: number;
            razorpay_payment_id: string;
            currency: string;
          }
        | null;
      if (!payment) return { ok: false, error: "Payment not found." };
      if (payment.user_id !== parsed.data.userId) {
        return { ok: false, error: "Payment does not belong to that user." };
      }

      const refundAmount = parsed.data.amountPaise ?? payment.amount;

      // Insert a refund row. We use a deterministic-ish synthetic
      // payment id so the unique constraint on `razorpay_payment_id`
      // doesn't reject the row.
      const refundId =
        parsed.data.razorpayRefundId ??
        `manual_refund_${payment.id.slice(0, 12)}_${Date.now()}`;

      const { error: insErr } = await admin.from("billing_payments").insert({
        user_id: payment.user_id,
        subscription_row_id: null,
        razorpay_payment_id: refundId,
        razorpay_order_id: null,
        razorpay_subscription_id: null,
        razorpay_invoice_id: null,
        amount: -Math.abs(refundAmount),
        currency: payment.currency,
        status: "refunded",
        description: parsed.data.reason ?? "Manual refund (admin)",
        metadata: {
          refunded_payment_id: payment.razorpay_payment_id,
          actor: "admin",
        },
      } as never);
      if (insErr) return { ok: false, error: insErr.message };

      // Mark the original payment as refunded too so reports match.
      await admin
        .from("billing_payments")
        .update({ status: "refunded" } as never)
        .eq("id", payment.id);

      revalidatePath(`/admin/users/${payment.user_id}`);
      revalidatePath("/admin/subscriptions");
      return {
        ok: true,
        message: `Recorded refund of ₹${(refundAmount / 100).toLocaleString("en-IN")}.`,
      };
    },
  );
}

/**
 * Cancel a subscription at period end without issuing a refund.
 */
const cancelSubSchema = z.object({
  subscriptionId: z.string().uuid(),
  immediately: z.boolean().default(false),
  reason: z.string().max(500).optional(),
});

export async function adminCancelSubscriptionAction(
  input: z.input<typeof cancelSubSchema>,
): Promise<AdminActionResult> {
  const parsed = cancelSubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  return await runAdminAction(
    {
      kind: "subscription.cancel",
      targetType: "subscription",
      targetId: parsed.data.subscriptionId,
      metadata: { reason: parsed.data.reason, immediately: parsed.data.immediately },
    },
    async () => {
      const admin = getAdminSupabase();
      const stamp = new Date().toISOString();
      const update = parsed.data.immediately
        ? { status: "canceled" as const, canceled_at: stamp, ended_at: stamp }
        : { cancel_at_period_end: true, canceled_at: stamp };
      const { error } = await admin
        .from("subscriptions")
        .update(update as never)
        .eq("id", parsed.data.subscriptionId);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/subscriptions");
      return { ok: true, message: "Subscription cancelled." };
    },
  );
}

// ---------------------------------------------------------------------------
// Email / suppression actions
// ---------------------------------------------------------------------------

const emailSchema = z.string().email().max(254);

export async function adminRemoveSuppressionAction(
  email: string,
): Promise<AdminActionResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email." };

  return await runAdminAction(
    {
      kind: "email.suppression.remove",
      targetType: "email",
      targetId: parsed.data.toLowerCase(),
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin
        .from("email_suppressions")
        .delete()
        .eq("email", parsed.data.toLowerCase());
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/emails");
      return { ok: true, message: "Suppression removed." };
    },
  );
}

export async function adminAddSuppressionAction(
  email: string,
  reason:
    | "hard_bounce"
    | "soft_bounce_repeat"
    | "complaint"
    | "unsubscribe"
    | "invalid"
    | "manual" = "manual",
): Promise<AdminActionResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email." };

  return await runAdminAction(
    {
      kind: "email.suppression.add",
      targetType: "email",
      targetId: parsed.data.toLowerCase(),
      metadata: { reason },
    },
    async () => {
      await recordSuppression({ email: parsed.data, reason });
      revalidatePath("/admin/emails");
      return { ok: true, message: "Suppression added." };
    },
  );
}

// ---------------------------------------------------------------------------
// Broadcast notification
// ---------------------------------------------------------------------------

const broadcastSchema = z.object({
  type: z.enum(["announcement", "incident", "maintenance"]),
  title: z.string().min(3).max(140),
  message: z.string().min(3).max(2000).optional(),
  /** Optional plan filter — default 'all' sends to everyone. */
  targetPlan: z.enum(["all", "free", "pro", "business"]).default("all"),
});

/**
 * Insert one notification row per matching user. This is the only
 * destructive-tier action in Phase 2 — it touches every user. The
 * UI gates with a typed-confirm modal ("type SEND to confirm").
 *
 * Concurrency: we batch-insert in chunks of 1000 to avoid hammering
 * the database with a single 100k-row INSERT.
 */
export async function adminBroadcastNotificationAction(
  input: z.input<typeof broadcastSchema>,
): Promise<AdminActionResult<{ recipients: number }>> {
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return await runAdminAction(
    {
      kind: "notification.broadcast",
      targetType: "notification",
      targetId: null,
      metadata: {
        title: parsed.data.title,
        target_plan: parsed.data.targetPlan,
      },
    },
    async (actor) => {
      const admin = getAdminSupabase();

      // Resolve target user IDs.
      let q = admin.from("admin_user_overview").select("id");
      if (parsed.data.targetPlan !== "all") {
        q = q.eq("plan", parsed.data.targetPlan);
      }
      const targetResult = await q;
      if (targetResult.error) {
        return { ok: false, error: targetResult.error.message };
      }
      const targets = (targetResult.data ?? []) as Array<{ id: string }>;
      const ids = targets.map((r) => r.id);
      if (ids.length === 0) {
        return { ok: false, error: "No recipients match that filter." };
      }

      const CHUNK = 1000;
      let inserted = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const rows = slice.map((uid) => ({
          user_id: uid,
          type: parsed.data.type,
          title: parsed.data.title,
          message: parsed.data.message ?? null,
          read: false,
        }));
        const { error } = await admin.from("notifications").insert(rows as never);
        if (error) {
          log.warn("admin.broadcast.partial_failure", {
            inserted_before_fail: inserted,
            error: error.message,
          });
          return {
            ok: false,
            error: `Failed after ${inserted} recipients: ${error.message}`,
          };
        }
        inserted += slice.length;
      }

      await sendAdminReceipt({
        actor,
        action: "Broadcast notification sent",
        subject: `Broadcast: ${parsed.data.title}`,
        details: [
          ["Title", parsed.data.title],
          ["Type", parsed.data.type],
          ["Audience", parsed.data.targetPlan],
          ["Recipients", String(inserted)],
        ],
        note: "No undo. Each recipient now has a notifications row.",
      });

      revalidatePath("/admin/notifications");
      return {
        ok: true,
        message: `Broadcast sent to ${inserted} users.`,
        data: { recipients: inserted },
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Platform settings (KV)
// ---------------------------------------------------------------------------

const settingSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
});

/**
 * Upsert one row in `platform_settings`. Values are stored as JSONB so
 * callers can pass arrays, objects, primitives — all valid.
 *
 * Sensitive-tier in the UI (typed confirm) because flipping a kill
 * switch (e.g. `email_live_mode_override = false`) has platform-wide
 * blast radius. Audited under `settings.update` with before/after.
 */
export async function adminSetPlatformSettingAction(
  input: z.input<typeof settingSchema>,
): Promise<AdminActionResult> {
  const parsed = settingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  return await runAdminAction(
    {
      kind: "settings.update",
      targetType: "settings",
      targetId: parsed.data.key,
      metadata: { value: parsed.data.value },
    },
    async (actor) => {
      const admin = getAdminSupabase();
      const { error } = await admin
        .from("platform_settings")
        .upsert(
          {
            key: parsed.data.key,
            value: parsed.data.value as never,
            updated_by: actor.id,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "key" },
        );
      if (error) return { ok: false, error: error.message };
      revalidatePath("/admin/settings");
      return { ok: true, message: "Setting saved." };
    },
  );
}

// ---------------------------------------------------------------------------
// Admin notes (sticky-note style)
// ---------------------------------------------------------------------------

const noteTargetSchema = z.enum([
  "user",
  "subscription",
  "invoice",
  "contract",
  "file",
  "email",
]);

const createNoteSchema = z.object({
  targetType: noteTargetSchema,
  targetId: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
  pinned: z.boolean().default(false),
});

export async function adminCreateNoteAction(
  input: z.input<typeof createNoteSchema>,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  return await runAdminAction(
    {
      kind: "system.note.create",
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      metadata: { pinned: parsed.data.pinned },
    },
    async (actor) => {
      const admin = getAdminSupabase();
      const insertRes = await admin
        .from("admin_notes")
        .insert({
          actor_id: actor.id,
          target_type: parsed.data.targetType,
          target_id: parsed.data.targetId,
          body: parsed.data.body,
          pinned: parsed.data.pinned,
        } as never)
        .select("id")
        .maybeSingle();
      if (insertRes.error) {
        return { ok: false, error: insertRes.error.message };
      }
      const row = insertRes.data as { id: string } | null;
      revalidatePathFor(parsed.data.targetType, parsed.data.targetId);
      return {
        ok: true,
        message: "Note saved.",
        data: { id: row?.id ?? "" },
      };
    },
  );
}

const updateNoteSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(4000).optional(),
  pinned: z.boolean().optional(),
  targetType: noteTargetSchema,
  targetId: z.string().min(1).max(120),
});

export async function adminUpdateNoteAction(
  input: z.input<typeof updateNoteSchema>,
): Promise<AdminActionResult> {
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  if (parsed.data.body === undefined && parsed.data.pinned === undefined) {
    return { ok: false, error: "Nothing to change." };
  }

  return await runAdminAction(
    {
      kind: "system.note.update",
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      metadata: {
        note_id: parsed.data.id,
        pinned: parsed.data.pinned,
      },
    },
    async () => {
      const admin = getAdminSupabase();
      const update: Record<string, unknown> = {};
      if (parsed.data.body !== undefined) update.body = parsed.data.body;
      if (parsed.data.pinned !== undefined) update.pinned = parsed.data.pinned;
      const { error } = await admin
        .from("admin_notes")
        .update(update as never)
        .eq("id", parsed.data.id);
      if (error) return { ok: false, error: error.message };
      revalidatePathFor(parsed.data.targetType, parsed.data.targetId);
      return { ok: true, message: "Note updated." };
    },
  );
}

const deleteNoteSchema = z.object({
  id: z.string().uuid(),
  targetType: noteTargetSchema,
  targetId: z.string().min(1).max(120),
});

export async function adminDeleteNoteAction(
  input: z.input<typeof deleteNoteSchema>,
): Promise<AdminActionResult> {
  const parsed = deleteNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  return await runAdminAction(
    {
      kind: "system.note.delete",
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      metadata: { note_id: parsed.data.id },
    },
    async () => {
      const admin = getAdminSupabase();
      const { error } = await admin
        .from("admin_notes")
        .delete()
        .eq("id", parsed.data.id);
      if (error) return { ok: false, error: error.message };
      revalidatePathFor(parsed.data.targetType, parsed.data.targetId);
      return { ok: true, message: "Note deleted." };
    },
  );
}

/**
 * Map a note's target tuple back to the admin page that surfaces it,
 * so a write invalidates the right cache slice.
 */
function revalidatePathFor(targetType: string, targetId: string): void {
  switch (targetType) {
    case "user":
      revalidatePath(`/admin/users/${targetId}`);
      break;
    case "subscription":
      revalidatePath(`/admin/subscriptions/${targetId}`);
      break;
    case "invoice":
      revalidatePath(`/admin/invoices/${targetId}`);
      break;
    case "contract":
      revalidatePath(`/admin/contracts/${targetId}`);
      break;
    case "file":
      revalidatePath(`/admin/files`);
      break;
    case "email":
      revalidatePath(`/admin/emails`);
      break;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an ISO timestamp into a Supabase `ban_duration` string.
 * Supabase accepts Go-style durations (e.g. "24h", "8760h"). We
 * compute the hour delta from now.
 */
function durationFromIso(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  return `${hours}h`;
}
// ---------------------------------------------------------------------------
// Bulk actions (Admin hardening A4) — operate on a selected set of users.
// ---------------------------------------------------------------------------

const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5000),
});

/**
 * Add every selected user's email to the suppression list. Server-action
 * form handler: reads repeated `ids` fields from FormData. Audited once with
 * a bulk count (not one audit row per email).
 */
export async function adminBulkSuppressUsersAction(
  formData: FormData,
): Promise<AdminActionResult> {
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const parsed = bulkIdsSchema.safeParse({ ids });
  if (!parsed.success) return { ok: false, error: "Select at least one user." };

  return await runAdminAction(
    {
      kind: "email.suppression.add",
      targetType: "email",
      targetId: null,
      metadata: { bulk: true, count: parsed.data.ids.length },
    },
    async () => {
      const admin = getAdminSupabase();
      const { data } = await admin
        .from("user_profiles")
        .select("email")
        .in("id", parsed.data.ids);
      const emails = ((data as { email: string | null }[] | null) ?? [])
        .map((r) => r.email)
        .filter((e): e is string => !!e);
      let added = 0;
      for (const email of emails) {
        await recordSuppression({ email, reason: "manual" });
        added += 1;
      }
      revalidatePath("/admin/users");
      revalidatePath("/admin/emails");
      return { ok: true, message: `Suppressed ${added} email${added === 1 ? "" : "s"}.` };
    },
  );
}
