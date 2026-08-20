"use client";

/**
 * ReferralCard
 *
 * Shown on the dashboard or settings/referral page. Displays:
 *   - The user's unique referral link with a copy button
 *   - How many friends signed up (pending + completed)
 *   - Reward months earned
 *
 * Designed to be embedded in a settings section or as a standalone dashboard
 * card. Receives data from the server component that called getReferralStatus().
 */

import * as React from "react";
import {
  Gift,
  Copy,
  Check,
  Users,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReferralStatus } from "../server";

interface ReferralCardProps {
  status: ReferralStatus;
}

export function ReferralCard({ status }: ReferralCardProps) {
  const [copied, setCopied] = React.useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(status.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = status.referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 border-b p-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
          <Gift className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="font-semibold leading-snug">Refer a freelancer</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            They get 1 month Pro free. You get 1 month Pro free when they
            complete their setup.
          </p>
        </div>
      </div>

      {/* Referral link */}
      <div className="space-y-3 p-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your referral link
        </label>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
          <span className="flex-1 truncate font-mono text-xs text-foreground/80">
            {status.referralLink}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs"
            onClick={copyLink}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success-strong" />
                <span className="text-success-strong">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Share shortcut chips */}
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Hey! I've been using Stackivo to manage my freelance invoicing — it's free for your first 5 clients and handles GST automatically. Check it out: ${status.referralLink}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/40"
          >
            <span className="text-success-strong">●</span> Share on WhatsApp
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `I've been using @stackivo for freelance invoicing + GST in India — it's clean and actually free to start. ${status.referralLink}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium transition-colors hover:border-foreground/30 hover:bg-muted/40"
          >
            <span className="text-info-strong">●</span> Share on X
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x border-t">
        <div className="flex flex-col items-center gap-0.5 p-4 text-center">
          <span className="text-xl font-bold tabular-nums">
            {status.pendingCount + status.completedCount}
          </span>
          <span className="text-micro text-muted-foreground">Signed up</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 p-4 text-center">
          <span className="text-xl font-bold tabular-nums">
            {status.completedCount}
          </span>
          <span className="text-micro text-muted-foreground">Completed</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 p-4 text-center">
          <span className="text-xl font-bold tabular-nums text-violet-500">
            {status.rewardMonthsEarned}
          </span>
          <span className="text-micro text-muted-foreground">
            Months earned
          </span>
        </div>
      </div>

      {/* Reward explanation */}
      {status.rewardMonthsEarned > 0 && (
        <div className="flex items-center gap-2 border-t bg-violet-500/5 px-5 py-3">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <p className="text-xs text-muted-foreground">
            You&apos;ve earned{" "}
            <strong className="text-foreground">
              {status.rewardMonthsEarned} month
              {status.rewardMonthsEarned !== 1 ? "s" : ""}
            </strong>{" "}
            of Pro free. These are applied to your next renewal automatically.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact variant for the dashboard sidebar / quick-actions card.
 */
export function ReferralNudge({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://stackivo.me"}/register?ref=${code}`;

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="group flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:border-violet-500/30 hover:bg-violet-500/5"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
        <Users className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Refer a freelancer</p>
        <p className="truncate text-xs text-muted-foreground">
          {copied ? "Link copied!" : "Both get 1 month Pro free"}
        </p>
      </div>
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-success-strong" />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
