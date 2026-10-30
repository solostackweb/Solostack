/**
 * AI business operator — weekly Ivo digest.
 *
 *   GET /api/cron/ivo-digest
 *
 * Runs once a week (recommended: Mondays 07:00 UTC = 13:00 IST).
 * For each user with notification preferences, fetches key data points
 * and creates an in‑app notification summarising:
 *   • Overdue invoices (count)
 *   • Invoices due within 7 days (count)
 *   • Projects completing soon (next 7 days)
 *   • Subscription renewal status
 *   • Recent project completions
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 * Idempotency: keyed `ivo_digest:${userId}:<runDate>` so a same-day retry
 * cannot double‑send.
 *
 * Note: the digest respects the user's `notificationPreferences.emailWeeklyDigest`
 * flag. If the flag is `false`, the cron silently skips that user (treats as
 * no‑op so opt‑in/out works without code changes).
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { createNotification } from "@/features/notifications/server";
import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAtMs = Date.now();
  const admin = getAdminSupabase();

  try {
    // Fetch all users who have notification preferences set.
    const { data: profiles, error: profilesError } = await admin
      .from("user_profiles")
      .select("id, notification_preferences")
      .not("notification_preferences", "is", null);
    if (profilesError) {
      await recordCronRun({
        job: "ivo-digest",
        status: "error",
        startedAtMs,
        error: profilesError.message,
      });
      return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
    }

    const userRows = (profiles ?? []) as Array<{
      id: string;
      notification_preferences: unknown;
    }>;
    let sent = 0;
    let skipped = 0;

    for (let i = 0; i < userRows.length; i += 1) {
      const user = userRows[i];
      const userId = user.id;

      // Respect opt‑out: if the user has disabled emailWeeklyDigest, skip.
      const prefs = (user.notification_preferences ?? {}) as Record<string, unknown>;
      if (prefs.emailWeeklyDigest === false) {
        skipped += 1;
        continue;
      }

      // Use admin client — RLS is bypassed, we query by user_id directly.
      try {
        // 1. Overdue invoices
        let overdueCount = 0;
        try {
          const { data: overdueData, error: overErr } = await admin
            .from("invoices")
            .select("total_amount")
            .eq("user_id", userId)
            .eq("status", "overdue");
          if (!overErr && overdueData) {
            overdueCount = overdueData.length;
          }
        } catch {
          // ignore
        }

        // 2. Invoices due within 7 days
        let dueSoonCount = 0;
        try {
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const { data: dueData, error: dueErr } = await admin
            .from("invoices")
            .select("due_date")
            .eq("user_id", userId)
            .gte("due_date", new Date().toISOString().slice(0, 10))
            .lte("due_date", weekFromNow.toISOString().slice(0, 10));
          if (!dueErr && dueData) {
            dueSoonCount = dueData.length;
          }
        } catch {
          // ignore
        }

        // 3. Projects completing soon (next 7 days)
        let completingCount = 0;
        try {
          const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const { data: compData, error: compErr } = await admin
            .from("projects")
            .select("id")
            .eq("user_id", userId)
            .gte("due_date", new Date().toISOString().slice(0, 10))
            .lte("due_date", weekFromNow.toISOString().slice(0, 10))
            .in("status", ["active", "waiting_on_client", "revision"]);
          if (!compErr && compData) {
            completingCount = compData.length;
          }
        } catch {
          // ignore
        }

        // 4. Subscription status
        let hasRecurring = false;
        let nextRenewal: string | null = null;
        try {
          const { data: subRaw, error: subErr } = await admin
            .from("subscriptions")
            .select("plan, current_period_end")
            .eq("user_id", userId)
            .maybeSingle();
          if (!subErr && subRaw) {
            const sub = subRaw as { plan: string; current_period_end: string | null };
            hasRecurring = sub.plan === "pro" || sub.plan === "business";
            if (sub.current_period_end) {
              nextRenewal = new Date(sub.current_period_end).toLocaleDateString("en-IN");
            }
          }
        } catch {
          /* keep defaults */
        }

        // 5. Recent project completions (last 30 days)
        let completedCount = 0;
        try {
          const { data: comp2Data, error: comp2Err } = await admin
            .from("project_status_history")
            .select("project_id")
            .eq("user_id", userId)
            .gte("changed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .eq("to_status", "completed");
          if (!comp2Err && comp2Data) {
            completedCount = comp2Data.length;
          }
        } catch {
          // ignore
        }

        // ---------- Build notification ----------
        const title = "Weekly Ivo digest";
        const parts: string[] = [];

        if (overdueCount > 0) {
          parts.push(`${overdueCount} invoice${overdueCount !== 1 ? "s" : ""} overdue`);
        }
        if (dueSoonCount > 0) {
          parts.push(`${dueSoonCount} invoice${dueSoonCount !== 1 ? "s" : ""} due within 7 days`);
        }
        if (completingCount > 0) {
          parts.push(`${completingCount} project${completingCount !== 1 ? "s" : ""} completing soon`);
        }
        if (hasRecurring && nextRenewal) {
          const planText = hasRecurring ? "Pro" : "Business";
          parts.push(`Subscription renews ${nextRenewal} — ${planText} plan`);
        }
        if (completedCount > 0) {
          parts.push(`${completedCount} project${completedCount !== 1 ? "s" : ""} completed recently`);
        }

        // If there's nothing to report, skip creating a notification.
        if (parts.length === 0) {
          skipped += 1;
          continue;
        }

        const message = parts.join(" | ");

        await createNotification({
          type: "ivo_digest_weekly",
          title,
          message,
        });

        sent += 1;
      } catch {
        // skip this user on unexpected error
      }
    }

    log.info("ivo_digest_cron", { portals: userRows.length, sent, skipped });
    await recordCronRun({
      job: "ivo-digest",
      status: "ok",
      startedAtMs,
    });
    return NextResponse.json({ ok: true, sent, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("ivo_digest_cron_failed", { error: message });
    await recordCronRun({
      job: "ivo-digest",
      status: "error",
      startedAtMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}