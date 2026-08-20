/**
 * Tiny banner of churn-signal badges, rendered right under the user
 * detail page header. Stays invisible when there are no signals so
 * happy users don't see noise.
 */

import { AlertTriangle, MessageSquare } from "lucide-react";
import type { ChurnSignals } from "@/features/support/admin-queries";

interface Props {
  signals: ChurnSignals;
}

export function UserChurnBadges({ signals }: Props) {
  const badges: Array<{
    label: string;
    tone: "red" | "amber" | "blue";
    icon: typeof AlertTriangle;
  }> = [];

  if (signals.has_at_risk_tag) {
    badges.push({
      label: "Tagged at-risk-churn",
      tone: "red",
      icon: AlertTriangle,
    });
  }
  if (signals.open_threads >= 2) {
    badges.push({
      label: `${signals.open_threads} open threads`,
      tone: "red",
      icon: MessageSquare,
    });
  } else if (signals.open_threads === 1) {
    badges.push({
      label: "1 open thread",
      tone: "amber",
      icon: MessageSquare,
    });
  }
  if (signals.threads_30d >= 3) {
    badges.push({
      label: `${signals.threads_30d} threads in 30 days`,
      tone: "amber",
      icon: MessageSquare,
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.map((b) => {
        const Icon = b.icon;
        const cls =
          b.tone === "red"
            ? "border-destructive-subtle bg-destructive-subtle text-destructive-strong"
            : b.tone === "amber"
              ? "border-warning-subtle bg-warning-subtle text-warning-strong"
              : "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300";
        return (
          <span
            key={b.label}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-micro font-medium ${cls}`}
          >
            <Icon className="h-3 w-3" />
            {b.label}
          </span>
        );
      })}
    </div>
  );
}
