/**
 * /admin/users — list view.
 *
 * Backed by the `admin_user_overview` Postgres view (single round trip
 * with denormalized counts). Phase-1 is read-only — no actions menu
 * yet. Detail page exists for inspection.
 *
 * Query params (URL → state, for shareable links):
 *   q       free-text search (email / full_name)
 *   plan    free | pro | business | all
 *   status  active | trialing | past_due | canceled | paused | expired | all
 *   page    1-indexed page number
 *
 * Mobile: collapses to a card list under 768px.
 */

import Link from "next/link";
import { listUsers, type ListUsersInput } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UsersBulk } from "@/components/admin/users-bulk";
import { adminBulkSuppressUsersAction } from "@/features/admin/actions";
import {
  formatIstStamp,
  formatPaiseInr,
  formatRelative,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const accountType = parseEnum(sp.account, [
    "freelancer",
    "portal_client",
    "all",
  ]) as ListUsersInput["accountType"] | undefined;
  const plan = parseEnum(sp.plan, ["free", "pro", "business", "all"]) as
    | ListUsersInput["plan"]
    | undefined;
  const status = parseEnum(sp.status, [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "paused",
    "expired",
    "all",
  ]) as ListUsersInput["status"] | undefined;
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listUsers({
    q,
    accountType,
    plan,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (accountType && accountType !== "all") exportParams.set("account", accountType);
  if (plan && plan !== "all") exportParams.set("plan", plan);
  if (status && status !== "all") exportParams.set("status", status);
  const exportUrl = `/api/admin/users/export${exportParams.toString() ? `?${exportParams}` : ""}`;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Users"
        subtitle={
          <span>
            {result.total.toLocaleString("en-IN")} accounts · page {page} /{" "}
            {totalPages}
          </span>
        }
        actions={
          <a
            href={exportUrl}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"
          >
            Export CSV
          </a>
        }
      />

      <Filters
        q={q}
        accountType={accountType}
        plan={plan}
        status={status}
      />

      {/* Mobile: card list */}
      <ul className="space-y-2 md:hidden">
        {result.rows.map((u) => (
          <li
            key={u.id}
            className="rounded-md border bg-card p-3 text-sm"
          >
            <Link
              href={`/admin/users/${u.id}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="font-medium">{u.full_name}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatRelative(u.signed_up_at)}
              </span>
            </Link>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {u.email}
            </div>
            <div className="mt-2">
              <AccountTypeBadge accountType={u.account_type} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground tabular-nums">
              <div>
                <div className="text-[10px] uppercase tracking-wider">plan</div>
                <div className="text-foreground">{u.plan ?? "free"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider">paid</div>
                <div className="text-foreground">
                  {formatPaiseInr(u.total_revenue_paise)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider">inv</div>
                <div className="text-foreground">{u.invoice_count}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <UsersBulk suppressAction={adminBulkSuppressUsersAction} exportUrl={exportUrl}>
      <div className="hidden overflow-hidden rounded-md border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium tabular-nums">Paid</th>
              <th className="px-3 py-2 font-medium tabular-nums">Inv</th>
              <th className="px-3 py-2 font-medium tabular-nums">Last seen</th>
              <th className="px-3 py-2 font-medium tabular-nums">Signed up</th>
              <th className="px-3 py-2 font-medium tabular-nums">Suppr.</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No users match these filters.
                </td>
              </tr>
            ) : (
              result.rows.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-border/40 hover:bg-accent/30"
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" name="ids" value={u.id} aria-label="Select user" />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="block leading-tight"
                    >
                      <div className="font-medium">{u.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {u.email}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <AccountTypeBadge accountType={u.account_type} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.plan ?? "free"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={u.subscription_status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatPaiseInr(u.total_revenue_paise)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {u.invoice_count}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatRelative(u.last_sign_in_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatIstStamp(u.signed_up_at)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {u.suppression_count > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {u.suppression_count}
                      </span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </UsersBulk>

      <Pagination
        page={page}
        totalPages={totalPages}
        q={q}
        accountType={accountType}
        plan={plan}
        status={status}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Filters({
  q,
  accountType,
  plan,
  status,
}: {
  q: string | undefined;
  accountType: string | undefined;
  plan: string | undefined;
  status: string | undefined;
}) {
  return (
    <form
      method="get"
      action="/admin/users"
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="text"
        name="q"
        defaultValue={q ?? ""}
        placeholder="Search email or name…"
        className="h-8 w-56 rounded border bg-background px-2 text-xs"
      />
      <select
        name="account"
        defaultValue={accountType ?? "all"}
        className="h-8 rounded border bg-background px-2 text-xs"
      >
        <option value="all">All accounts</option>
        <option value="freelancer">Freelancers</option>
        <option value="portal_client">Portal clients</option>
      </select>
      <select
        name="plan"
        defaultValue={plan ?? "all"}
        className="h-8 rounded border bg-background px-2 text-xs"
      >
        <option value="all">All plans</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="business">Business</option>
      </select>
      <select
        name="status"
        defaultValue={status ?? "all"}
        className="h-8 rounded border bg-background px-2 text-xs"
      >
        <option value="all">Any status</option>
        <option value="active">Active</option>
        <option value="trialing">Trialing</option>
        <option value="past_due">Past due</option>
        <option value="canceled">Canceled</option>
        <option value="paused">Paused</option>
        <option value="expired">Expired</option>
      </select>
      <button
        type="submit"
        className="h-8 rounded border bg-background px-3 text-xs hover:bg-accent"
      >
        Apply
      </button>
      <Link
        href="/admin/users"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Reset
      </Link>
    </form>
  );
}

function StatusBadge({
  status,
}: {
  status: string | null;
}) {
  if (!status)
    return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    status === "active" || status === "trialing"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "past_due"
        ? "bg-red-500/10 text-red-700 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
      )}
    >
      {status}
    </span>
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
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        isClient
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {isClient ? "Portal client" : "Freelancer"}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  q,
  accountType,
  plan,
  status,
}: {
  page: number;
  totalPages: number;
  q?: string;
  accountType?: string;
  plan?: string;
  status?: string;
}) {
  if (totalPages <= 1) return null;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (accountType) params.set("account", accountType);
  if (plan) params.set("plan", plan);
  if (status) params.set("status", status);

  function href(p: number): string {
    params.set("page", String(p));
    return `/admin/users?${params.toString()}`;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <nav className="flex items-center justify-between text-xs">
      <Link
        href={href(prev)}
        className={cn(
          "rounded border px-2 py-1",
          page === 1
            ? "pointer-events-none opacity-40"
            : "hover:bg-accent",
        )}
      >
        ← Prev
      </Link>
      <span className="text-muted-foreground tabular-nums">
        Page {page} / {totalPages}
      </span>
      <Link
        href={href(next)}
        className={cn(
          "rounded border px-2 py-1",
          page === totalPages
            ? "pointer-events-none opacity-40"
            : "hover:bg-accent",
        )}
      >
        Next →
      </Link>
    </nav>
  );
}

// ---------------------------------------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof v !== "string") return undefined;
  return (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}
