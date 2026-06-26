/**
 * /admin/sentry — live error feed from Sentry API.
 *
 * Shows:
 *   - Metric bar: 24h event count / fatal / unresolved
 *   - Tab filters: All | Fatal | Error | Warning | Ignored
 *   - Issue list: title, count, last seen, culprit, link to Sentry
 */

import Link from "next/link";
import {
  AlertTriangle,
  Bug,
  ExternalLink,
  ShieldAlert,
  Activity,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { KpiGrid, StatCard } from "@/components/admin/kit";
import {
  getSentryIssues,
  getSentryStats24h,
  isSentryConfigured,
} from "@/lib/sentry-api";
import { formatRelative } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type Tab = "all" | "fatal" | "error" | "warning" | "ignored";
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "Unresolved" },
  { value: "fatal", label: "Fatal" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "ignored", label: "Ignored" },
];

function asString(v: string | string[] | undefined) {
  return typeof v === "string" ? v : undefined;
}

export default async function AdminSentryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tab = (asString(sp.tab) as Tab | undefined) ?? "all";

  if (!isSentryConfigured()) {
    return (
      <div className="space-y-5">
        <AdminPageHeader title="Sentry" subtitle="Error monitoring" />
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          <Bug className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">Sentry not configured</p>
          <p className="mt-1 text-xs">
            Set <code>SENTRY_AUTH_TOKEN</code>, <code>SENTRY_ORG</code>, and{" "}
            <code>SENTRY_PROJECT</code> in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  const queryMap: Record<Tab, string> = {
    all: "is:unresolved",
    fatal: "is:unresolved level:fatal",
    error: "is:unresolved level:error",
    warning: "is:unresolved level:warning",
    ignored: "is:ignored",
  };

  const [stats, issues] = await Promise.all([
    getSentryStats24h(),
    getSentryIssues({ limit: 50, query: queryMap[tab] }),
  ]);

  const fatalCount = issues.filter((i) => i.level === "fatal").length;
  const totalEvents = issues.reduce((s, i) => s + parseInt(i.count, 10), 0);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Sentry"
        subtitle="Live error feed · last 50 issues"
        actions={
          <a
            href={`https://sentry.io/organizations/${process.env.SENTRY_ORG}/issues/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-border/60 bg-background px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Open Sentry <ExternalLink className="h-3 w-3" />
          </a>
        }
      />

      {/* Metric bar */}
      <KpiGrid cols={4}>
        <StatCard
          icon={Activity}
          label="Events (24h)"
          value={stats.total}
          tone={stats.total > 100 ? "alert" : stats.total > 20 ? "warn" : "ok"}
        />
        <StatCard
          icon={ShieldAlert}
          label="Fatal issues"
          value={fatalCount}
          tone={fatalCount > 0 ? "alert" : "ok"}
        />
        <StatCard
          icon={Bug}
          label="Unresolved"
          value={issues.length}
          tone={issues.length > 20 ? "warn" : "ok"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Total events"
          value={totalEvents}
          tone="ok"
        />
      </KpiGrid>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border/60 pb-px">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/sentry?tab=${t.value}`}
            className={cn(
              "whitespace-nowrap rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.value
                ? "border border-b-background bg-background text-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Issue list */}
      {issues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          No issues in this category.
        </div>
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card">
          {issues.map((issue) => (
            <li key={issue.id} className="group p-3.5">
              <div className="flex items-start gap-3">
                {/* Level indicator */}
                <div className={cn(
                  "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                  issue.level === "fatal" ? "bg-red-500"
                  : issue.level === "error" ? "bg-orange-500"
                  : issue.level === "warning" ? "bg-amber-400"
                  : "bg-muted-foreground/40",
                )} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-snug">
                      {issue.title}
                    </span>
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground/50 hover:text-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {issue.culprit && (
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      {issue.culprit}
                    </p>
                  )}

                  {issue.metadata?.value && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                      {issue.metadata.value}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      issue.level === "fatal"
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : issue.level === "error"
                          ? "bg-orange-500/10 text-orange-700 dark:text-orange-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}>
                      {issue.level}
                    </span>
                    {issue.isUnhandled && (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
                        unhandled
                      </span>
                    )}
                    <span className="tabular-nums">
                      {parseInt(issue.count, 10).toLocaleString("en-IN")} events
                    </span>
                    {issue.userCount > 0 && (
                      <span>{issue.userCount} users affected</span>
                    )}
                    <span>last {formatRelative(issue.lastSeen)}</span>
                    <span>first {formatRelative(issue.firstSeen)}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricCard({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "ok" | "warn" | "alert";
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      tone === "alert" ? "border-red-500/30 bg-red-500/5"
      : tone === "warn" ? "border-amber-500/30 bg-amber-500/5"
      : "border-border/60 bg-card",
    )}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className={cn(
        "mt-1.5 text-2xl font-semibold tabular-nums",
        tone === "alert" ? "text-red-600 dark:text-red-400"
        : tone === "warn" ? "text-amber-600 dark:text-amber-400"
        : "text-foreground",
      )}>
        {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}
