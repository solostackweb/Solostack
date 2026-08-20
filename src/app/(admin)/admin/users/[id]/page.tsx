/**
 * /admin/users/[id] - read-only user detail.
 *
 * Phase-1: NO write actions. The page shows everything operationally
 * relevant for triage:
 *
 *   - Profile snapshot (name, email, contact, business identity)
 *   - Subscription summary
 *   - Activity timeline (latest 25 activity_events)
 *   - Security events for this user
 *   - Recent deliveries (email log)
 *   - Recent payments
 *
 * Records an audit row of kind 'user.read' on each visit - DPDP
 * data-access requests are then trivially answerable.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Mail, Shield, FileText, CreditCard, Boxes } from "lucide-react";

import {
  getUserOverview,
  getUserTimeline,
  userHasRazorpaySubscription,
  listAdminNotes,
  getUserEntityCounts,
} from "@/features/admin/queries";
import { AdminNotesPanel } from "@/components/admin/admin-notes";
import {
  listSupportThreadsForUser,
  getUserChurnSignals,
} from "@/features/support/admin-queries";
import { UserSupportThreads } from "@/components/admin/user-support-threads";
import { UserChurnBadges } from "@/components/admin/user-churn-badges";
import {
  recordAdminAction,
  requireAdmin,
} from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSection,
  Badge,
  EmptyState,
  KpiGrid,
  Panel,
  StatCard,
} from "@/components/admin/kit";
import { JsonViewer } from "@/components/admin/json-viewer";
import { UserActions } from "@/components/admin/user-actions";
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

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireAdmin();

  // Audit the read concurrently with the data fetches instead of blocking
  // the page on an extra serial round-trip.
  const auditRead = recordAdminAction({
    actorId: actor.id,
    kind: "user.read",
    targetType: "user",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  // One parallel batch: overview + every panel's data fan out together.
  const [
    overview,
    timeline,
    hasRazorpaySubscription,
    notes,
    supportThreads,
    churn,
    footprint,
  ] = await Promise.all([
    getUserOverview(id),
    getUserTimeline(id),
    userHasRazorpaySubscription(id),
    listAdminNotes("user", id),
    listSupportThreadsForUser(id, 8),
    getUserChurnSignals(id),
    getUserEntityCounts(id),
  ]);

  await auditRead;
  if (!overview) notFound();

  const isBanned =
    overview.banned_until !== null &&
    new Date(overview.banned_until).getTime() > Date.now();

  return (
    <AdminSection>
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> All users
      </Link>

      <AdminPageHeader
        title={overview.full_name}
        subtitle={
          <span className="space-x-2">
            <span className="font-mono">{overview.email}</span>
            <span className="text-muted-foreground/60">-</span>
            <span className="font-mono text-xs">{shortenId(overview.id)}</span>
            <AccountTypeBadge accountType={overview.account_type} />
            {isBanned ? (
              <span className="ml-2 rounded bg-destructive-subtle px-1.5 py-0.5 text-micro uppercase tracking-wider text-destructive-strong">
                Suspended
              </span>
            ) : null}
          </span>
        }
      />

      <UserChurnBadges signals={churn} />

      {/* Top stats */}
      <KpiGrid cols={5}>
        <StatCard
          label="Account"
          value={overview.account_type === "portal_client" ? "Portal client" : "Freelancer"}
        />
        <StatCard label="Plan" value={overview.plan ?? "free"} />
        <StatCard label="Status" value={overview.subscription_status ?? "-"} />
        <StatCard label="Lifetime revenue" value={formatPaiseInr(overview.total_revenue_paise)} tone="info" />
        <StatCard label="Invoices - Clients" value={`${overview.invoice_count} - ${overview.client_count}`} />
      </KpiGrid>

      {/* Profile + Subscription - short, so pair them on wide screens */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile" icon={Shield}>
          <FieldGrid>
            <Field label="Signed up">
              {formatIstStamp(overview.signed_up_at)} IST
            </Field>
            <Field label="Last sign-in">
              {formatRelative(overview.last_sign_in_at)}
            </Field>
            <Field label="Email confirmed">
              {overview.email_confirmed_at
                ? formatIstStamp(overview.email_confirmed_at) + " IST"
                : "Not yet"}
            </Field>
            <Field label="Country">{overview.country || "-"}</Field>
            <Field label="Company">{overview.company_name || "-"}</Field>
            <Field label="Suppressions">
              {overview.suppression_count > 0 ? (
                <span className="text-warning-strong">
                  {overview.suppression_count}
                </span>
              ) : (
                0
              )}
            </Field>
          </FieldGrid>
        </Panel>

        <Panel title="Subscription" icon={CreditCard}>
          <FieldGrid>
            <Field label="Plan">{overview.plan ?? "free"}</Field>
            <Field label="Status">{overview.subscription_status ?? "-"}</Field>
            <Field label="Current period end">
              {overview.current_period_end
                ? formatIstStamp(overview.current_period_end) + " IST"
                : "-"}
            </Field>
            <Field label="Lifetime revenue">
              {formatPaiseInr(overview.total_revenue_paise)}
            </Field>
          </FieldGrid>
        </Panel>
      </div>

      {/* Product footprint (Admin A5) */}
      <Panel title="Footprint" icon={Boxes}>
        <FieldGrid className="sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Clients">{footprint.clients}</Field>
          <Field label="Projects">{footprint.projects}</Field>
          <Field label="Invoices">{footprint.invoices}</Field>
          <Field label="Contracts">{footprint.contracts}</Field>
          <Field label="Welcome docs">{footprint.welcomeDocs}</Field>
          <Field label="Portals">{footprint.portals}</Field>
          <Field label="Time entries">{footprint.timeEntries}</Field>
          <Field label="Files">{footprint.files}</Field>
          <Field label="Support tickets">{footprint.tickets}</Field>
        </FieldGrid>
      </Panel>

      {/* Timelines - two columns on wide screens to cut the vertical scroll */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Activity"
          icon={FileText}
          action={<Badge>{timeline.activity.length}</Badge>}
          bodyClassName="max-h-80 overflow-y-auto scrollbar-thin"
        >
          <Timeline
            items={timeline.activity.map((a) => ({
              id: a.id,
              primary: a.title ?? a.kind,
              secondary: a.kind,
              at: a.created_at,
            }))}
            emptyText="No activity yet."
          />
        </Panel>

        <Panel
          title="Security events"
          icon={Shield}
          action={<Badge>{timeline.security.length}</Badge>}
          bodyClassName="max-h-80 overflow-y-auto scrollbar-thin"
        >
          {timeline.security.length === 0 ? (
            <EmptyState icon={Shield}>
              No security events recorded for this user.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border bg-background/40">
              {timeline.security.map((s) => (
                <li key={s.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          s.severity === "alert"
                            ? "bg-destructive"
                            : s.severity === "warn"
                              ? "bg-warning"
                              : "bg-muted-foreground/50",
                        )}
                      />
                      <span className="font-medium">{s.kind}</span>
                      <span className="text-muted-foreground">{s.severity}</span>
                    </div>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatIstStamp(s.created_at)}
                    </span>
                  </div>
                  {s.metadata &&
                  Object.keys(s.metadata as object).length > 0 ? (
                    <div className="mt-2">
                      <JsonViewer value={s.metadata} defaultExpandDepth={1} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent emails"
          icon={Mail}
          action={<Badge>{timeline.emails.length}</Badge>}
          bodyClassName="max-h-80 overflow-y-auto scrollbar-thin"
        >
          <Timeline
            items={timeline.emails.map((e) => ({
              id: e.id,
              primary: e.kind,
              secondary: e.status,
              at: e.created_at,
            }))}
            emptyText="No emails sent for this user yet."
          />
        </Panel>

        <Panel
          title="Recent payments"
          icon={CreditCard}
          action={<Badge>{timeline.payments.length}</Badge>}
          bodyClassName="max-h-80 overflow-y-auto scrollbar-thin"
        >
          {timeline.payments.length === 0 ? (
            <EmptyState icon={CreditCard}>No payments recorded.</EmptyState>
          ) : (
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border bg-background/40 text-xs">
              {timeline.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.status === "captured"
                          ? "bg-success"
                          : p.status === "failed"
                            ? "bg-destructive"
                            : "bg-muted-foreground/50",
                      )}
                    />
                    <span className="font-medium tabular-nums">
                      {formatPaiseInr(p.amount)}
                    </span>
                    <span className="text-muted-foreground">{p.status}</span>
                  </div>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatIstStamp(p.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <UserSupportThreads userId={overview.id} threads={supportThreads} />

      <AdminNotesPanel targetType="user" targetId={overview.id} notes={notes} />

      <UserActions
        user={{
          id: overview.id,
          email: overview.email,
          full_name: overview.full_name,
          isSuspended: isBanned,
          hasRazorpaySubscription,
        }}
      />
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------

function AccountTypeBadge({
  accountType,
}: {
  accountType: "freelancer" | "portal_client";
}) {
  const isClient = accountType === "portal_client";
  return (
    <span
      className={cn(
        "ml-2 rounded px-1.5 py-0.5 text-micro uppercase tracking-wider",
        isClient
          ? "bg-info-subtle text-info-strong"
          : "bg-success-subtle text-success-strong",
      )}
    >
      {isClient ? "Portal client" : "Freelancer"}
    </span>
  );
}

/** Dense, scannable definition grid - labels sit directly above values. */
function FieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3",
        className,
      )}
    >
      {children}
    </dl>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-sm text-foreground tabular-nums">
        {children}
      </dd>
    </div>
  );
}

function Timeline({
  items,
  emptyText,
}: {
  items: Array<{ id: string; primary: string; secondary: string; at: string }>;
  emptyText: string;
}) {
  if (items.length === 0)
    return <EmptyState icon={FileText}>{emptyText}</EmptyState>;
  return (
    <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border bg-background/40 text-xs">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-center justify-between gap-3 p-2.5"
        >
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{it.primary}</span>
            <span className="truncate text-muted-foreground">
              {it.secondary}
            </span>
          </div>
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
            {formatIstStamp(it.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
