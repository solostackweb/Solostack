"use client";

/**
 * SlackAlertSection - shows OPS_SLACK_WEBHOOK_URL status and lets the
 * admin fire a test message to verify the integration.
 */

import * as React from "react";
import { CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import { testSlackAlertAction } from "@/features/admin/slack-actions";
import { cn } from "@/lib/utils";

interface SlackAlertSectionProps {
  /** Whether OPS_SLACK_WEBHOOK_URL is set (passed from the server) */
  configured: boolean;
  /** First 30 chars of the webhook URL for display (never the full secret) */
  webhookPreview: string | null;
}

type TestState = "idle" | "loading" | "success" | "error";

export function SlackAlertSection({
  configured,
  webhookPreview,
}: SlackAlertSectionProps) {
  const [state, setState] = React.useState<TestState>("idle");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  async function handleTest() {
    setState("loading");
    setErrorMsg(null);
    try {
      const result = await testSlackAlertAction();
      if (result.ok) {
        setState("success");
        // auto-reset after 4 s
        setTimeout(() => setState("idle"), 4000);
      } else {
        setErrorMsg(result.error ?? "Unknown error");
        setState("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Slack Ops Alerts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            OPS_SLACK_WEBHOOK_URL - used by the cron monitor and admin actions to post critical alerts.
          </p>
        </div>
        <a
          href="https://api.slack.com/messaging/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Slack docs <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
        {configured ? (
          <>
            <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-foreground font-medium">Configured</span>
            {webhookPreview && (
              <span className="ml-1 font-mono text-muted-foreground">
                {webhookPreview}...
              </span>
            )}
          </>
        ) : (
          <>
            <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
            <span className="text-red-600 dark:text-red-400 font-medium">Not configured</span>
            <span className="text-muted-foreground ml-1">
              - add <code className="text-[11px]">OPS_SLACK_WEBHOOK_URL</code> to Vercel environment variables
            </span>
          </>
        )}
      </div>

      {/* Alert types info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Alerts fired automatically:</p>
        <ul className="ml-3 space-y-0.5 list-disc">
          <li>Billing events stale &gt; 10 min (cron monitor)</li>
          <li>Email delivery failures &gt; 5 / hour</li>
          <li>Security alerts &gt; 3 / hour</li>
        </ul>
      </div>

      {/* Test button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={state === "loading" || !configured}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            configured
              ? "hover:bg-accent cursor-pointer"
              : "cursor-not-allowed opacity-40",
            state === "success" && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
            state === "error" && "border-red-500 text-red-600 dark:text-red-400",
          )}
        >
          {state === "loading" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : state === "success" ? (
            <CheckCircle className="h-3 w-3" />
          ) : state === "error" ? (
            <XCircle className="h-3 w-3" />
          ) : null}
          {state === "loading"
            ? "Sending..."
            : state === "success"
              ? "Sent!"
              : state === "error"
                ? "Failed"
                : "Send test alert"}
        </button>

        {state === "error" && errorMsg && (
          <span className="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>
        )}
        {state === "success" && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Check your Slack channel.
          </span>
        )}
      </div>
    </section>
  );
}
