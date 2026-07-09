import "server-only";

/**
 * Founder Console - email receipts for destructive actions.
 *
 * Fire-and-forget: receipts are a forensic convenience for the admin,
 * not a transactional guarantee. A failed send must NEVER fail the
 * underlying action, so this helper swallows every error.
 *
 * Receipts go from the operational sender to the admin's own email.
 * That double-keeps the audit trail: the row in `admin_actions` plus
 * the email in the admin's inbox.
 */

import type { User } from "@supabase/supabase-js";
import { sendEmail } from "@/features/email/service";
import { log } from "@/lib/logger";
import { requireServerEnv } from "@/config/env";
import { formatIstStamp } from "./format";

export interface SendReceiptInput {
  actor: User;
  /** Verb + object, e.g. "Soft-deleted user". */
  action: string;
  /** One-line summary for the email subject. */
  subject: string;
  /** Plain-text body bullets; arrays render as <li>. */
  details: Array<[label: string, value: string]>;
  /** Optional follow-up note to surface in the body. */
  note?: string;
}

/**
 * Send a receipt email. Renders both HTML and a plain-text fallback.
 * The HTML uses inline styles only - no external CSS.
 */
export async function sendAdminReceipt(input: SendReceiptInput): Promise<void> {
  // Don't ship a receipt for non-prod sessions (testing/local).
  const serverEnv = requireServerEnv();
  if (!serverEnv.emailLiveMode) {
    log.info("admin.receipt.skipped_dry_run", {
      to: input.actor.email,
      action: input.action,
    });
    return;
  }

  if (!input.actor.email) {
    log.warn("admin.receipt.no_email", { actor_id: input.actor.id });
    return;
  }

  try {
    const stamp = formatIstStamp(new Date().toISOString());
    const detailsHtml = input.details
      .map(
        ([label, value]) =>
          `<tr>
             <td style="padding:6px 12px 6px 0; color:#64748b; font-size:12px; white-space:nowrap;">${escapeHtml(label)}</td>
             <td style="padding:6px 0; color:#0f172a; font-size:13px;"><code style="font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(value)}</code></td>
           </tr>`,
      )
      .join("\n");
    const detailsText = input.details
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    await sendEmail({
      type: "support",
      to: { email: input.actor.email },
      subject: `[Stackivo Console] ${input.subject}`,
      tags: ["admin-receipt"],
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width:560px; margin:0 auto; padding:24px;">
          <h1 style="font-size:16px; margin:0 0 4px;">${escapeHtml(input.action)}</h1>
          <div style="color:#64748b; font-size:12px; margin-bottom:16px;">
            Founder Console action receipt - ${escapeHtml(stamp)} IST
          </div>
          <table style="width:100%; border-collapse:collapse; margin:0 0 16px;">
            ${detailsHtml}
          </table>
          ${
            input.note
              ? `<p style="color:#475569; font-size:12px; line-height:1.5; margin:0 0 12px;">${escapeHtml(input.note)}</p>`
              : ""
          }
          <p style="color:#94a3b8; font-size:11px; line-height:1.5; margin:24px 0 0;">
            This is an automated receipt sent because you performed a
            destructive admin action. Audit row in
            <code>public.admin_actions</code>.
          </p>
        </div>
      `,
      text: [
        input.action,
        `Receipt time: ${stamp} IST`,
        "",
        detailsText,
        "",
        input.note ?? "",
        "",
        "Sent automatically because you performed a destructive admin action.",
      ].join("\n"),
      metadata: {
        kind: "admin_receipt",
        action: input.action,
        actor_id: input.actor.id,
      },
    });
  } catch (err) {
    log.warn("admin.receipt.send_failed", {
      actor_id: input.actor.id,
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
