/**
 * /admin/subscriptions - list view.
 *
 * Status tabs (Active / Trialing / Past due / Cancelled) with counts
 * resolved in parallel. Click into a row to inspect billing_events +
 * payments timeline, comp/refund/cancel.
 */

import Link from "next/link";
import { CreditCard, Zap, AlertCircle, XCircle } from "lucide-react";
import { listSubscriptions } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSection,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
  KpiGrid,
  StatCard,
} from "@/components/admin/kit";
import {
  formatIstStamp,
  formatRelative,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 25;
const TABS = ["active", "trialing", "past_due", "canceled", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = parseTab(asString(sp.status)) ?? "active";
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listSubscriptions({
    status: status === "all" ? "all" : status,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Subscriptions"
        subtitle={
          <span>
            {result.total.toLocaleString("en-IN")} in this tab - page {page} /{" "}
            {totalPages}
          </span>
        }
      />

      <KpiGrid cols={4}>
        <StatCard
          href="/admin/subscriptions?status=active"
          icon={CreditCard}
          label="Active"
          value={result.counts.active.toLocaleString("en-IN")}
          tone="ok"
        />
        <StatCard
          href="/admin/subscriptions?status=trialing"
          icon={Zap}
          label="Trialing"
          value={result.counts.trialing.toLocaleString("en-IN")}
          tone="info"
        />
        <StatCard
          href="/admin/subscriptions?status=past_due"
          icon={AlertCircle}
          label="Past due"
          value={result.counts.past_due.toLocaleString("en-IN")}
          tone={result.counts.past_due > 0 ? "alert" : "neutral"}
        />
        <StatCard
          href="/admin/subscriptions?status=canceled"
          icon={XCircle}
          label="Cancelled"
          value={result.counts.canceled.toLocaleString("en-IN")}
          tone="neutral"
        />
      </KpiGrid>

      <div className="flex flex-wrap gap-1.5 rounded-lg border bg-card/95 p-1.5 shadow-sm shadow-black/[0.025] dark:bg-card">
        {TABS.map((t) => {
          const label = TAB_LABELS[t];
          const count =
            t === "all"
              ? result.counts.active +
                result.counts.trialing +
                result.counts.past_due +
                result.counts.canceled
              : result.counts[t];
          const active = t === status;
          return (
            <Link
              key={t}
              href={`/admin/subscriptions?status=${t}`}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-lg bg-muted px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-background/20 text-background"
                    : "text-muted-foreground",
                )}
              >
                {count.toLocaleString("en-IN")}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {result.rows.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border bg-card p-3 text-sm shadow-sm shadow-black/[0.03]"
          >
            <Link
              href={`/admin/subscriptions/${row.id}`}
              className="space-y-0.5"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{row.full_name}</span>
                <span className="text-micro text-muted-foreground">
                  {formatRelative(row.updated_at)}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {row.email}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <PlanTag plan={row.plan} />
                <StatusBadge status={row.status} />
                {row.razorpay_subscription_id ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    razorpay
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <AdminTableShell className="hidden md:block">
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>User</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Cycle</AdminTh>
              <AdminTh className="tabular-nums">Period end</AdminTh>
              <AdminTh>Source</AdminTh>
              <AdminTh className="tabular-nums">Updated</AdminTh>
            </tr>
          </AdminThead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No subscriptions in this tab.
                </td>
              </tr>
            ) : (
              result.rows.map((row) => (
                <AdminTr key={row.id}>
                  <AdminTd>
                    <Link
                      href={`/admin/subscriptions/${row.id}`}
                      className="block leading-tight"
                    >
                      <div className="font-medium">{row.full_name}</div>
                      <div className="truncate text-micro text-muted-foreground">
                        {row.email}
                      </div>
                    </Link>
                  </AdminTd>
                  <AdminTd>
                    <PlanTag plan={row.plan} />
                  </AdminTd>
                  <AdminTd>
                    <StatusBadge status={row.status} />
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {row.billing_cycle}
                  </AdminTd>
                  <AdminTd className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatIstStamp(row.current_period_end)}
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {row.razorpay_subscription_id ? "razorpay" : "manual"}
                  </AdminTd>
                  <AdminTd className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatRelative(row.updated_at)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-xs">
          <PageLink page={Math.max(1, page - 1)} status={status} disabled={page === 1}>
            Prev
          </PageLink>
          <span className="text-muted-foreground tabular-nums">
            Page {page} / {totalPages}
          </span>
          <PageLink
            page={Math.min(totalPages, page + 1)}
            status={status}
            disabled={page === totalPages}
          >
            Next
          </PageLink>
        </nav>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Showing most recent updates first. Manual ops (comp / refund /
        cancel) live in the detail page.
      </p>
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------

const TAB_LABELS: Record<Tab, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Cancelled",
  all: "All",
};

function PlanTag({ plan }: { plan: string }) {
  const tone =
    plan === "business"
      ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
      : plan === "pro"
        ? "bg-info-subtle text-info-strong"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-micro font-medium uppercase tracking-wider",
        tone,
      )}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" || status === "trialing"
      ? "bg-success-subtle text-success-strong"
      : status === "past_due"
        ? "bg-destructive-subtle text-destructive-strong"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-micro font-medium uppercase tracking-wider",
        tone,
      )}
    >
      {status}
    </span>
  );
}

function PageLink({
  page,
  status,
  disabled,
  children,
}: {
  page: number;
  status: Tab;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border px-2 py-1 opacity-40">{children}</span>
    );
  }
  return (
    <Link
      href={`/admin/subscriptions?status=${status}&page=${page}`}
      className="rounded border px-2 py-1 hover:bg-accent"
    >
      {children}
    </Link>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseTab(v: string | undefined): Tab | undefined {
  return (TABS as readonly string[]).includes(v ?? "") ? (v as Tab) : undefined;
}
