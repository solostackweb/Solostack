/**
 * Founder Console - read queries.
 *
 * Every function here:
 *   - Reads through the service-role client (RLS bypass).
 *   - Returns a plain typed value, never a Supabase response object.
 *   - Logs + degrades gracefully on failure (returns 0 / [] / null).
 *
 * Functions are intentionally small and orthogonal so the Now page
 * can call them all in parallel via `Promise.all`.
 */

import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import type {
  AdminActionRow,
  AdminUserOverviewRow,
  SecurityEventRow,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Time windows
// ---------------------------------------------------------------------------

function isoSince(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function sanitizeOrSearchTerm(value: string): string {
  return value.trim().replace(/[%_(),]/g, " ").replace(/\s+/g, " ");
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

// ---------------------------------------------------------------------------
// Revenue + subscriptions
// ---------------------------------------------------------------------------

export interface RevenueSnapshot {
  /** Sum of `billing_payments.amount` (paise) where status='captured' over the last 24h. */
  capturedTodayPaise: number;
  /** Same metric over last 7d. */
  capturedWeekPaise: number;
  /** Distinct active subscriptions count (status='active'|'trialing'). */
  activeSubscriptions: number;
  /** Subscriptions whose status flipped to past_due in the last 7d. */
  pastDueLast7d: number;
}

export async function getRevenueSnapshot(): Promise<RevenueSnapshot> {
  const admin = getAdminSupabase();
  const since24h = isoSince(ONE_DAY_MS);
  const since7d = isoSince(SEVEN_DAYS_MS);

  // Two range queries + two count queries in parallel.
  const [day, week, active, pastDue] = await Promise.all([
    admin
      .from("billing_payments")
      .select("amount")
      .eq("status", "captured")
      .gte("created_at", since24h),
    admin
      .from("billing_payments")
      .select("amount")
      .eq("status", "captured")
      .gte("created_at", since7d),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "past_due")
      .gte("updated_at", since7d),
  ]);

  if (day.error || week.error || active.error || pastDue.error) {
    log.warn("admin.queries.revenue_partial_failure", {
      day_err: day.error?.message,
      week_err: week.error?.message,
      active_err: active.error?.message,
      past_due_err: pastDue.error?.message,
    });
  }

  const sumAmount = (rows: { amount: number | null }[] | null): number =>
    (rows ?? []).reduce((acc, r) => acc + (r.amount ?? 0), 0);

  return {
    capturedTodayPaise: sumAmount(day.data),
    capturedWeekPaise: sumAmount(week.data),
    activeSubscriptions: active.count ?? 0,
    pastDueLast7d: pastDue.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Signups / pipeline
// ---------------------------------------------------------------------------

export interface PipelineSnapshot {
  signupsLast24h: number;
  signupsLast7d: number;
  unverifiedOlderThan7d: number;
  trialingEndingSoon: number; // current_period_end within next 3 days
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const admin = getAdminSupabase();
  const since24h = isoSince(ONE_DAY_MS);
  const since7d = isoSince(SEVEN_DAYS_MS);
  const stale = isoSince(SEVEN_DAYS_MS);
  const soon = new Date(Date.now() + 3 * ONE_DAY_MS).toISOString();

  const [day, week, unverified, trialing] = await Promise.all([
    admin
      .from("admin_user_overview")
      .select("id", { count: "exact", head: true })
      .gte("signed_up_at", since24h),
    admin
      .from("admin_user_overview")
      .select("id", { count: "exact", head: true })
      .gte("signed_up_at", since7d),
    admin
      .from("admin_user_overview")
      .select("id", { count: "exact", head: true })
      .lt("signed_up_at", stale)
      .is("email_confirmed_at", null),
    admin
      .from("admin_user_overview")
      .select("id", { count: "exact", head: true })
      .eq("subscription_status", "trialing")
      .lte("current_period_end", soon),
  ]);

  return {
    signupsLast24h: day.count ?? 0,
    signupsLast7d: week.count ?? 0,
    unverifiedOlderThan7d: unverified.count ?? 0,
    trialingEndingSoon: trialing.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Operational health
// ---------------------------------------------------------------------------

export interface CommsSnapshot {
  /** Count of delivery_logs with status='failed'|'bounced'|'blocked' in last 24h. */
  emailFailuresLast24h: number;
  /** Count of email_suppressions added in last 24h. */
  suppressionsAddedLast24h: number;
  /** Count of severity='alert' security_events in last 24h. */
  securityAlertsLast24h: number;
  /** Count of all security_events in last 24h. */
  securityEventsLast24h: number;
}

export async function getCommsSnapshot(): Promise<CommsSnapshot> {
  const admin = getAdminSupabase();
  const since = isoSince(ONE_DAY_MS);

  const [failures, suppressions, alerts, allEvents] = await Promise.all([
    admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "bounced", "blocked"])
      .gte("created_at", since),
    admin
      .from("email_suppressions")
      .select("email", { count: "exact", head: true })
      .gte("created_at", since),
    admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "alert")
      .gte("created_at", since),
    admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  return {
    emailFailuresLast24h: failures.count ?? 0,
    suppressionsAddedLast24h: suppressions.count ?? 0,
    securityAlertsLast24h: alerts.count ?? 0,
    securityEventsLast24h: allEvents.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// "What broke" - most recent alerts to triage
// ---------------------------------------------------------------------------

export async function getRecentAlerts(limit = 5): Promise<SecurityEventRow[]> {
  const admin = getAdminSupabase();
  const since = isoSince(ONE_DAY_MS);
  const { data, error } = await admin
    .from("security_events")
    .select("*")
    .eq("severity", "alert")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.warn("admin.queries.recent_alerts_failed", { error: error.message });
    return [];
  }
  return (data ?? []) as SecurityEventRow[];
}

// ---------------------------------------------------------------------------
// Recent admin activity - last N rows from admin_actions
// ---------------------------------------------------------------------------

export async function getRecentAdminActivity(
  limit = 10,
): Promise<AdminActionRow[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.warn("admin.queries.recent_activity_failed", { error: error.message });
    return [];
  }
  return (data ?? []) as AdminActionRow[];
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface ListUsersInput {
  q?: string; // matches email or full_name
  accountType?: "freelancer" | "portal_client" | "all";
  plan?: "free" | "pro" | "business" | "all";
  status?: "active" | "trialing" | "past_due" | "canceled" | "paused" | "expired" | "all";
  hasSuppression?: boolean;
  signedUpSince?: string; // ISO timestamp
  page?: number; // 1-indexed
  pageSize?: number;
}

export interface ListUsersResult {
  rows: AdminUserOverviewRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listUsers(
  input: ListUsersInput = {},
): Promise<ListUsersResult> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = admin
    .from("admin_user_overview")
    .select("*", { count: "estimated" })
    .order("signed_up_at", { ascending: false });

  if (input.q && input.q.trim().length > 0) {
    const term = sanitizeOrSearchTerm(input.q);
    q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  if (input.accountType && input.accountType !== "all") {
    q = q.eq("account_type", input.accountType);
  }
  if (input.plan && input.plan !== "all") {
    q = q.eq("plan", input.plan);
  }
  if (input.status && input.status !== "all") {
    q = q.eq("subscription_status", input.status);
  }
  if (input.hasSuppression) {
    q = q.gt("suppression_count", 0);
  }
  if (input.signedUpSince) {
    q = q.gte("signed_up_at", input.signedUpSince);
  }

  const { data, count, error } = await q.range(from, to);
  if (error) {
    log.warn("admin.queries.list_users_failed", { error: error.message });
    return { rows: [], total: 0, page, pageSize };
  }
  return {
    rows: (data ?? []) as AdminUserOverviewRow[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Returns true when the user has a subscription row with a non-null
 * `razorpay_subscription_id`. Used by the admin user-detail page to
 * disable the "Comp plan" action so it can't accidentally clobber a
 * paying customer's real billing record.
 */
export async function userHasRazorpaySubscription(
  userId: string,
): Promise<boolean> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("subscriptions")
    .select("razorpay_subscription_id")
    .eq("user_id", userId)
    .not("razorpay_subscription_id", "is", null)
    .limit(1);
  const rows =
    (result.data as Array<{ razorpay_subscription_id: string | null }> | null) ??
    [];
  return rows.length > 0;
}

export async function getUserOverview(
  userId: string,
): Promise<AdminUserOverviewRow | null> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("admin_user_overview")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    log.warn("admin.queries.user_overview_failed", {
      user_id: userId,
      error: error.message,
    });
    return null;
  }
  return (data as AdminUserOverviewRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface ListSubscriptionsInput {
  status?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "paused"
    | "expired"
    | "all";
  plan?: "free" | "pro" | "business" | "all";
  page?: number;
  pageSize?: number;
}

export interface SubscriptionListRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  billing_cycle: string;
  current_period_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  razorpay_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  email: string;
  full_name: string;
}

export interface ListSubscriptionsResult {
  rows: SubscriptionListRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
  };
}

export async function listSubscriptions(
  input: ListSubscriptionsInput = {},
): Promise<ListSubscriptionsResult> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Counts per status - drive the tab UI.
  const statusKeys = ["active", "trialing", "past_due", "canceled"] as const;
  const countResults = await Promise.all(
    statusKeys.map((s) =>
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("status", s),
    ),
  );
  const counts = {
    active: countResults[0].count ?? 0,
    trialing: countResults[1].count ?? 0,
    past_due: countResults[2].count ?? 0,
    canceled: countResults[3].count ?? 0,
  };

  let q = admin
    .from("subscriptions")
    .select(
      "id, user_id, plan, status, billing_cycle, current_period_end, canceled_at, cancel_at_period_end, razorpay_subscription_id, created_at, updated_at",
      { count: "estimated" },
    )
    .order("updated_at", { ascending: false });

  if (input.status && input.status !== "all") {
    q = q.eq("status", input.status);
  }
  if (input.plan && input.plan !== "all") {
    q = q.eq("plan", input.plan);
  }

  const result = await q.range(from, to);
  if (result.error) {
    log.warn("admin.queries.list_subs_failed", { error: result.error.message });
    return { rows: [], total: 0, page, pageSize, counts };
  }

  type SubRaw = Omit<SubscriptionListRow, "email" | "full_name">;
  const subRows = (result.data as SubRaw[] | null) ?? [];

  // Hydrate user_profiles (email + full_name) for the page slice only.
  const userIds = Array.from(new Set(subRows.map((r) => r.user_id)));
  const profileMap = await fetchProfileMap(userIds);

  const rows: SubscriptionListRow[] = subRows.map((r) => ({
    ...r,
    email: profileMap.get(r.user_id)?.email ?? "-",
    full_name: profileMap.get(r.user_id)?.full_name ?? "-",
  }));

  return { rows, total: result.count ?? 0, page, pageSize, counts };
}

async function fetchProfileMap(
  userIds: string[],
): Promise<Map<string, { email: string; full_name: string }>> {
  if (userIds.length === 0) return new Map();
  const admin = getAdminSupabase();
  const result = await admin
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const rows =
    (result.data as Array<{
      id: string;
      email: string;
      full_name: string;
    }> | null) ?? [];
  const map = new Map<string, { email: string; full_name: string }>();
  for (const r of rows) {
    map.set(r.id, { email: r.email, full_name: r.full_name });
  }
  return map;
}

export async function getSubscriptionDetail(subscriptionId: string): Promise<{
  subscription: SubscriptionListRow | null;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string | null;
    razorpay_payment_id: string;
    created_at: string;
  }>;
  events: Array<{
    id: string;
    event_id: string;
    event_type: string;
    processed_at: string | null;
    error: string | null;
    created_at: string;
  }>;
}> {
  const admin = getAdminSupabase();
  const detailResult = await admin
    .from("subscriptions")
    .select(
      "id, user_id, plan, status, billing_cycle, current_period_end, canceled_at, cancel_at_period_end, razorpay_subscription_id, created_at, updated_at",
    )
    .eq("id", subscriptionId)
    .maybeSingle();

  type RawSub = Omit<SubscriptionListRow, "email" | "full_name">;
  const raw = detailResult.data as RawSub | null;
  if (!raw) return { subscription: null, payments: [], events: [] };

  // Profile lookup, payments, and billing events all key off user_id, so fan
  // them out together instead of blocking the payment/event reads on the
  // profile round-trip first.
  const [profileMap, payRes, evtRes] = await Promise.all([
    fetchProfileMap([raw.user_id]),
    admin
      .from("billing_payments")
      .select(
        "id, amount, currency, status, method, razorpay_payment_id, created_at",
      )
      .eq("user_id", raw.user_id)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("billing_events")
      .select("id, event_id, event_type, processed_at, error, created_at")
      .eq("user_id", raw.user_id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const subscription: SubscriptionListRow = {
    ...raw,
    email: profileMap.get(raw.user_id)?.email ?? "-",
    full_name: profileMap.get(raw.user_id)?.full_name ?? "-",
  };

  return {
    subscription,
    payments:
      (payRes.data as Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        method: string | null;
        razorpay_payment_id: string;
        created_at: string;
      }> | null) ?? [],
    events:
      (evtRes.data as Array<{
        id: string;
        event_id: string;
        event_type: string;
        processed_at: string | null;
        error: string | null;
        created_at: string;
      }> | null) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Emails (delivery_logs + suppressions)
// ---------------------------------------------------------------------------

export interface DeliveryLogRowLite {
  id: string;
  user_id: string;
  kind: string;
  channel: string;
  entity_type: string;
  entity_id: string | null;
  to_email: string | null;
  subject: string | null;
  status: string;
  provider: string;
  provider_message_id: string | null;
  error: string | null;
  created_at: string;
}

export interface ListEmailsInput {
  status?:
    | "queued"
    | "sent"
    | "delivered"
    | "failed"
    | "bounced"
    | "blocked"
    | "opened"
    | "clicked"
    | "all";
  q?: string; // searches `to_email`
  page?: number;
  pageSize?: number;
}

export interface ListEmailsResult {
  rows: DeliveryLogRowLite[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    delivered: number;
    failed: number;
    bounced: number;
    blocked: number;
  };
}

export async function listEmails(
  input: ListEmailsInput = {},
): Promise<ListEmailsResult> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const since24h = isoSince(ONE_DAY_MS);

  // Last-24h tab counts.
  const counts = await Promise.all([
    admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered")
      .gte("created_at", since24h),
    admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since24h),
    admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "bounced")
      .gte("created_at", since24h),
    admin
      .from("delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "blocked")
      .gte("created_at", since24h),
  ]);

  let q = admin
    .from("delivery_logs")
    .select(
      "id, user_id, kind, channel, entity_type, entity_id, to_email, subject, status, provider, provider_message_id, error, created_at",
      { count: "estimated" },
    )
    .order("created_at", { ascending: false });

  if (input.status && input.status !== "all") {
    q = q.eq("status", input.status);
  }
  if (input.q && input.q.trim()) {
    const term = input.q.trim().replace(/[%_]/g, "");
    q = q.ilike("to_email", `%${term}%`);
  }

  const result = await q.range(from, to);
  if (result.error) {
    log.warn("admin.queries.list_emails_failed", {
      error: result.error.message,
    });
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      counts: {
        delivered: counts[0].count ?? 0,
        failed: counts[1].count ?? 0,
        bounced: counts[2].count ?? 0,
        blocked: counts[3].count ?? 0,
      },
    };
  }

  return {
    rows: (result.data as DeliveryLogRowLite[] | null) ?? [],
    total: result.count ?? 0,
    page,
    pageSize,
    counts: {
      delivered: counts[0].count ?? 0,
      failed: counts[1].count ?? 0,
      bounced: counts[2].count ?? 0,
      blocked: counts[3].count ?? 0,
    },
  };
}

export interface SuppressionLite {
  email: string;
  reason: string;
  provider: string;
  provider_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listSuppressions(
  q?: string,
  limit = 100,
): Promise<SuppressionLite[]> {
  const admin = getAdminSupabase();
  let qb = admin
    .from("email_suppressions")
    .select(
      "email, reason, provider, provider_message_id, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (q && q.trim()) {
    qb = qb.ilike("email", `%${q.trim().replace(/[%_]/g, "")}%`);
  }
  const result = await qb;
  return (result.data as SuppressionLite[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Invoices / contracts / files (read-mostly inspection)
// ---------------------------------------------------------------------------

export interface AdminInvoiceLite {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  currency: string;
  payment_status: string | null;
  created_at: string;
  email: string;
  full_name: string;
}

export async function listInvoices(input: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: AdminInvoiceLite[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = admin
    .from("invoices")
    .select(
      "id, user_id, invoice_number, status, issue_date, due_date, total_amount, currency, payment_status, created_at",
      { count: "estimated" },
    )
    .order("created_at", { ascending: false });

  if (input.q && input.q.trim()) {
    const term = input.q.trim().replace(/[%_]/g, "");
    q = q.ilike("invoice_number", `%${term}%`);
  }
  if (input.status && input.status !== "all") {
    q = q.eq("status", input.status);
  }

  const result = await q.range(from, to);
  type Lite = Omit<AdminInvoiceLite, "email" | "full_name">;
  const baseRows = (result.data as Lite[] | null) ?? [];
  const profileMap = await fetchProfileMap(
    Array.from(new Set(baseRows.map((r) => r.user_id))),
  );
  return {
    rows: baseRows.map((r) => ({
      ...r,
      email: profileMap.get(r.user_id)?.email ?? "-",
      full_name: profileMap.get(r.user_id)?.full_name ?? "-",
    })),
    total: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function getInvoiceDetail(invoiceId: string): Promise<{
  invoice: AdminInvoiceLite | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    gst_rate: number;
  }>;
  deliveries: Array<{
    id: string;
    kind: string;
    status: string;
    to_email: string | null;
    created_at: string;
  }>;
}> {
  const admin = getAdminSupabase();
  const invRes = await admin
    .from("invoices")
    .select(
      "id, user_id, invoice_number, status, issue_date, due_date, total_amount, currency, payment_status, created_at",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  type Lite = Omit<AdminInvoiceLite, "email" | "full_name">;
  const raw = invRes.data as Lite | null;
  if (!raw) return { invoice: null, items: [], deliveries: [] };

  const profileMap = await fetchProfileMap([raw.user_id]);
  const invoice: AdminInvoiceLite = {
    ...raw,
    email: profileMap.get(raw.user_id)?.email ?? "-",
    full_name: profileMap.get(raw.user_id)?.full_name ?? "-",
  };

  const [itemsRes, delRes] = await Promise.all([
    admin
      .from("invoice_items")
      .select("id, description, quantity, unit_price, amount, gst_rate")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true }),
    admin
      .from("delivery_logs")
      .select("id, kind, status, to_email, created_at")
      .eq("entity_type", "invoice")
      .eq("entity_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    invoice,
    items:
      (itemsRes.data as Array<{
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        amount: number;
        gst_rate: number;
      }> | null) ?? [],
    deliveries:
      (delRes.data as Array<{
        id: string;
        kind: string;
        status: string;
        to_email: string | null;
        created_at: string;
      }> | null) ?? [],
  };
}

export interface AdminContractLite {
  id: string;
  user_id: string;
  title: string;
  kind: string;
  status: string;
  public_token: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  email: string;
  full_name: string;
}

export async function listContracts(input: {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: AdminContractLite[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = admin
    .from("contracts")
    .select(
      "id, user_id, title, kind, status, public_token, signed_at, created_at, updated_at",
      { count: "estimated" },
    )
    .order("updated_at", { ascending: false });

  if (input.q && input.q.trim()) {
    const term = input.q.trim().replace(/[%_]/g, "");
    q = q.ilike("title", `%${term}%`);
  }
  if (input.status && input.status !== "all") {
    q = q.eq("status", input.status);
  }

  const result = await q.range(from, to);
  type Lite = Omit<AdminContractLite, "email" | "full_name">;
  const baseRows = (result.data as Lite[] | null) ?? [];
  const profileMap = await fetchProfileMap(
    Array.from(new Set(baseRows.map((r) => r.user_id))),
  );
  return {
    rows: baseRows.map((r) => ({
      ...r,
      email: profileMap.get(r.user_id)?.email ?? "-",
      full_name: profileMap.get(r.user_id)?.full_name ?? "-",
    })),
    total: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function getContractDetail(contractId: string): Promise<{
  contract: AdminContractLite | null;
  signatures: Array<{
    id: string;
    user_id: string;
    signed_at: string | null;
    signer_name: string | null;
    created_at: string;
  }>;
  deliveries: Array<{
    id: string;
    kind: string;
    status: string;
    to_email: string | null;
    created_at: string;
  }>;
}> {
  const admin = getAdminSupabase();
  const res = await admin
    .from("contracts")
    .select(
      "id, user_id, title, kind, status, public_token, signed_at, created_at, updated_at",
    )
    .eq("id", contractId)
    .maybeSingle();
  type Lite = Omit<AdminContractLite, "email" | "full_name">;
  const raw = res.data as Lite | null;
  if (!raw) return { contract: null, signatures: [], deliveries: [] };

  const profileMap = await fetchProfileMap([raw.user_id]);
  const contract: AdminContractLite = {
    ...raw,
    email: profileMap.get(raw.user_id)?.email ?? "-",
    full_name: profileMap.get(raw.user_id)?.full_name ?? "-",
  };

  const [sigRes, delRes] = await Promise.all([
    admin
      .from("contract_signatures")
      .select("id, user_id, signed_at, signer_name, created_at")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("delivery_logs")
      .select("id, kind, status, to_email, created_at")
      .eq("entity_type", "contract")
      .eq("entity_id", contractId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    contract,
    signatures:
      (sigRes.data as Array<{
        id: string;
        user_id: string;
        signed_at: string | null;
        signer_name: string | null;
        created_at: string;
      }> | null) ?? [],
    deliveries:
      (delRes.data as Array<{
        id: string;
        kind: string;
        status: string;
        to_email: string | null;
        created_at: string;
      }> | null) ?? [],
  };
}

export interface AdminFileLite {
  id: string;
  user_id: string;
  project_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
  email: string;
  full_name: string;
}

export async function listFiles(input: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  rows: AdminFileLite[];
  total: number;
  page: number;
  pageSize: number;
  totalBytes: number;
}> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = admin
    .from("files")
    .select(
      "id, user_id, project_id, file_name, storage_path, file_size, mime_type, created_at",
      { count: "estimated" },
    )
    .order("created_at", { ascending: false });

  if (input.q && input.q.trim()) {
    const term = input.q.trim().replace(/[%_]/g, "");
    q = q.ilike("file_name", `%${term}%`);
  }

  const result = await q.range(from, to);
  type Lite = Omit<AdminFileLite, "email" | "full_name">;
  const baseRows = (result.data as Lite[] | null) ?? [];
  const profileMap = await fetchProfileMap(
    Array.from(new Set(baseRows.map((r) => r.user_id))),
  );

  // Total storage cost - DB-side aggregate (no row fetch); see migration 0048.
  const totalRes = await admin.rpc("admin_files_total_bytes");
  const totalBytes = Number((totalRes.data as number | null) ?? 0);

  return {
    rows: baseRows.map((r) => ({
      ...r,
      email: profileMap.get(r.user_id)?.email ?? "-",
      full_name: profileMap.get(r.user_id)?.full_name ?? "-",
    })),
    total: result.count ?? 0,
    page,
    pageSize,
    totalBytes,
  };
}

// ---------------------------------------------------------------------------
// Platform settings (KV store)
// ---------------------------------------------------------------------------

export async function getPlatformSetting<T = unknown>(
  key: string,
): Promise<T | null> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const row = result.data as { value: T } | null;
  return row?.value ?? null;
}

export async function listPlatformSettings(): Promise<
  Array<{ key: string; value: unknown; updated_at: string }>
> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("platform_settings")
    .select("key, value, updated_at")
    .order("key", { ascending: true });
  return (
    (result.data as Array<{
      key: string;
      value: unknown;
      updated_at: string;
    }> | null) ?? []
  );
}

// ---------------------------------------------------------------------------
// Admin notes (Phase 3)
// ---------------------------------------------------------------------------

export interface AdminNoteLite {
  id: string;
  actor_id: string | null;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export async function listAdminNotes(
  targetType: string,
  targetId: string,
): Promise<AdminNoteLite[]> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("admin_notes")
    .select("id, actor_id, body, pinned, created_at, updated_at")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  return (result.data as AdminNoteLite[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Security events
// ---------------------------------------------------------------------------

export interface ListSecurityEventsInput {
  severity?: "info" | "warn" | "alert" | "all";
  kind?: string | "all";
  requestId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListSecurityEventsResult {
  rows: SecurityEventRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { info: number; warn: number; alert: number };
}

export async function listSecurityEvents(
  input: ListSecurityEventsInput = {},
): Promise<ListSecurityEventsResult> {
  const admin = getAdminSupabase();
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 200);
  const page = Math.max(input.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const since7d = isoSince(SEVEN_DAYS_MS);

  const counts = await Promise.all([
    admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "info")
      .gte("created_at", since7d),
    admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "warn")
      .gte("created_at", since7d),
    admin
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("severity", "alert")
      .gte("created_at", since7d),
  ]);

  let q = admin
    .from("security_events")
    .select("*", { count: "estimated" })
    .order("created_at", { ascending: false });

  if (input.severity && input.severity !== "all") {
    q = q.eq("severity", input.severity);
  }
  if (input.kind && input.kind !== "all") {
    q = q.eq("kind", input.kind);
  }
  if (input.requestId && input.requestId.trim()) {
    q = q.eq("request_id", input.requestId.trim());
  }
  if (input.userId && input.userId.trim()) {
    q = q.eq("user_id", input.userId.trim());
  }

  const result = await q.range(from, to);
  if (result.error) {
    log.warn("admin.queries.list_security_events_failed", {
      error: result.error.message,
    });
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      counts: {
        info: counts[0].count ?? 0,
        warn: counts[1].count ?? 0,
        alert: counts[2].count ?? 0,
      },
    };
  }
  return {
    rows: (result.data as SecurityEventRow[] | null) ?? [],
    total: result.count ?? 0,
    page,
    pageSize,
    counts: {
      info: counts[0].count ?? 0,
      warn: counts[1].count ?? 0,
      alert: counts[2].count ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Returns the user's most recent activity_events, security_events,
 * delivery_logs, and billing_payments in a single fan-out.
 */
export async function getUserTimeline(userId: string): Promise<{
  activity: Array<{
    id: string;
    kind: string;
    title: string | null;
    created_at: string;
  }>;
  security: SecurityEventRow[];
  emails: Array<{
    id: string;
    kind: string;
    status: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }>;
}> {
  const admin = getAdminSupabase();
  const [activity, security, emails, payments] = await Promise.all([
    admin
      .from("activity_events")
      .select("id, kind, title, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("security_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("delivery_logs")
      .select("id, kind, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("billing_payments")
      .select("id, amount, currency, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return {
    activity:
      (activity.data as Array<{
        id: string;
        kind: string;
        title: string | null;
        created_at: string;
      }> | null) ?? [],
    security: (security.data as SecurityEventRow[] | null) ?? [],
    emails:
      (emails.data as Array<{
        id: string;
        kind: string;
        status: string;
        created_at: string;
      }> | null) ?? [],
    payments:
      (payments.data as Array<{
        id: string;
        amount: number;
        currency: string;
        status: string;
        created_at: string;
      }> | null) ?? [],
  };
}
// ---------------------------------------------------------------------------
// Per-user product footprint (Admin hardening A5) - counts across every
// product system so the user-detail page reflects the whole product.
// ---------------------------------------------------------------------------

export interface UserEntityCounts {
  invoices: number;
  contracts: number;
  projects: number;
  clients: number;
  files: number;
  timeEntries: number;
  welcomeDocs: number;
  portals: number;
  tickets: number;
}

export async function getUserEntityCounts(userId: string): Promise<UserEntityCounts> {
  const admin = getAdminSupabase();
  const count = (table: string, col = "user_id") =>
    admin.from(table).select("id", { count: "exact", head: true }).eq(col, userId);

  const [inv, con, proj, cli, fil, te, wd, por, tk] = await Promise.all([
    count("invoices"),
    count("contracts"),
    count("projects"),
    count("clients"),
    count("files"),
    count("time_entries"),
    count("welcome_documents"),
    count("portals", "owner_user_id"),
    count("support_tickets"),
  ]);

  return {
    invoices: inv.count ?? 0,
    contracts: con.count ?? 0,
    projects: proj.count ?? 0,
    clients: cli.count ?? 0,
    files: fil.count ?? 0,
    timeEntries: te.count ?? 0,
    welcomeDocs: wd.count ?? 0,
    portals: por.count ?? 0,
    tickets: tk.count ?? 0,
  };
}
