import "server-only";

/**
 * Minimal Razorpay REST client.
 *
 * We use the HTTP API directly instead of the `razorpay` Node SDK to:
 *   - Keep the dependency footprint small.
 *   - Stay edge-runtime compatible (no Node-only crypto deps at import).
 *   - Let TypeScript describe only the fields we actually consume.
 *
 * All endpoints used here are documented at:
 *   https://razorpay.com/docs/api/payments/server-integration/
 */

import { requireServerEnv } from "@/config/env";

const BASE_URL = "https://api.razorpay.com/v1";

// --- Razorpay payload shapes (subset) --------------------------------------

export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired"
  | "paused";

export interface RazorpaySubscription {
  id: string;
  entity: "subscription";
  plan_id: string;
  customer_id?: string;
  status: RazorpaySubscriptionStatus;
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  charge_at: number | null;
  start_at: number | null;
  end_at: number | null;
  total_count: number;
  paid_count: number;
  remaining_count: number;
  short_url: string | null;
  notes: Record<string, string> | null;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  invoice_id: string | null;
  international: boolean;
  method: string;
  description: string | null;
  card_id?: string;
  card?: { last4?: string; network?: string } | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string> | null;
  fee?: number | null;
  tax?: number | null;
  error_code: string | null;
  error_description: string | null;
  created_at: number;
}

export interface RazorpayInvoice {
  id: string;
  entity: "invoice";
  short_url: string | null;
  status: string;
  amount: number;
  amount_paid: number;
  currency: string;
  customer_id?: string | null;
  subscription_id?: string | null;
  payment_id?: string | null;
  receipt?: string | null;
  date?: number;
  created_at: number;
}

export interface RazorpayCustomer {
  id: string;
  entity: "customer";
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  notes?: Record<string, string> | null;
  created_at: number;
}

export interface RazorpayPlan {
  id: string;
  entity: "plan";
  interval: number;
  period: "daily" | "weekly" | "monthly" | "yearly";
  item: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description: string | null;
  };
  notes?: Record<string, string> | null;
  created_at: number;
}

// --- Internal HTTP helper --------------------------------------------------

async function rzpFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const env = requireServerEnv();
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    throw new Error(
      "[billing] Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  const auth = Buffer.from(
    `${env.razorpayKeyId}:${env.razorpayKeySecret}`,
  ).toString("base64");

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };
  let body: BodyInit | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* fall through */
  }

  if (!res.ok) {
    const description =
      json &&
      typeof json === "object" &&
      "error" in json &&
      (json as { error?: { description?: string } }).error?.description;
    const message =
      typeof description === "string" && description.length > 0
        ? description
        : `Razorpay ${res.status} on ${path}`;
    throw new RazorpayApiError(message, res.status, json);
  }
  return json as T;
}

export class RazorpayApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "RazorpayApiError";
    this.status = status;
    this.body = body;
  }
}

// --- High-level API methods ------------------------------------------------

export async function createCustomer(input: {
  name: string;
  email: string;
  contact?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayCustomer> {
  return rzpFetch<RazorpayCustomer>("/customers", {
    method: "POST",
    body: {
      name: input.name,
      email: input.email,
      contact: input.contact,
      notes: input.notes,
      // Razorpay treats duplicate customers (same contact/email) as an error
      // unless we set fail_existing=0, in which case it returns the existing one.
      fail_existing: 0,
    },
  });
}

export async function fetchCustomer(id: string): Promise<RazorpayCustomer> {
  return rzpFetch<RazorpayCustomer>(`/customers/${id}`);
}

export async function createPlan(input: {
  name: string;
  amountPaise: number;
  currency?: string;
  period: "monthly" | "yearly";
  interval?: number;
  description?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayPlan> {
  return rzpFetch<RazorpayPlan>("/plans", {
    method: "POST",
    body: {
      period: input.period,
      interval: input.interval ?? 1,
      item: {
        name: input.name,
        amount: input.amountPaise,
        currency: input.currency ?? "INR",
        description: input.description,
      },
      notes: input.notes,
    },
  });
}

export async function fetchPlan(id: string): Promise<RazorpayPlan> {
  return rzpFetch<RazorpayPlan>(`/plans/${id}`);
}

export async function createSubscription(input: {
  planId: string;
  customerId?: string;
  totalCount?: number;
  customerNotify?: 0 | 1;
  notes?: Record<string, string>;
}): Promise<RazorpaySubscription> {
  return rzpFetch<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      // 12 months default for monthly plans, 5 years for yearly. The user
      // can cancel any time before that. Use a high cap to behave like an
      // open-ended subscription.
      total_count: input.totalCount ?? 120,
      customer_notify: input.customerNotify ?? 1,
      customer_id: input.customerId,
      notes: input.notes,
    },
  });
}

export async function fetchSubscription(
  id: string,
): Promise<RazorpaySubscription> {
  return rzpFetch<RazorpaySubscription>(`/subscriptions/${id}`);
}

export async function cancelSubscription(
  id: string,
  cancelAtCycleEnd: boolean,
): Promise<RazorpaySubscription> {
  return rzpFetch<RazorpaySubscription>(`/subscriptions/${id}/cancel`, {
    method: "POST",
    body: { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 },
  });
}

export async function fetchPayment(id: string): Promise<RazorpayPayment> {
  return rzpFetch<RazorpayPayment>(`/payments/${id}`);
}

export async function fetchInvoice(id: string): Promise<RazorpayInvoice> {
  return rzpFetch<RazorpayInvoice>(`/invoices/${id}`);
}

// --- Route / Payouts: Contacts & Fund Accounts -----------------------------

export interface RazorpayContact {
  id: string;
  entity: "contact";
  name: string;
  type: string;
  reference_id: string | null;
  notes: Record<string, string> | null;
  active: boolean;
  created_at: number;
}

export interface RazorpayFundAccount {
  id: string;
  entity: "fund_account";
  contact_id: string;
  account_type: "bank_account" | "vpa";
  bank_account?: {
    ifsc: string;
    bank_name: string;
    name: string;
    notes: Record<string, string>;
    account_number: string;
  };
  active: boolean;
  created_at: number;
}

export async function createContact(input: {
  name: string;
  referenceId: string;
  type?: string;
  notes?: Record<string, string>;
}): Promise<RazorpayContact> {
  return rzpFetch<RazorpayContact>("/contacts", {
    method: "POST",
    body: {
      name: input.name,
      type: input.type ?? "vendor",
      reference_id: input.referenceId,
      notes: input.notes,
    },
  });
}

export async function createFundAccount(input: {
  contactId: string;
  accountHolderName: string;
  ifsc: string;
  accountNumber: string;
}): Promise<RazorpayFundAccount> {
  return rzpFetch<RazorpayFundAccount>("/fund_accounts", {
    method: "POST",
    body: {
      contact_id: input.contactId,
      account_type: "bank_account",
      bank_account: {
        name: input.accountHolderName,
        ifsc: input.ifsc,
        account_number: input.accountNumber,
      },
    },
  });
}

// --- Smart Collect: Virtual Accounts ---------------------------------------

export interface RazorpayVirtualAccount {
  id: string;
  entity: "virtual_account";
  name: string;
  description: string | null;
  amount_expected: number | null;
  amount_paid: number;
  status: "active" | "paid" | "closed";
  receivers: Array<{
    id: string;
    entity: "vpa";
    username: string;
    handle: string;
    address: string; // the full VPA e.g. "rzpayments.inv001@icici"
  }>;
  close_by: number | null;
  closed_at: number | null;
  receipt: string | null;
  created_at: number;
}

export async function createVirtualAccount(input: {
  /** Display name shown on bank statements. */
  name: string;
  description: string;
  /** Amount in paise (exact amount expected). */
  amountPaise: number;
  /** Unix timestamp: when to auto-close this account. */
  closeByUnix: number;
  /** Your internal reference (receipt) — use invoice id. */
  receipt: string;
}): Promise<RazorpayVirtualAccount> {
  return rzpFetch<RazorpayVirtualAccount>("/virtual_accounts", {
    method: "POST",
    body: {
      receivers: { types: ["vpa"] },
      description: input.description,
      amount: input.amountPaise,
      currency: "INR",
      close_by: input.closeByUnix,
      receipt: input.receipt,
    },
  });
}

export async function closeVirtualAccount(
  id: string,
): Promise<RazorpayVirtualAccount> {
  return rzpFetch<RazorpayVirtualAccount>(`/virtual_accounts/${id}`, {
    method: "PATCH",
    body: { status: "closed" },
  });
}

// --- IFSC lookup (public Razorpay IFSC API) --------------------------------

export interface IfscDetails {
  IFSC: string;
  BANK: string;
  BRANCH: string;
  ADDRESS: string;
}

/** Looks up IFSC details from Razorpay's public IFSC API. Returns null on
 *  invalid/unknown IFSC so callers can fall back gracefully. */
export async function lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${ifsc.toUpperCase()}`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return (await res.json()) as IfscDetails;
  } catch {
    return null;
  }
}
