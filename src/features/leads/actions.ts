"use server";

/**
 * Marketing lead-capture server actions.
 *
 * Currently:
 *   - subscribeToNewsletterAction()  → adds the email to the Brevo
 *                                       contact list (if configured),
 *                                       falls back to a founder email
 *                                       so leads are never lost.
 *
 * The server action is small on purpose: any extra fields collected
 * (lead magnet name, source page, UTM) ride through as `attributes`
 * and `metadata` so the founder can segment from the Brevo dashboard
 * without code changes.
 */

import { z } from "zod";
import { headers } from "next/headers";
import { requireServerEnv } from "@/config/env";
import { sendEmail } from "@/features/email/service";
import { log } from "@/lib/logger";

const subscribeSchema = z.object({
  email: z.string().email().max(254),
  /** Optional source identifier — "footer" / "exit_intent" / "banner". */
  source: z.string().max(60).optional(),
  /** Optional lead-magnet identifier — "gst_template" / "rate_calc" / null. */
  magnet: z.string().max(60).optional(),
  /** Optional first name when the form collects it. */
  firstName: z.string().max(80).optional(),
  /** Honeypot — bots fill this; real users don't see it. */
  website: z.string().max(0).optional(),
});

export interface NewsletterResult {
  ok: boolean;
  /** "brevo" when added to the list; "email_fallback" when only the founder was emailed. */
  via?: "brevo" | "email_fallback";
  error?: string;
}

const BREVO_BASE = "https://api.brevo.com/v3";

export async function subscribeToNewsletterAction(
  input: z.infer<typeof subscribeSchema>,
): Promise<NewsletterResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please enter a valid email.",
    };
  }
  // Honeypot trip — silently accept.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { ok: true, via: "brevo" };
  }

  const env = requireServerEnv();
  const headerList = await headers();
  const referer = headerList.get("referer") ?? null;
  const userAgent = headerList.get("user-agent")?.slice(0, 200) ?? null;

  const attributes: Record<string, string> = {};
  if (parsed.data.firstName) attributes.FIRSTNAME = parsed.data.firstName;
  if (parsed.data.source) attributes.LEAD_SOURCE = parsed.data.source;
  if (parsed.data.magnet) attributes.LEAD_MAGNET = parsed.data.magnet;
  attributes.SUBSCRIBED_AT = new Date().toISOString();

  // Best-effort Brevo subscription.
  if (env.brevoApiKey) {
    try {
      const body: Record<string, unknown> = {
        email: parsed.data.email.toLowerCase(),
        attributes,
        updateEnabled: true,
      };
      if (env.brevoNewsletterListId) {
        body.listIds = [Number(env.brevoNewsletterListId)];
      }
      const res = await fetch(`${BREVO_BASE}/contacts`, {
        method: "POST",
        headers: {
          "api-key": env.brevoApiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      // Brevo returns 201 (created), 204 (updated), or 4xx on error.
      if (res.ok || res.status === 204) {
        log.info("leads.subscribe.brevo_ok", {
          source: parsed.data.source,
          magnet: parsed.data.magnet,
        });
        return { ok: true, via: "brevo" };
      }
      const text = await res.text().catch(() => "");
      log.warn("leads.subscribe.brevo_failed_fallback_email", {
        status: res.status,
        body: text.slice(0, 300),
      });
      // fall through to email fallback
    } catch (err) {
      log.warn("leads.subscribe.brevo_exception", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Email fallback so the founder still gets every lead even when the
  // Brevo list isn't configured.
  try {
    await sendEmail({
      type: "support",
      to: { email: "support@stackivo.me", name: "Stackivo Leads" },
      replyTo: { email: parsed.data.email },
      subject: `[lead] ${parsed.data.email} via ${parsed.data.source ?? "newsletter"}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;">
          <h2 style="font-size: 16px; margin-bottom: 8px;">New newsletter subscriber</h2>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Email</td>
                <td><strong>${escapeHtml(parsed.data.email)}</strong></td></tr>
            ${parsed.data.firstName ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Name</td><td>${escapeHtml(parsed.data.firstName)}</td></tr>` : ""}
            ${parsed.data.source ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Source</td><td>${escapeHtml(parsed.data.source)}</td></tr>` : ""}
            ${parsed.data.magnet ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Magnet</td><td>${escapeHtml(parsed.data.magnet)}</td></tr>` : ""}
            ${referer ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Referer</td><td><code>${escapeHtml(referer)}</code></td></tr>` : ""}
            ${userAgent ? `<tr><td style="padding: 4px 12px 4px 0; color: #64748b;">UA</td><td style="font-size: 11px; color: #475569;">${escapeHtml(userAgent)}</td></tr>` : ""}
          </table>
        </div>
      `,
      text: [
        `Email: ${parsed.data.email}`,
        parsed.data.firstName ? `Name: ${parsed.data.firstName}` : "",
        parsed.data.source ? `Source: ${parsed.data.source}` : "",
        parsed.data.magnet ? `Magnet: ${parsed.data.magnet}` : "",
        referer ? `Referer: ${referer}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      tags: [
        "lead",
        parsed.data.source ?? "unknown_source",
        ...(parsed.data.magnet ? [`magnet:${parsed.data.magnet}`] : []),
      ],
    });
    return { ok: true, via: "email_fallback" };
  } catch (err) {
    log.error("leads.subscribe.email_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: "Could not subscribe right now. Please email support@stackivo.me.",
    };
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
