/**
 * /admin/subscriptions/[id] - detail + actions.
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
import { ChevronLeft, CreditCard, Activity } from "lucide-react";

import { getSubscriptionDetail } from "@/features/admin/queries";
import { recordAdminAction, requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSection,
  Badge,
  EmptyState,
  KpiGrid,
  Panel,
  StatCard,
} from "@/components/admin/kit";
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

  // Audit the read concurrently with the detail fetch, off the critical path.
  const auditRead = recordAdminAction({
    actorId: actor.id,
    kind: "subscription.read",
    targetType: "subscription",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  const { subscription, payments, events } = await getSubscriptionDetail(id);
  await auditRead;
  if (!subscription) notFound();

  return (
    <AdminSection>
      <Link
        href="/admin/subscriptions"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> All subscriptions
      </Link>

      <AdminPageHeader
        title={`${subscription.full_name} - ${subscription.plan}`}
        subtitle={
          <span className="space-x-2">
            <span className="font-mono">{subscription.email}</span>
            <span className="text-muted-foreground/60">-</span>
            <span className="font-mono">{shortenId(subscription.id)}</span>
            {subscription.razorpay_subscription_id ? (
              <>
                <span className="text-muted-foreground/60">-</span>
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
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

      {/* Payments + billing events, side by side on wide screens */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Recent payments"
          icon={CreditCard}
          action={<Badge>{payments.length}</Badge>}
          bodyClassName="max-h-96 overflow-y-auto scrollbar-thin"
        >
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard}>No payments on file.</EmptyState>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border bg-background/40 text-xs">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.status === "captured"
                          ? "bg-success"
                          : p.status === "failed"
                            ? "bg-destructive"
                            : p.status === "refunded"
                              ? "bg-warning"
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
                    <span className="font-mono text-xs text-muted-foreground">
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
        </Panel>

        <Panel
          title="Razorpay events"
          icon={Activity}
          action={<Badge>{events.length}</Badge>}
          bodyClassName="max-h-96 overflow-y-auto scrollbar-thin"
        >
          {events.length === 0 ? (
            <EmptyState icon={Activity}>
              No billing events for this user.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border bg-background/40 text-xs">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        e.error
                          ? "bg-destructive"
                          : e.processed_at
                            ? "bg-success"
                            : "bg-warning",
                      )}
                    />
                    <span className="font-medium">{e.event_type}</span>
                    {e.error ? (
                      <span className="text-destructive-strong">
                        {e.error.slice(0, 60)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
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
        </Panel>
      </div>
    </AdminSection>
  );
}
