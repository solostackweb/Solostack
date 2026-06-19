/**
 * Operational monitor cron.
 *
 *   GET /api/cron/monitor
 *
 * Intended to be called by an external cron service every 15 minutes.
 * Runs a fixed set of integrity queries against the database and posts
 * a Slack alert if any threshold is breached. Emits a `cron_monitor_alert`
 * security event on every alert for audit history.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`. Manual or
 * misconfigured hits return 401 so we don't leak anything.
 *
 * All third-party integrations (Slack) gracefully no-op when the
 * corresponding env var isn't set.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordSecurityEvent } from "@/lib/security-events/server";
import { refreshAdminMetrics } from "@/features/admin/metrics-cache";

import { recordCronRun } from "@/lib/cron/record";
import { getCronHealth } from "@/features/admin/cron-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Thresholds beyond which we alert. Tuned for low-noise production. */
const THRESHOLDS = {
  /** Billing events unprocessed > this minutes → page the team. */
  billingStaleMinutes: 10,
  /** Delivery failures above this count in the last hour → page. */
  deliveryFailuresLastHour: 5,
  /** Security alerts above this count in the last hour → page. */
  securityAlertsLastHour: 3,
};

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();

  // ---- Auth gate ------------------------------------------------------
  if (!env.cronSecret) {
    // No secret configured → endpoint is effectively disabled.
    return new NextResponse("Not configured", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = getAdminSupabase();

  const startedAtMs = Date.now();
  const findings: Array<{ kind: string; detail: string; count?: number }> = [];

  // ---- Probe 1: unprocessed billing events --------------------------------
  try {
    const stale = new Date(
      Date.now() - THRESHOLDS.billingStaleMinutes * 60_000,
    ).toISOString();
    const { count } = await admin
      .from("billing_events")
      .select("id", { count: "exact", head: true })
      .is("processed_at", null)
      .lt("created_at", stale);
    if ((count ?? 0) > 0) {
      findings.push({
        kind: "billing.stale_events",
        detail: `${count} billing events unprocessed for >${THRESHOLDS.billingStaleMinutes}m`,
        count: count ?? 0,
      });
    }
  } catch (err) {
    log.warn("cron.monitor.billing_probe_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Probe 2: delivery failures in the last hour -----------------------
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "bounced"])
      .gte("created_at", since);
    if ((count ?? 0) >= THRESHOLDS.deliveryFailuresLastHour) {
      findings.push({
        kind: "email.delivery_failures",
        detail: `${count} failed / bounced emails in the last hour`,
        count: count ?? 0,
      });
    }
  } catch (err) {
    log.warn("cron.monitor.delivery_probe_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Probe 3: security alerts in the last hour -------------------------
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "alert")
      .gte("created_at", since);
    if ((count ?? 0) >= THRESHOLDS.securityAlertsLastHour) {
      findings.push({
        kind: "security.alerts",
        detail: `${count} severity='alert' events in the last hour`,
        count: count ?? 0,
      });
    }
  } catch (err) {
    log.warn("cron.monitor.security_probe_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Probe 4: support SLA breaches --------------------------------------
  try {
    const nowIso = new Date().toISOString();
    const { count } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "open", "waiting_on_us"])
      .is("first_response_at", null)
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", nowIso);
    if ((count ?? 0) > 0) {
      findings.push({
        kind: "support.sla_breach",
        detail: `${count} support ticket(s) past SLA without a first reply`,
        count: count ?? 0,
      });
    }
  } catch (err) {
    log.warn("cron.monitor.sla_probe_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Probe 5: stale / failing scheduled jobs ----------------------------
  try {
    const health = await getCronHealth();
    for (const h of health) {
      if (h.id === "monitor") continue; // self — always fresh here
      if (h.failing || h.stale) {
        findings.push({
          kind: "cron.unhealthy",
          detail: `${h.label} is ${h.failing ? "failing" : "overdue"}`,
        });
      }
    }
  } catch (err) {
    log.warn("cron.monitor.cron_probe_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Refresh the founder-console metrics cache (best-effort) ------------
  // Keeps /admin's Now page reading a single cached row instead of
  // recomputing a dozen counts on every visit (Admin hardening A1).
  await refreshAdminMetrics().catch(() => null);

  // ---- Dispatch alert -----------------------------------------------------
  if (findings.length > 0) {
    await notifySlack(env.opsSlackWebhookUrl, findings);
    await recordSecurityEvent({
      kind: "cron_monitor_alert",
      severity: "alert",
      metadata: { findings },
    });
    log.warn("cron.monitor.findings", { findings });
  }

  await recordCronRun({ job: "monitor", status: "ok", startedAtMs });
  return NextResponse.json({
    ok: true,
    findings,
    time: new Date().toISOString(),
  });
}

/**
 * Fire-and-forget Slack webhook. Graceful no-op when the webhook URL
 * is unset. We deliberately swallow errors here — a broken Slack
 * integration shouldn't make the cron appear unhealthy to Vercel.
 */
async function notifySlack(
  webhookUrl: string | undefined,
  findings: Array<{ kind: string; detail: string; count?: number }>,
): Promise<void> {
  if (!webhookUrl) return;
  const lines = findings
    .map((f) => `• *${f.kind}* — ${f.detail}`)
    .join("\n");
  const payload = {
    text: ":rotating_light: *Stackivo ops alert*",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🚨 Stackivo ops alert" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: lines || "No findings" },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Checked at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    log.warn("cron.monitor.slack_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
