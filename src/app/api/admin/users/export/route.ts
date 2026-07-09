/**
 * GET/POST /api/admin/users/export — streaming users CSV (Admin hardening A4).
 *
 *   GET  ?q=&plan=&status=&account=  → export all users matching the filters.
 *   POST  form field `ids` (repeated) → export just the selected users.
 *
 * Streams rows in batches so an export of thousands never builds the whole
 * file in memory. Admin-gated + audited.
 */

import { requireAdmin, recordAdminAction } from "@/features/admin/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "full_name",
  "email",
  "account_type",
  "plan",
  "subscription_status",
  "total_revenue_paise",
  "invoice_count",
  "signed_up_at",
] as const;

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\n";
}

function asString(v: string | null): string | undefined {
  return v && v.trim() ? v.trim() : undefined;
}

function sanitizeOrSearchTerm(value: string): string {
  return value.trim().replace(/[%_(),]/g, " ").replace(/\s+/g, " ");
}

export async function GET(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const filters = {
    q: asString(url.searchParams.get("q")),
    plan: asString(url.searchParams.get("plan")),
    status: asString(url.searchParams.get("status")),
    account: asString(url.searchParams.get("account")),
  };
  return streamCsv({ filters, ids: null, actorId: admin.id });
}

export async function POST(req: Request): Promise<Response> {
  const admin = await requireAdmin();
  const form = await req.formData();
  const ids = form.getAll("ids").map(String).filter(Boolean);
  return streamCsv({ filters: null, ids: ids.length ? ids : null, actorId: admin.id });
}

interface StreamArgs {
  filters: { q?: string; plan?: string; status?: string; account?: string } | null;
  ids: string[] | null;
  actorId: string;
}

async function streamCsv({ filters, ids, actorId }: StreamArgs): Promise<Response> {
  const supabase = getAdminSupabase();
  const BATCH = 1000;

  // Audit (best-effort) — record that an export happened + its scope.
  const encoder = new TextEncoder();
  const startedAt = performance.now();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(csvRow([...COLUMNS])));
      try {
        if (ids) {
          // Selected: chunk the id list to keep each query bounded.
          for (let i = 0; i < ids.length; i += BATCH) {
            const chunk = ids.slice(i, i + BATCH);
            const { data, error } = await supabase
              .from("admin_user_overview")
              .select(COLUMNS.join(","))
              .in("id", chunk);
            if (error) throw error;
            for (const r of (data as Record<string, unknown>[] | null) ?? []) {
              controller.enqueue(encoder.encode(csvRow(COLUMNS.map((c) => r[c]))));
            }
          }
        } else {
          // Filtered: page through with .range() until exhausted.
          for (let from = 0; ; from += BATCH) {
            let q = supabase
              .from("admin_user_overview")
              .select(COLUMNS.join(","))
              .order("signed_up_at", { ascending: false })
              .range(from, from + BATCH - 1);
            const f = filters ?? {};
            if (f.q) {
              const term = sanitizeOrSearchTerm(f.q);
              q = q.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
            }
            if (f.account && f.account !== "all") q = q.eq("account_type", f.account);
            if (f.plan && f.plan !== "all") q = q.eq("plan", f.plan);
            if (f.status && f.status !== "all") q = q.eq("subscription_status", f.status);
            const { data, error } = await q;
            if (error) throw error;
            const rows = (data as Record<string, unknown>[] | null) ?? [];
            for (const r of rows) {
              controller.enqueue(encoder.encode(csvRow(COLUMNS.map((c) => r[c]))));
            }
            if (rows.length < BATCH) break;
          }
        }
        await recordAdminAction({
          actorId,
          kind: "user.data_export",
          targetType: "user",
          targetId: null,
          success: true,
          durationMs: performance.now() - startedAt,
          metadata: ids ? { scope: "selected", count: ids.length } : { scope: "filtered", ...filters },
        }).catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(csvRow(["ERROR", message])));
        await recordAdminAction({
          actorId,
          kind: "user.data_export",
          targetType: "user",
          targetId: null,
          success: false,
          durationMs: performance.now() - startedAt,
          metadata: ids
            ? { scope: "selected", count: ids.length, error: message }
            : { scope: "filtered", ...filters, error: message },
        }).catch(() => {});
      }
      controller.close();
    },
  });

  const filename = `stackivo-users-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
