/**
 * /admin/support - first-party ticket inbox.
 *
 *   1. Metric bar  - needs reply / waiting on customer / resolved 7d / SLA breaches
 *   2. Tab bar     - All | Needs reply | Waiting | Resolved | Delivery failures
 *   3. List        - tickets (plan + priority + SLA) -> /admin/support/[id]
 */

import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  ArrowRight,
  User,
} from "lucide-react";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import {
  adminListTickets,
  getSupportMetrics,
  type AdminTicketTab,
} from "@/features/support/admin-tickets";
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge";
import { formatRelative } from "@/features/admin/format";
import { cn } from "@/lib/utils";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TABS: { value: AdminTicketTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "waiting", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "failures", label: "Delivery failures" },
];

interface FailureRow {
  id: string;
  user_id: string;
  kind: string;
  status: string;
  to_email: string | null;
  subject: string | null;
  error: string | null;
  created_at: string;
}

async function fetchRecentFailures(): Promise<FailureRow[]> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("delivery_logs")
    .select("id, user_id, kind, status, to_email, subject, error, created_at")
    .in("status", ["failed", "bounced", "blocked"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (result.error) {
    log.warn("admin.support.fetch_failures_failed", { error: result.error.message });
    return [];
  }
  return (result.data as FailureRow[] | null) ?? [];
}

function asString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export default async function AdminSupportPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = (asString(sp.tab) as AdminTicketTab | undefined) ?? "all";
  const search = asString(sp.q) ?? "";

  const [metrics, tickets, failures] = await Promise.all([
    getSupportMetrics(),
    tab !== "failures"
      ? adminListTickets({ tab, search, limit: 100 })
      : Promise.resolve([]),
    tab === "failures" ? fetchRecentFailures() : Promise.resolve([]),
  ]);

  const now = Date.now();

  return (
    <AdminSection>
      <AdminPageHeader
        title="Support"
        subtitle="First-party tickets - live chat - delivery failures"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={<AlertCircle className="h-4 w-4 text-blue-500" />} label="Needs reply" value={metrics.needsReply} tone={metrics.needsReply > 5 ? "alert" : "ok"} />
        <MetricCard icon={<Clock className="h-4 w-4 text-violet-500" />} label="Waiting on customer" value={metrics.waitingOnCustomer} tone="ok" />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Resolved (7d)" value={metrics.resolved7d} tone="ok" />
        <MetricCard icon={<AlertTriangle className="h-4 w-4 text-red-500" />} label="SLA breached" value={metrics.slaBreached} tone={metrics.slaBreached > 0 ? "alert" : "ok"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto border-b border-border/60 pb-px">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={`/admin/support?tab=${t.value}`}
              className={cn(
                "whitespace-nowrap rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.value
                  ? "-mb-px border border-b-background bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        {tab !== "failures" ? (
          <form className="flex items-center gap-1" action="/admin/support">
            <input type="hidden" name="tab" value={tab} />
            <input
              name="q"
              defaultValue={search}
              placeholder="Search subject / email"
              className="h-8 w-48 rounded-md border bg-background px-2 text-xs"
            />
          </form>
        ) : null}
      </div>

      {tab !== "failures" ? (
        tickets.length === 0 ? (
          <EmptyState message="No tickets here yet." />
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card">
            {tickets.map((t) => {
              const breached =
                !t.first_response_at &&
                t.sla_due_at != null &&
                Date.parse(t.sla_due_at) < now &&
                t.status !== "resolved" &&
                t.status !== "closed";
              return (
                <li key={t.id}>
                  <Link href={`/admin/support/${t.id}`} className="flex items-start gap-3 p-3.5 transition-colors hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TicketStatusBadge status={t.status} audience="admin" />
                        <span className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                          t.plan_at_creation === "business"
                            ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                            : t.plan_at_creation === "pro"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                              : "bg-muted text-muted-foreground",
                        )}>
                          {t.plan_at_creation}
                        </span>
                        {(t.priority === "high" || t.priority === "urgent") && (
                          <span className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                            t.priority === "urgent" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-orange-500/10 text-orange-700 dark:text-orange-300",
                          )}>
                            {t.priority}
                          </span>
                        )}
                        {breached && (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
                            SLA
                          </span>
                        )}
                        <span className="truncate text-[13px] font-medium">{t.subject}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" /> {t.email}
                        </span>
                        {t.category ? <span>{t.category}</span> : null}
                        <span>{formatRelative(t.last_message_at)}</span>
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : failures.length === 0 ? (
        <EmptyState message="No delivery failures. 🎉" />
      ) : (
        <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card">
          {failures.map((f) => (
            <li key={f.id} className="flex items-start gap-3 p-3.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Mail className="h-3.5 w-3.5 text-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
                    {f.status}
                  </span>
                  <span className="truncate text-[13px] font-medium">{f.subject ?? f.kind}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{f.to_email ?? "-"}</span>
                  <span>{formatRelative(f.created_at)}</span>
                  {f.error ? <span className="truncate text-red-600/80">{f.error}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminSection>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "ok" | "warn" | "alert";
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3",
      tone === "alert" && "border-red-500/30",
      tone === "warn" && "border-amber-500/30",
    )}>
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
