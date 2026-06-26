/**
 * /admin/subscriptions/[id] — detail + actions.
 *
 * Shows:
 *   - Subscription snapshot
 *   - Linked user + jump to user detail
 *   - Latest 25 billing_events
 *   - Latest 25 billing_payments
 *   - Cancel + manual refund actions
 *
 * Records a `subscription.read` audit row on each visit.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getSubscriptionDetail } from "@/features/admin/queries";
import { recordAdminAction, requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, KpiGrid, StatCard } from "@/components/admin/kit";
import { SubscriptionActions } from "@/components/admin/subscription-actions";
import {
  formatIstStamp,
  formatPaiseInr,
  formatRelative,
  shortenId,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminSubscriptionDetail({ params }: Props) {
  const { id } = await params;
  const actor = await requireAdmin();
  const { subscription, payments, events } = await getSubscriptionDetail(id);
  if (!subscription) notFound();

  await recordAdminAction({
    actorId: actor.id,
    kind: "subscription.read",
    targetType: "subscription",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  return (
    <AdminSection>
      <Link
        href="/admin/subscriptions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> All subscriptions
      </Link>

      <AdminPageHeader
        title={`${subscription.full_name} · ${subscription.plan}`}
        subtitle={
          <span className="space-x-2">
            <span className="font-mono">{subscription.email}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono">{shortenId(subscription.id)}</span>
            {subscription.razorpay_subscription_id ? (
              <>
                <span className="text-muted-foreground/60">·</span>
                <span className="font-mono">
                  rzp {shortenId(subscription.razorpay_subscription_id)}
                </span>
              </>
            ) : null}
          </span>
        }
        actions={
          <Link
            href={`/admin/users/${subscription.user_id}`}
            className="rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Open user
          </Link>
        }
      />

      <KpiGrid cols={4}>
        <StatCard label="Plan" value={subscription.plan} />
        <StatCard label="Status" value={subscription.status} />
        <StatCard label="Cycle" value={subscription.billing_cycle} />
        <StatCard label="Period ends" value={formatIstStamp(subscription.current_period_end)} />
      </KpiGrid>

      <SubscriptionActions
        subscription={{
          id: subscription.id,
          user_id: subscription.user_id,
          email: subscription.email,
          status: subscription.status,
        }}
        payments={payments}
      />

      {/* Payments */}
      <section className="space-y-2">
        <SectionTitle count={payments.length}>Recent payments</SectionTitle>
        {payments.length === 0 ? (
          <Empty>No payments on file.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      p.status === "captured"
                        ? "bg-emerald-500"
                        : p.status === "failed"
                          ? "bg-red-500"
                          : p.status === "refunded"
                            ? "bg-amber-500"
                            : "bg-muted-foreground/50",
                    )}
                  />
                  <span className="font-mono tabular-nums">
                    {formatPaiseInr(p.amount)}
                  </span>
                  <span className="text-muted-foreground">{p.status}</span>
                  {p.method ? (
                    <span className="text-muted-foreground/70">{p.method}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.razorpay_payment_id.slice(0, 18)}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatIstStamp(p.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Billing events */}
      <section className="space-y-2">
        <SectionTitle count={events.length}>Razorpay events</SectionTitle>
        {events.length === 0 ? (
          <Empty>No billing events for this user.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      e.error
                        ? "bg-red-500"
                        : e.processed_at
                          ? "bg-emerald-500"
                          : "bg-amber-500",
                    )}
                  />
                  <span className="font-medium">{e.event_type}</span>
                  {e.error ? (
                    <span className="text-red-600 dark:text-red-400">
                      {e.error.slice(0, 60)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {e.event_id.slice(0, 18)}
                  </span>
                  <span
                    className="font-mono tabular-nums text-muted-foreground"
                    title={e.created_at}
                  >
                    {formatRelative(e.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminSection>
  );
}

function SectionTitle({
  count,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {typeof count === "number" ? (
        <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums">
          {count}
        </span>
      ) : null}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
