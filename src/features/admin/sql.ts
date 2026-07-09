"use server";

/**
 * Founder Console - SQL editor backing action.
 *
 * Calls the SECURITY DEFINER `admin_run_readonly_query` function
 * (migration 0020). The query text is audited verbatim into
 * `admin_actions.metadata.sql`.
 *
 * The function caps statement_timeout at 30s and runs as the
 * `admin_readonly` role - so by construction:
 *   - No INSERT / UPDATE / DELETE / DDL.
 *   - No access to schemas outside `public`.
 *   - Runaway queries cancel automatically.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { runAdminAction } from "./server";

export interface SqlResult {
  ok: boolean;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  elapsedMs: number;
  error?: string;
  sqlstate?: string;
}

export async function runReadonlySqlAction(sql: string): Promise<SqlResult> {
  const trimmed = sql.trim();
  if (!trimmed) {
    return {
      ok: false,
      columns: [],
      rows: [],
      rowCount: 0,
      elapsedMs: 0,
      error: "Empty query.",
    };
  }

  return await runAdminAction(
    {
      kind: "query.sql.run",
      targetType: "query",
      targetId: null,
      metadata: { sql: trimmed.slice(0, 2000) },
    },
    async () => {
      const admin = getAdminSupabase();
      const { data, error } = await admin.rpc("admin_run_readonly_query", {
        p_sql: trimmed,
      } as never);

      if (error) {
        return {
          ok: false,
          columns: [],
          rows: [],
          rowCount: 0,
          elapsedMs: 0,
          error: error.message,
        };
      }

      type RpcPayload = {
        columns?: string[];
        rows?: Array<Record<string, unknown>>;
        row_count?: number;
        elapsed_ms?: number;
        error?: string;
        sqlstate?: string;
      };
      const payload = (data ?? {}) as RpcPayload;

      if (payload.error) {
        return {
          ok: false,
          columns: payload.columns ?? [],
          rows: [],
          rowCount: 0,
          elapsedMs: payload.elapsed_ms ?? 0,
          error: payload.error,
          sqlstate: payload.sqlstate,
        };
      }

      return {
        ok: true,
        columns: payload.columns ?? [],
        rows: payload.rows ?? [],
        rowCount: payload.row_count ?? 0,
        elapsedMs: payload.elapsed_ms ?? 0,
      };
    },
  );
}
