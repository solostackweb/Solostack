"use server";

/**
 * Founder Console — global search.
 *
 * One server action behind the Cmd+K palette. Resolves a query string
 * to a small UNION of results across users, subscriptions, and
 * security events.
 *
 *   - email / full_name substring → users
 *   - exact UUID                  → user / subscription / security_event
 *   - exact 32-char hex           → security_event by request_id
 *
 * Returns at most ~15 hits so the palette renders instantly.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "./server";
import { formatCurrencyAmount } from "./format";

export interface SearchHit {
  /** Stable id used for keying + routing. */
  id: string;
  /** Bucket used to group + style the result. */
  kind:
    | "user"
    | "subscription"
    | "security_event"
    | "request_id"
    | "invoice"
    | "contract";
  /** Primary line (bold). */
  label: string;
  /** Secondary line (subdued). */
  hint: string;
  /** Target URL when the admin presses Enter. */
  href: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REQUEST_ID_RE = /^[0-9a-f]{32}$/;

export async function adminGlobalSearch(query: string): Promise<SearchHit[]> {
  await requireAdmin();

  const q = query.trim();
  if (q.length < 2) return [];

  // Exact UUID lookup — try user_profiles + subscriptions in parallel.
  if (UUID_RE.test(q)) {
    return resolveByUuid(q);
  }
  // 32-char hex looks like a request_id from middleware.
  if (REQUEST_ID_RE.test(q)) {
    return [
      {
        id: q,
        kind: "request_id",
        label: q,
        hint: "Open security trace",
        href: `/admin/security?request_id=${q}`,
      },
    ];
  }

  // Substring: search users by email or full_name.
  return resolveBySubstring(q);
}

async function resolveByUuid(uuid: string): Promise<SearchHit[]> {
  const admin = getAdminSupabase();
  const [userRes, subRes] = await Promise.all([
    admin
      .from("admin_user_overview")
      .select("id, full_name, email")
      .eq("id", uuid)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("id, plan, status")
      .eq("id", uuid)
      .maybeSingle(),
  ]);

  const out: SearchHit[] = [];

  const user = userRes.data as
    | { id: string; full_name: string; email: string }
    | null;
  if (user) {
    out.push({
      id: user.id,
      kind: "user",
      label: user.full_name,
      hint: user.email,
      href: `/admin/users/${user.id}`,
    });
  }

  const sub = subRes.data as
    | { id: string; plan: string; status: string }
    | null;
  if (sub) {
    out.push({
      id: sub.id,
      kind: "subscription",
      label: `Subscription · ${sub.plan}`,
      hint: sub.status,
      href: `/admin/subscriptions/${sub.id}`,
    });
  }
  return out;
}

async function resolveBySubstring(q: string): Promise<SearchHit[]> {
  const admin = getAdminSupabase();
  const term = q.replace(/[%_]/g, "");
  const pattern = `%${term}%`;

  // Run users + invoices + contracts in parallel so the palette stays
  // snappy even on a cold cache. Each query is bounded.
  const [userRes, invRes, contractRes] = await Promise.all([
    admin
      .from("admin_user_overview")
      .select("id, full_name, email, plan")
      .or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
      .order("signed_up_at", { ascending: false })
      .limit(8),
    admin
      .from("invoices")
      .select("id, invoice_number, status, total_amount, currency")
      .ilike("invoice_number", pattern)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("contracts")
      .select("id, title, kind, status")
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const userRows =
    (userRes.data as Array<{
      id: string;
      full_name: string;
      email: string;
      plan: string | null;
    }> | null) ?? [];
  const invRows =
    (invRes.data as Array<{
      id: string;
      invoice_number: string;
      status: string;
      total_amount: number;
      currency: string;
    }> | null) ?? [];
  const contractRows =
    (contractRes.data as Array<{
      id: string;
      title: string;
      kind: string;
      status: string;
    }> | null) ?? [];

  const hits: SearchHit[] = [];

  for (const r of userRows) {
    hits.push({
      id: r.id,
      kind: "user",
      label: r.full_name,
      hint: `${r.email}${r.plan ? ` · ${r.plan}` : ""}`,
      href: `/admin/users/${r.id}`,
    });
  }
  for (const r of invRows) {
    hits.push({
      id: r.id,
      kind: "invoice",
      label: r.invoice_number,
      hint: `${r.status} · ${formatCurrencyAmount(r.total_amount, r.currency)}`,
      href: `/admin/invoices/${r.id}`,
    });
  }
  for (const r of contractRows) {
    hits.push({
      id: r.id,
      kind: "contract",
      label: r.title,
      hint: `${r.kind} · ${r.status}`,
      href: `/admin/contracts/${r.id}`,
    });
  }

  return hits.slice(0, 15);
}
