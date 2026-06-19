/**
 * /admin/users/[id] — read-only user detail.
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
 * Records an audit row of kind 'user.read' on each visit — DPDP
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

  const overview = await getUserOverview(id);
  if (!overview) notFound();

  // Audit the read. Fire-and-forget — we don't await failure.
  await recordAdminAction({
    actorId: actor.id,
    kind: "user.read",
    targetType: "user",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  const [timeline, hasRazorpaySubscription, notes, supportThreads, churn, footprint] =
    await Promise.all([
      getUserTimeline(id),
      userHasRazorpaySubscription(id),
      listAdminNotes("user", id),
      listSupportThreadsForUser(id, 8),
      getUserChurnSignals(id),
      getUserEntityCounts(id),
    ]);

  const isBanned =
    overview.banned_until !== null &&
    new Date(overview.banned_until).getTime() > Date.now();

  return (
    <div className="space-y-6">
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
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono text-[11px]">{shortenId(overview.id)}</span>
            <AccountTypeBadge accountType={overview.account_type} />
            {isBanned ? (
              <span className="ml-2 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-red-600">
                Suspended
              </span>
            ) : null}
          </span>
        }
      />

      <UserChurnBadges signals={churn} />

      {/* Top stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Account"
          value={
            overview.account_type === "portal_client"
              ? "Portal client"
              : "Freelancer"
          }
        />
        <Tile label="Plan" value={overview.plan ?? "free"} />
        <Tile
          label="Status"
          value={overview.subscription_status ?? "—"}
        />
        <Tile
          label="Lifetime revenue"
          value={formatPaiseInr(overview.total_revenue_paise)}
        />
        <Tile
          label="Invoices · Clients"
          value={`${overview.invoice_count} · ${overview.client_count}`}
        />
      </section>

      {/* Profile snapshot */}
      <Section title="Profile" icon={Shield}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
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
          <Field label="Country">{overview.country || "—"}</Field>
          <Field label="Company">{overview.company_name || "—"}</Field>
          <Field label="Suppressions">
            {overview.suppression_count > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {overview.suppression_count}
              </span>
            ) : (
              0
            )}
          </Field>
        </dl>
      </Section>

      {/* Subscription */}
      <Section title="Subscription" icon={CreditCard}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Field label="Plan">{overview.plan ?? "free"}</Field>
          <Field label="Status">{overview.subscription_status ?? "—"}</Field>
          <Field label="Current period end">
            {overview.current_period_end
              ? formatIstStamp(overview.current_period_end) + " IST"
              : "—"}
          </Field>
          <Field label="Lifetime revenue (paise)">
            <span className="font-mono">
              {overview.total_revenue_paise.toLocaleString("en-IN")}
            </span>
          </Field>
        </dl>
      </Section>

      {/* Product footprint (Admin A5) */}
      <Section title="Footprint" icon={Boxes}>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Clients">{footprint.clients}</Field>
          <Field label="Projects">{footprint.projects}</Field>
          <Field label="Invoices">{footprint.invoices}</Field>
          <Field label="Contracts">{footprint.contracts}</Field>
          <Field label="Welcome docs">{footprint.welcomeDocs}</Field>
          <Field label="Portals">{footprint.portals}</Field>
          <Field label="Time entries">{footprint.timeEntries}</Field>
          <Field label="Files">{footprint.files}</Field>
          <Field label="Support tickets">{footprint.tickets}</Field>
        </dl>
      </Section>

      {/* Timelines */}
      <Section title="Activity" icon={FileText} count={timeline.activity.length}>
        <Timeline
          items={timeline.activity.map((a) => ({
            id: a.id,
            primary: a.title ?? a.kind,
            secondary: a.kind,
            at: a.created_at,
          }))}
          emptyText="No activity yet."
        />
      </Section>

      <Section
        title="Security events"
        icon={Shield}
        count={timeline.security.length}
      >
        {timeline.security.length === 0 ? (
          <Empty text="No security events recorded for this user." />
        ) : (
          <ul className="overflow-hidden rounded-md border bg-card">
            {timeline.security.map((s) => (
              <li
                key={s.id}
                className="border-b border-border/40 p-3 text-xs last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        s.severity === "alert"
                          ? "bg-red-500"
                          : s.severity === "warn"
                            ? "bg-amber-500"
                            : "bg-muted-foreground/50",
                      )}
                    />
                    <span className="font-medium">{s.kind}</span>
                    <span className="text-muted-foreground">
                      {s.severity}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatIstStamp(s.created_at)}
                  </span>
                </div>
                {s.metadata && Object.keys(s.metadata as object).length > 0 ? (
                  <div className="mt-2">
                    <JsonViewer value={s.metadata} defaultExpandDepth={1} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Recent emails"
        icon={Mail}
        count={timeline.emails.length}
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
      </Section>

      <Section
        title="Recent payments"
        icon={CreditCard}
        count={timeline.payments.length}
      >
        {timeline.payments.length === 0 ? (
          <Empty text="No payments recorded." />
        ) : (
          <ul className="overflow-hidden rounded-md border bg-card text-xs">
            {timeline.payments.map((p) => (
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
      </Section>

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
    </div>
  );
}

// ---------------------------------------------------------------------------

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function AccountTypeBadge({
  accountType,
}: {
  accountType: "freelancer" | "portal_client";
}) {
  const isClient = accountType === "portal_client";
  return (
    <span
      className={cn(
        "ml-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
        isClient
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {isClient ? "Portal client" : "Freelancer"}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {typeof count === "number" ? (
          <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
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
    <div className="flex items-baseline justify-between gap-3 border-b border-border/30 py-1.5 text-xs sm:border-b-0">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {text}
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
  if (items.length === 0) return <Empty text={emptyText} />;
  return (
    <ul className="overflow-hidden rounded-md border bg-card text-xs">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
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
