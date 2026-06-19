"use client";

/**
 * Now-page live refresh + freshness stamp (Admin hardening A2).
 *
 * Shows "Updated <relative>" and silently re-fetches the server component on
 * an interval so the founder's operating room stays current without a manual
 * reload. Pauses while the tab is hidden to avoid needless load.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

function relative(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff) || diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export function NowAutoRefresh({
  computedAt,
  cached,
  intervalMs = 60_000,
}: {
  computedAt: string;
  cached?: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [label, setLabel] = React.useState(() => relative(computedAt));

  React.useEffect(() => {
    setLabel(relative(computedAt));
    const labelTimer = setInterval(() => setLabel(relative(computedAt)), 15_000);
    const refreshTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => {
      clearInterval(labelTimer);
      clearInterval(refreshTimer);
    };
  }, [computedAt, intervalMs, router]);

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
      title={cached ? "Served from cache" : "Freshly computed"}
    >
      <RefreshCw className="h-3 w-3" />
      Updated {label}
    </span>
  );
}
