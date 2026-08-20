"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";

interface FreePlanBannerProps {
  /** The user's lifetime client count — used to calculate how close they are to the 5-client limit. */
  clientsUsed: number;
  /** Free-plan client ceiling. Defaults to 5 to match plans.ts. */
  clientLimit?: number;
}

const STORAGE_KEY = "stackivo:free-banner-dismissed";

/**
 * Persistent upgrade nudge shown at the top of the dashboard for free-plan
 * users. Dismissible per session via localStorage.
 *
 * Messaging adapts based on how close the user is to the 5-client ceiling:
 *   0–3 clients  → general "unlock more" message
 *   4–4 clients  → urgency: "1 client slot left"
 *   5+ clients   → blocked: "You've hit your limit"
 */
export function FreePlanBanner({
  clientsUsed,
  clientLimit = 5,
}: FreePlanBannerProps) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(
        sessionStorage.getItem(STORAGE_KEY) === "1",
      );
    } catch {
      // sessionStorage blocked (private mode etc.) — show the banner
    }
  }, []);

  if (dismissed) return null;

  const remaining = Math.max(0, clientLimit - clientsUsed);
  const isBlocked = clientsUsed >= clientLimit;
  const isNearLimit = !isBlocked && remaining === 1;

  const message = isBlocked
    ? `You've reached your free plan limit of ${clientLimit} clients.`
    : isNearLimit
      ? `1 client slot remaining on your free plan.`
      : `You're on the free plan — ${remaining} of ${clientLimit} client slots remaining.`;

  const cta = isBlocked ? "Upgrade now to add more clients" : "Upgrade to Pro for unlimited clients";

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className={
        isBlocked
          ? "flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.04] px-4 py-3 text-sm"
          : "flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/[0.05] to-violet-500/[0.03] px-4 py-3 text-sm"
      }
    >
      <div className="flex items-center gap-2.5">
        <Sparkles
          className={
            isBlocked
              ? "h-4 w-4 shrink-0 text-destructive"
              : "h-4 w-4 shrink-0 text-primary"
          }
          aria-hidden
        />
        <span className="text-xs text-muted-foreground">
          {message}{" "}
          <Link
            href="/dashboard/settings/billing"
            className={
              isBlocked
                ? "inline-flex items-center gap-0.5 font-semibold text-destructive hover:text-destructive/80"
                : "inline-flex items-center gap-0.5 font-semibold text-primary hover:text-primary/80"
            }
          >
            {cta}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </span>
      </div>
      {!isBlocked && (
        <button
          onClick={dismiss}
          aria-label="Dismiss upgrade banner"
          className="shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
