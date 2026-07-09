/**
 * /admin/razorpay
 *
 * Live payment and subscription metrics pulled from the Razorpay API.
 * Requires RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in environment.
 *
 * Sections:
 *   1. KPI cards       - 30-day revenue, success rate, unique payers
 *   2. Subscription    - active / pending / halted / cancelled counts
 *   3. Payment method  - breakdown by method (UPI, card, netbanking...)
 *   4. Recent payments - last 25 transactions with status badges
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/kit";
import { cn } from "@/lib/utils";
import {
  isRazorpayConfigured,
  listRecentPayments,
  listRecentSubscriptions,
  computePaymentMetrics,
  summarizeSubscriptions,
  formatPaise,
  formatEpoch,
  type RazorpayPayment,
} from "@/lib/razorpay-api";

export const dynamic = "force-dynamic";

export default async function AdminRazorpayPage() {
  await requireAdmin();

  if (!isRazorpayConfigured()) {
    return (
      <div className="space-y-4">
        <AdminPageHeader
          title="Payments"
          subtitle="Razorpay integration"
        />
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">Razorpay not configured</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Set <code className="text-xs">RAZORPAY_KEY_ID</code> and{" "}
            <code className="text-xs">RAZORPAY_KEY_SECRET</code> in your
            environment variables to enable payment metrics.
          </p>
          <Link
            href="https://dashboard.razorpay.com/app/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Razorpay API Keys <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  const [payments, subscriptions] = await Promise.all([
    listRecentPayments(100),
    listRecentSubscriptions(100),
  ]);

  const metrics = computePaymentMetrics(payments);
  const subSummary = summarizeSubscriptions(subscriptions);
  const recentPayments = payments.slice(0, 25);

  const isTestMode = (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_test_");

  return (
    <AdminSection>
      <AdminPageHeader
        title="Payments"
        subtitle={
          <span className="flex items-center gap-2">
            <span>Razorpay - Last 30 days</span>
            {isTestMode && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                Test Mode
              </span>
            )}
          </span>
        }
        actions={
          <Link
            href="https://dashboard.razorpay.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Open Razorpay Dashboard <ExternalLink className="h-3 w-3" />
          </Link>
        }
      />

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Revenue (30 days)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Captured"
            value={formatPaise(metrics.totalCaptured)}
            tone="good"
          />
          <KpiCard
            label="Transactions"
            value={metrics.totalCapturedCount}
            tone="neutral"
          />
          <KpiCard
            label="Success Rate"
            value={metrics.successRate !== null ? `${metrics.successRate}%` : "-"}
            tone={
              metrics.successRate === null
                ? "neutral"
                : metrics.successRate >= 90
                  ? "good"
                  : metrics.successRate >= 75
                    ? "warn"
                    : "bad"
            }
          />
          <KpiCard
            label="Failed Amount"
            value={formatPaise(metrics.totalFailed)}
            tone={metrics.totalFailedCount > 0 ? "bad" : "good"}
          />
          <KpiCard
            label="Failed Txns"
            value={metrics.totalFailedCount}
            tone={metrics.totalFailedCount > 0 ? "warn" : "good"}
          />
          <KpiCard
            label="Unique Payers"
            value={metrics.uniquePayers}
            tone="neutral"
          />
        </div>
      </section>

      {/* ── Subscription summary ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Subscriptions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Active" value={subSummary.active} tone="good" />
          <KpiCard
            label="Pending"
            value={subSummary.pending}
            tone={subSummary.pending > 0 ? "warn" : "neutral"}
          />
          <KpiCard
            label="Halted"
            value={subSummary.halted}
            tone={subSummary.halted > 0 ? "bad" : "neutral"}
          />
          <KpiCard
            label="Cancelled"
            value={subSummary.cancelled}
            tone="neutral"
          />
        </div>
      </section>

      {/* ── Method breakdown ──────────────────────────────────────────────── */}
      {Object.keys(metrics.byMethod).length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Payment Methods (30 days)</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.byMethod)
              .sort((a, b) => b[1] - a[1])
              .map(([method, count]) => (
                <span
                  key={method}
                  className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium"
                >
                  {method.toUpperCase()} - {count}
                </span>
              ))}
          </div>
        </section>
      )}

      {/* ── Recent payments ────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Recent Payments
          <span className="ml-2 font-normal text-muted-foreground">
            (last {recentPayments.length})
          </span>
        </h2>

        {recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent payments found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------
// PaymentRow
// ---------------------------------------------------------------------------

function PaymentRow({ payment }: { payment: RazorpayPayment }) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="px-3 py-2 font-mono text-muted-foreground">
        {payment.id.slice(4, 14)}...
      </td>
      <td className="px-3 py-2 tabular-nums">
        {formatPaise(payment.amount)}
      </td>
      <td className="px-3 py-2">
        <PaymentStatusBadge status={payment.status} />
      </td>
      <td className="px-3 py-2 uppercase">{payment.method}</td>
      <td className="px-3 py-2 max-w-[160px] truncate text-muted-foreground">
        {payment.email ?? "-"}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        {formatEpoch(payment.created_at)}
      </td>
      <td className="px-3 py-2">
        <Link
          href={`https://dashboard.razorpay.com/app/payments/${payment.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
          title="Open in Razorpay"
        >
          <ExternalLink className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type CardTone = "good" | "warn" | "bad" | "neutral";

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: CardTone;
}) {
  const kitTone =
    tone === "good" ? "ok" : tone === "bad" ? "alert" : tone === "warn" ? "warn" : "neutral";
  return (
    <StatCard
      label={label}
      value={typeof value === "number" ? value.toLocaleString("en-IN") : value}
      tone={kitTone}
    />
  );
}

function PaymentStatusBadge({ status }: { status: RazorpayPayment["status"] }) {
  const cls =
    status === "captured"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
      : status === "failed"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : status === "refunded"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        cls,
      )}
    >
      {status}
    </span>
  );
}
