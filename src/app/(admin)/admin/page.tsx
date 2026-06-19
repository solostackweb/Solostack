/**
 * /admin - command center.
 *
 * A founder-facing operating room: top-level health, work queue,
 * integration status, and recent audit activity. This page deliberately
 * reuses the existing service-role query layer so the redesign does not
 * expand the data blast radius.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bug,
  CheckCircle2,
  CreditCard,
  Gauge,
  LifeBuoy,
  Mail,
  ShieldAlert,
  Users,
  Zap,
  Clock,
} from "lucide-react";
import {
  getRecentAlerts,
  getRecentAdminActivity,
} from "@/features/admin/queries";
import { getAdminNowData } from "@/features/admin/metrics-cache";
import { AdminPageHeader } from "@/components/admin/page-header";
import { type StatTone } from "@/components/admin/stat";
import {
  formatIstStamp,
  formatPaiseInr,
  formatRelative,
  shortenId,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";
import { isBrevoConfigured } from "@/lib/brevo-api";
import { isRazorpayConfigured } from "@/lib/razorpay-api";
import { isSentryConfigured, getSentryStats24h, getSentryIssues } from "@/lib/sentry-api";
import { NowAutoRefresh } from "@/components/admin/now-auto-refresh";
import { getCronHealthSummary } from "@/features/admin/cron-queries";

export const dynamic = "force-dynamic";

export default async function AdminNowPage() {
  const [now, alerts, recent] = await Promise.all([
    getAdminNowData(),
    getRecentAlerts(5),
    getRecentAdminActivity(10),
  ]);
  const { revenue, pipeline, comms, support } = now;

  // Reliability signals (Admin A2): inline Sentry + support SLA breaches.
  const sentryConfigured = isSentryConfigured();
  const [sentryStats, sentryIssues] = sentryConfigured
    ? await Promise.all([
        getSentryStats24h(),
        getSentryIssues({ query: "is:unresolved", limit: 100 }),
      ])
    : [null, [] as Awaited<ReturnType<typeof getSentryIssues>>];
  const sentryEvents = sentryStats?.total ?? 0;
  const sentryUnresolved = sentryIssues.length;
  const sentryUnresolvedLabel = sentryUnresolved >= 100 ? "100+" : String(sentryUnresolved);
  const slaBreached = now.supportMetrics.slaBreached;
  const cronHealth = await getCronHealthSummary();
  const cronProblems = cronHealth.stale + cronHealth.failing;

  const emailFailureCount =
    comms.emailFailuresLast24h +
    comms.suppressionsAddedLast24h;
  const operationalLoad =
    support.total_open +
    revenue.pastDueLast7d +
    comms.securityAlertsLast24h +
    comms.emailFailuresLast24h +
    pipeline.trialingEndingSoon;
  const commandTone: StatTone =
    comms.securityAlertsLast24h > 0 || comms.emailFailuresLast24h >= 5
      ? "alert"
      : operationalLoad > 0
        ? "warn"
        : "ok";

  const queueItems: QueueItem[] = [
    {
      href: "/admin/support",
      icon: LifeBuoy,
      title: "Support inbox",
      detail:
        support.total_open > 0
          ? `${support.total_open} open thread${support.total_open === 1 ? "" : "s"}`
          : "Inbox is clean",
      value: support.total_open,
      tone:
        support.total_open >= 10
          ? "alert"
          : support.total_open > 0
            ? "warn"
            : "ok",
    },
    {
      href: "/admin/security?severity=alert",
      icon: ShieldAlert,
      title: "Security alerts",
      detail:
        comms.securityAlertsLast24h > 0
          ? "Review high-severity events from the last 24h"
          : "No alert-level events",
      value: comms.securityAlertsLast24h,
      tone: comms.securityAlertsLast24h > 0 ? "alert" : "ok",
    },
    {
      href: "/admin/emails?status=failed",
      icon: Mail,
      title: "Email delivery",
      detail:
        emailFailureCount > 0
          ? `${comms.emailFailuresLast24h} failures, ${comms.suppressionsAddedLast24h} new suppressions`
          : "No delivery issues found",
      value: emailFailureCount,
      tone:
        comms.emailFailuresLast24h >= 5
          ? "alert"
          : emailFailureCount > 0
            ? "warn"
            : "ok",
    },
    {
      href: "/admin/subscriptions?status=past_due",
      icon: CreditCard,
      title: "Billing recovery",
      detail:
        revenue.pastDueLast7d > 0
          ? "Past-due subscriptions changed in the last 7d"
          : "No fresh past-due movement",
      value: revenue.pastDueLast7d,
      tone: revenue.pastDueLast7d > 0 ? "warn" : "ok",
    },
    {
      href: "/admin/subscriptions?status=trialing",
      icon: Zap,
      title: "Trials ending",
      detail:
        pipeline.trialingEndingSoon > 0
          ? "Trialing accounts ending within 3 days"
          : "No trials need attention",
      value: pipeline.trialingEndingSoon,
      tone: pipeline.trialingEndingSoon > 0 ? "warn" : "ok",
    },
  ];

  const integrations: IntegrationItem[] = [
    {
      label: "Razorpay",
      href: "/admin/razorpay",
      configured: isRazorpayConfigured(),
      description: "Live payments and subscription metrics",
    },
    {
      label: "Brevo",
      href: "/admin/emails",
      configured: isBrevoConfigured(),
      description: "Email stats, logs, and suppressions",
    },
    {
      label: "Sentry",
      href: "/admin/sentry",
      configured: isSentryConfigured(),
      description: "Error feed and unresolved issues",
    },
    {
      label: "Slack",
      href: "/admin/settings",
      configured: !!process.env.OPS_SLACK_WEBHOOK_URL?.trim(),
      description: "Ops alert webhook",
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Command Center"
        subtitle={
          <span className="tabular-nums">
            {formatIstStamp(new Date().toISOString())} IST - operational view
          </span>
        }
        actions={
          <>
            <NowAutoRefresh computedAt={now.computedAt} cached={now.cached} />
            <HeaderLink href="/admin/users" icon={Users}>
              Users
            </HeaderLink>
            <HeaderLink href="/admin/support" icon={LifeBuoy}>
              Support
            </HeaderLink>
            <HeaderLink href="/admin/settings" icon={Gauge}>
              Settings
            </HeaderLink>
          </>
        }
      />

      <section className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <div
          className={cn(
            "rounded-lg border bg-card p-4",
            commandTone === "alert" && "border-red-500/30 bg-red-500/5",
            commandTone === "warn" && "border-amber-500/30 bg-amber-500/5",
            commandTone === "ok" && "border-emerald-500/20 bg-emerald-500/5",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <StatusDot tone={commandTone} />
                Today
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {commandTone === "alert"
                  ? "Needs attention"
                  : commandTone === "warn"
                    ? "Watchlist active"
                    : "Systems steady"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {operationalLoad > 0
                  ? `${operationalLoad.toLocaleString("en-IN")} item${operationalLoad === 1 ? "" : "s"} are worth a founder pass right now.`
                  : "No urgent support, billing, email, or security items are currently flagged."}
              </p>
            </div>
            <div className="rounded-md border bg-background/70 px-3 py-2 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Captured 24h
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatPaiseInr(revenue.capturedTodayPaise)}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                {formatPaiseInr(revenue.capturedWeekPaise)} this week
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniMetric
              label="Open support"
              value={support.total_open}
              tone={support.total_open > 0 ? "warn" : "ok"}
            />
            <MiniMetric
              label="Email failures"
              value={comms.emailFailuresLast24h}
              tone={comms.emailFailuresLast24h > 0 ? "alert" : "ok"}
            />
            <MiniMetric
              label="Security alerts"
              value={comms.securityAlertsLast24h}
              tone={comms.securityAlertsLast24h > 0 ? "alert" : "ok"}
            />
            <MiniMetric
              label="Past due"
              value={revenue.pastDueLast7d}
              tone={revenue.pastDueLast7d > 0 ? "warn" : "ok"}
            />
          </div>
        </div>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Integration Health</h2>
            <Link
              href="/admin/settings"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              configure
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {integrations.map((item) => (
              <IntegrationRow key={item.label} item={item} />
            ))}
          </div>
        </section>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {sentryConfigured ? (
          <>
            <ReliabilityStat href="/admin/sentry" icon={Bug} label="Errors 24h" value={sentryEvents} tone={sentryEvents > 0 ? "warn" : "ok"} />
            <ReliabilityStat href="/admin/sentry" icon={AlertTriangle} label="Unresolved" value={sentryUnresolvedLabel} tone={sentryUnresolved > 0 ? "warn" : "ok"} />
          </>
        ) : null}
        <ReliabilityStat href="/admin/support?tab=needs_reply" icon={Clock} label="SLA breached" value={slaBreached} tone={slaBreached > 0 ? "alert" : "ok"} />
        <ReliabilityStat href="/admin/support?tab=needs_reply" icon={LifeBuoy} label="Needs reply" value={now.supportMetrics.needsReply} tone={now.supportMetrics.needsReply > 0 ? "warn" : "ok"} />
        <ReliabilityStat href="/admin/jobs" icon={Clock} label="Jobs at risk" value={cronProblems} tone={cronHealth.failing > 0 ? "alert" : cronProblems > 0 ? "warn" : "ok"} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel
            title="Work Queue"
            subtitle="Ordered by operational risk, not route order."
            action={
              <Link
                href="/admin/support"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                triage <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            <div className="grid gap-2 md:grid-cols-2">
              {queueItems.map((item) => (
                <QueueCard key={item.title} item={item} />
              ))}
            </div>
          </Panel>

          <Panel title="Operating Metrics" subtitle="Revenue, pipeline, support, and communications.">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="Revenue"
                items={[
                  ["Captured today", formatPaiseInr(revenue.capturedTodayPaise)],
                  ["Captured week", formatPaiseInr(revenue.capturedWeekPaise)],
                  ["Active subs", revenue.activeSubscriptions.toLocaleString("en-IN")],
                  ["Past due 7d", revenue.pastDueLast7d.toLocaleString("en-IN")],
                ]}
              />
              <MetricCard
                title="Pipeline"
                items={[
                  ["Signups 24h", pipeline.signupsLast24h.toLocaleString("en-IN")],
                  ["Signups 7d", pipeline.signupsLast7d.toLocaleString("en-IN")],
                  ["Unverified >7d", pipeline.unverifiedOlderThan7d.toLocaleString("en-IN")],
                  ["Trials <=3d", pipeline.trialingEndingSoon.toLocaleString("en-IN")],
                ]}
              />
              <MetricCard
                title="Support"
                items={[
                  ["Open chats 24h", support.open_chats_24h.toLocaleString("en-IN")],
                  ["Open tickets", support.open_tickets.toLocaleString("en-IN")],
                  ["Total open", support.total_open.toLocaleString("en-IN")],
                  ["Resolved 7d", support.resolved_7d.toLocaleString("en-IN")],
                ]}
              />
              <MetricCard
                title="Comms"
                items={[
                  ["Email failures", comms.emailFailuresLast24h.toLocaleString("en-IN")],
                  ["Suppressions", comms.suppressionsAddedLast24h.toLocaleString("en-IN")],
                  ["Security alerts", comms.securityAlertsLast24h.toLocaleString("en-IN")],
                  ["Security events", comms.securityEventsLast24h.toLocaleString("en-IN")],
                ]}
              />
            </div>
          </Panel>

          <Panel
            title="What Broke"
            subtitle="Recent alert-level security events."
            action={
              <Link
                href="/admin/security?severity=alert"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                security <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {alerts.length === 0 ? (
              <EmptyHint icon={CheckCircle2}>No alert-level security events in the last 24h.</EmptyHint>
            ) : (
              <ul className="divide-y divide-border/50 overflow-hidden rounded-md border bg-background/50">
                {alerts.map((alert) => (
                  <li key={alert.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{alert.kind}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {alert.request_id ? `req ${shortenId(alert.request_id)} - ` : null}
                        {alert.user_id ? `user ${shortenId(alert.user_id)} - ` : null}
                        {formatRelative(alert.created_at)}
                      </div>
                    </div>
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel
            title="Quick Jumps"
            subtitle="High-frequency controls."
          >
            <div className="grid gap-2">
              <QuickLink href="/admin/users" icon={Users} label="Find user" />
              <QuickLink href="/admin/subscriptions" icon={CreditCard} label="Manage subscription" />
              <QuickLink href="/admin/emails" icon={Mail} label="Inspect email delivery" />
              <QuickLink href="/admin/notifications" icon={Bell} label="Broadcast notification" />
              <QuickLink href="/admin/sentry" icon={Bug} label="Review errors" />
            </div>
          </Panel>

          <Panel
            title="Recent Admin Activity"
            subtitle="Last 10 audited operations."
            action={
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                audit <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {recent.length === 0 ? (
              <EmptyHint icon={Gauge}>No writes have been audited yet.</EmptyHint>
            ) : (
              <ul className="space-y-2">
                {recent.map((row) => (
                  <li key={row.id} className="rounded-md border bg-background/50 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          row.success ? "bg-emerald-500" : "bg-red-500",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {row.kind}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {row.duration_ms}ms
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {row.target_type}
                      {row.target_id ? ` - ${shortenId(row.target_id)}` : ""}
                      {" - "}
                      {formatRelative(row.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </section>
    </div>
  );
}

interface QueueItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  value: number;
  tone: StatTone;
}

function ReliabilityStat({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: StatTone;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg border bg-card p-3 transition hover:bg-accent/40",
        tone === "alert" && "border-red-500/30 bg-red-500/5",
        tone === "warn" && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </Link>
  );
}

interface IntegrationItem {
  label: string;
  href: string;
  configured: boolean;
  description: string;
}

function HeaderLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

function StatusDot({ tone }: { tone: StatTone }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        tone === "alert" && "bg-red-500",
        tone === "warn" && "bg-amber-500",
        tone === "ok" && "bg-emerald-500",
        tone === "neutral" && "bg-muted-foreground",
      )}
    />
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className="rounded-md border bg-background/65 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "alert" && "text-red-600 dark:text-red-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-start gap-3 rounded-md border bg-background/60 p-3 transition-colors hover:bg-accent/60",
        item.tone === "alert" && "border-red-500/30",
        item.tone === "warn" && "border-amber-500/30",
        item.tone === "ok" && "border-emerald-500/20",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          item.tone === "alert" && "bg-red-500/10 text-red-600",
          item.tone === "warn" && "bg-amber-500/10 text-amber-600",
          item.tone === "ok" && "bg-emerald-500/10 text-emerald-600",
          item.tone === "neutral" && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="font-medium">{item.title}</span>
          <span className="text-lg font-semibold tabular-nums">
            {item.value.toLocaleString("en-IN")}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {item.detail}
        </span>
      </span>
      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}

function IntegrationRow({ item }: { item: IntegrationItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-3 rounded-md border bg-background/50 px-3 py-2 text-xs hover:bg-accent/50"
    >
      <span className="min-w-0">
        <span className="block font-medium">{item.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {item.description}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
          item.configured
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        )}
      >
        {item.configured ? "live" : "setup"}
      </span>
    </Link>
  );
}

function MetricCard({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="rounded-md border bg-background/50 p-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <dl className="mt-2 space-y-1.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-md border bg-background/50 px-3 py-2 text-sm hover:bg-accent/60"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </Link>
  );
}

function EmptyHint({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-background/40 px-3 py-4 text-xs text-muted-foreground">
      <Icon className="h-4 w-4" />
      {children}
    </div>
  );
}
