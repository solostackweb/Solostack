"use server";

/**
 * Admin Slack actions.
 *
 *   testSlackAlertAction() - sends a test message to the configured
 *                             OPS_SLACK_WEBHOOK_URL. Admin-only.
 */

import { requireAdmin } from "@/features/admin/server";
import { log } from "@/lib/logger";

export interface SlackTestResult {
  ok: boolean;
  error?: string;
}

export async function testSlackAlertAction(): Promise<SlackTestResult> {
  await requireAdmin();

  const webhookUrl = process.env.OPS_SLACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      ok: false,
      error: "OPS_SLACK_WEBHOOK_URL is not configured.",
    };
  }

  const payload = {
    text: ":white_check_mark: Stackivo admin - test alert",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "✅ Stackivo Admin - Test Alert" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This is a *test message* sent from `/admin/settings`. If you see this, your Slack webhook is working correctly.",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Sent at ${new Date().toISOString()} via admin console`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      log.warn("admin.slack.test_failed", { status: res.status, body: text.slice(0, 200) });
      return { ok: false, error: `Slack responded with ${res.status}: ${text.slice(0, 120)}` };
    }

    log.info("admin.slack.test_sent");
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("admin.slack.test_exception", { error: msg });
    return { ok: false, error: msg };
  }
}
