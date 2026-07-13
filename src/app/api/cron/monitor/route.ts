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
  /** Rate-limit blocks above this count in the last hour → page (bot/abuse). */
  rateLimitTripsLastHour: 50,
};

/**
 * How long a still-open condition stays quiet before we re-page about it.
 * Keeps a lingering issue (e.g. an unanswered SLA-breaching ticket) from
 * emitting a new alert on every 15-minute run, while still nudging every few
 * hours so it isn't forgotten. Tune freely — it only affects alert cadence,
 * never detection.
 */
const REALERT_COOLDOWN_MS = 6 * 60 * 60_000; // 6 hours

/**
 * Decide whether to emit a fresh alert for the current set of findings.
 *
 * Emits when:
 *   - there is no prior monitor alert on record, or
 *   - the set of finding *kinds* changed since the last alert (a genuinely
 *     new or resolved condition), or
 *   - the same condition has persisted past the re-alert cooldown.
 *
 * Fails OPEN: if the lookup errors we emit, so the de-dup logic can never
 * silently swallow a real issue.
 */
async function shouldEmitAlert(
  admin: ReturnType<typeof getAdminSupabase>,
  signature: string,
): Promise<boolean> {
  try {
    const res = await admin
      .from("security_events")
      .select("created_at, metadata")
      .eq("kind", "cron_monitor_alert")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = res.data as {
      created_at: string;
      metadata: Record<string, unknown> | null;
    } | null;
    if (!row) return true; // never alerted before

    const meta = (row.metadata ?? {}) as {
      signature?: string;
      findings?: Array<{ kind?: string }>;
    };
    // Prefer the stored signature; fall back to reconstructing it from the
    // findings for alerts written before signatures existed.
    const lastSignature =
      typeof meta.signature === "string"
        ? meta.signature
        : (meta.findings ?? [])
            .map((f) => f.kind ?? "")
            .sort()
            .join(",");

    if (lastSignature !== signature) return true; // condition changed

    const ageMs = Date.now() - new Date(row.created_at).getTime();
    return ageMs >= REALERT_COOLDOWN_MS; // same condition — only after cooldown
  } catch {
    return true; // fail open
  }
}

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
      // Exclude the monitor's OWN synthetic alerts — otherwise it counts
      // itself and can page about its own noise (a self-feedback loop).
      .neq("kind", "cron_monitor_alert")
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

  // ---- Probe 3b: rate-limit floods (unusual traffic) ---------------------
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .in("kind", ["rate_limit_tripped", "auth_ratelimit_tripped"])
      .gte("created_at", since);
    if ((count ?? 0) >= THRESHOLDS.rateLimitTripsLastHour) {
      findings.push({
        kind: "security.rate_limit_flood",
        detail: `${count} rate-limit blocks in the last hour (possible bot / abuse)`,
        count: count ?? 0,
      });
    }
  } catch (err) {
    log.warn("cron.monitor.ratelimit_probe_failed", {
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
  //
  // A persistent condition (e.g. a support ticket stuck past SLA without a
  // first reply) would otherwise emit a fresh `alert` security event on EVERY
  // 15-minute run, flooding the security feed and Slack with duplicates. We
  // de-duplicate: page immediately when the set of findings is new or changes,
  // then stay quiet while the SAME condition stays open, re-paging only once a
  // cooldown lapses so a lingering issue is never forgotten.
  if (findings.length > 0) {
    // Always log every run with findings — cheap observability, no alert spam.
    log.warn("cron.monitor.findings", { findings });

    const signature = findings
      .map((f) => f.kind)
      .sort()
      .join(",");

    if (await shouldEmitAlert(admin, signature)) {
      await notifySlack(env.opsSlackWebhookUrl, findings);
      await recordSecurityEvent({
        kind: "cron_monitor_alert",
        severity: "alert",
        metadata: { findings, signature },
      });
    }
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
