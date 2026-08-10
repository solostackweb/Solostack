import "server-only";

/**
 * High-level email send orchestrator.
 *
 * Wraps `sendBrevoEmail` with:
 *   - delivery_logs lifecycle (queued -> sent | failed)
 *   - graceful degradation when Brevo is not configured (logs as
 *     `failed` with reason, returns a typed result so callers can
 *     decide whether to surface a UI error)
 *   - safe attachment handling (PDF buffers)
 */

import { Buffer } from "node:buffer";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { emailSendLimit } from "@/lib/rate-limit";
import type {
  DeliveryKind,
  DeliveryLogRow,
  DeliveryStatus,
} from "@/lib/supabase/types";
import { EmailTransportError, isEmailConfigured, type BrevoAttachment } from "./client";
import { sendEmail } from "./service";
import { getEmailSender, type EmailSenderType } from "./senders";
import { getSuppression } from "./suppressions";

export interface DeliveryDispatchInput {
  userId: string;
  kind: DeliveryKind;
  entityType: "invoice" | "contract" | "welcome_document" | "client" | "portal" | "questionnaire" | "system";
  senderType: EmailSenderType;
  entityId?: string | null;
  to: { email: string; name?: string };
  cc?: Array<{ email: string; name?: string }>;
  replyTo?: { email: string; name?: string };
  subject: string;
  html: string;
  text?: string;
  attachments?: BrevoAttachment[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  /**
   * Stable key identifying this *logical* send. Callers should derive it
   * from the entity + a version tag (e.g. `invoice:${id}:v1`) so an
   * accidental re-submission of the same server action does NOT produce
   * a duplicate email. Two inserts with the same key hit a unique index
   * on `delivery_logs.idempotency_key` and the second send is skipped.
   */
  idempotencyKey?: string | null;
}

export type DeliveryDispatchResult =
  | {
      ok: true;
      logId: string;
      providerMessageId: string;
    }
  | {
      ok: false;
      logId: string | null;
      error: string;
    };

export async function dispatchDelivery(
  input: DeliveryDispatchInput,
): Promise<DeliveryDispatchResult> {
  // ---- Gate 1: idempotency --------------------------------------------
  // If an idempotency key was passed and a row with that key already
  // exists, surface the existing log and exit. The original attempt's
  // terminal status (sent / failed / suppressed) is the source of truth.
  if (input.idempotencyKey) {
    const existing = await findLogByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (existing.status === "sent" || existing.status === "delivered") {
        return {
          ok: true,
          logId: existing.id,
          providerMessageId: existing.provider_message_id ?? "",
        };
      }
      return {
        ok: false,
        logId: existing.id,
        error:
          existing.error ??
          `Previous attempt ended in status=${existing.status}.`,
      };
    }
  }

  // ---- Gate 2: per-user rate limit ------------------------------------
  // Defends Brevo reputation against a hijacked account spamming every
  // client in the tenant's directory.
  const rate = await emailSendLimit(`email:${input.userId}`);
  if (!rate.ok) {
    const logId = await insertDeliveryLog(input, "failed", rate.message);
    return { ok: false, logId, error: rate.message };
  }

  // ---- Gate 3: suppression check --------------------------------------
  // Hard bounces / complaints / unsubscribes globally block that address.
  const suppression = await getSuppression(input.to.email);
  if (suppression) {
    const reason = `Address suppressed (${suppression.reason}).`;
    const logId = await insertDeliveryLog(input, "suppressed", reason);
    return { ok: false, logId, error: reason };
  }

  // ---- Gate 4: provider configured ------------------------------------
  if (!isEmailConfigured()) {
    const logId = await insertDeliveryLog(
      input,
      "failed",
      "Email provider not configured.",
    );
    return {
      ok: false,
      logId,
      error: "Email provider not configured.",
    };
  }

  // ---- Gate 5: live-mode kill switch ---------------------------------
  // In preview / staging / test environments this short-circuits BEFORE
  // the provider is invoked so reputation never gets touched. The log
  // row still exists so devs can verify the payload.
  const env = requireServerEnv();
  if (!env.emailLiveMode) {
    const logId = await insertDeliveryLog(input, "failed", "dry_run");
    return { ok: false, logId, error: "dry_run" };
  }

  // Create the queued row now that every pre-flight gate has passed.
  const logId = await insertDeliveryLog(input, "queued");

  try {
    const result = await sendEmail({
      type: input.senderType,
      to: input.to,
      cc: input.cc,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
      tags: input.tags ?? [input.kind],
      headers: {
        ...(input.entityId
          ? { "X-Stackivo-Entity": `${input.entityType}:${input.entityId}` }
          : {}),
      },
    });
    await markDeliveryStatus(logId, {
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: result.messageId || null,
    });
    return { ok: true, logId: logId ?? "", providerMessageId: result.messageId };
  } catch (err) {
    const message =
      err instanceof EmailTransportError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown email error.";
    await markDeliveryStatus(logId, {
      status: "failed",
      error: message,
    });
    return { ok: false, logId, error: message };
  }
}

async function insertDeliveryLog(
  input: DeliveryDispatchInput,
  status: DeliveryStatus,
  error?: string,
): Promise<string | null> {
  const admin = getAdminSupabase();
  const now = new Date().toISOString();
  const { data, error: dbError } = await admin
    .from("delivery_logs")
    .insert({
      user_id: input.userId,
      kind: input.kind,
      channel: "email",
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      to_email: input.to.email,
      subject: input.subject,
      status,
      provider: "brevo",
      error: error ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      // When the row is a terminal pre-flight failure (failed /
      // suppressed) there's no later `markDeliveryStatus` call — stamp
      // `sent_at` now so "time of attempt" is always populated.
      sent_at:
        status === "failed" || status === "suppressed" ? now : null,
      metadata: {
        ...(input.metadata ?? {}),
        senderType: input.senderType,
        sender: getEmailSender(input.senderType),
      } as never,
    } as never)
    .select("id")
    .single();
  if (dbError || !data) return null;
  return (data as { id: string }).id;
}

/**
 * Look up a prior delivery attempt by its idempotency key. Returns the
 * minimum state the idempotency gate needs to decide: terminal status,
 * log id, provider message id, and error (if any).
 */
async function findLogByIdempotencyKey(key: string): Promise<{
  id: string;
  status: DeliveryStatus;
  provider_message_id: string | null;
  error: string | null;
} | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("delivery_logs")
    .select("id, status, provider_message_id, error")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    id: string;
    status: DeliveryStatus;
    provider_message_id: string | null;
    error: string | null;
  };
}

async function markDeliveryStatus(
  logId: string | null,
  patch: Partial<
    Pick<
      DeliveryLogRow,
      | "status"
      | "error"
      | "sent_at"
      | "delivered_at"
      | "opened_at"
      | "bounced_at"
      | "provider_message_id"
    >
  >,
): Promise<void> {
  if (!logId) return;
  const admin = getAdminSupabase();
  await admin
    .from("delivery_logs")
    .update(patch as never)
    .eq("id", logId);
}

export type { BrevoAttachment };

/**
 * Helper for callers that already have a Buffer or a base-64 string.
 */
export function pdfAttachment(
  fileName: string,
  content: Buffer,
): BrevoAttachment {
  return { name: fileName, content };
}
