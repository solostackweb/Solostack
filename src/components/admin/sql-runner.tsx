"use client";

/**
 * /admin/query — the SQL editor client.
 *
 * No CodeMirror / Monaco — a fixed-monospace <textarea> is enough for
 * Phase 3. Cmd+Enter (or Ctrl+Enter) submits.
 *
 * Saved queries: a fixed library of the most-asked ops questions. The
 * user can paste one into the textarea, then tweak before running.
 */

import * as React from "react";
import { Loader2, Play, Copy } from "lucide-react";
import { toast } from "sonner";

import { runReadonlySqlAction, type SqlResult } from "@/features/admin/sql";
import { cn } from "@/lib/utils";

interface SavedQuery {
  label: string;
  sql: string;
}

const SAVED: SavedQuery[] = [
  {
    label: "Signups in last 24h",
    sql: `select id, full_name, email, signed_up_at, plan, subscription_status
from public.admin_user_overview
where signed_up_at > now() - interval '1 day'
order by signed_up_at desc;`,
  },
  {
    label: "Unverified > 7d",
    sql: `select id, full_name, email, signed_up_at
from public.admin_user_overview
where email_confirmed_at is null
  and signed_up_at < now() - interval '7 days'
order by signed_up_at desc
limit 200;`,
  },
  {
    label: "MRR snapshot (approx)",
    sql: `select plan, count(*) as users,
       sum(case when status='active' then 1 else 0 end) as active
from public.subscriptions
group by plan
order by plan;`,
  },
  {
    label: "Failed deliveries (24h)",
    sql: `select id, kind, status, to_email, error, created_at
from public.delivery_logs
where status in ('failed','bounced','blocked')
  and created_at > now() - interval '1 day'
order by created_at desc
limit 200;`,
  },
  {
    label: "Security alerts (7d)",
    sql: `select id, kind, severity, user_id, request_id, created_at
from public.security_events
where severity = 'alert'
  and created_at > now() - interval '7 days'
order by created_at desc
limit 200;`,
  },
  {
    label: "Top revenue users",
    sql: `select id, full_name, email, plan, total_revenue_paise / 100 as revenue_inr
from public.admin_user_overview
order by total_revenue_paise desc nulls last
limit 50;`,
  },
];

export function SqlRunner() {
  const [sql, setSql] = React.useState(SAVED[0]?.sql ?? "");
  const [result, setResult] = React.useState<SqlResult | null>(null);
  const [pending, setPending] = React.useState(false);

  async function run() {
    if (pending) return;
    setPending(true);
    setResult(null);
    try {
      const r = await runReadonlySqlAction(sql);
      setResult(r);
      if (!r.ok) toast.error(r.error ?? "Query failed");
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Query
            </span>
            <span className="text-[10px] text-muted-foreground">
              SELECT / WITH / EXPLAIN only · 30s timeout · read-only role
            </span>
          </div>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            rows={10}
            className="w-full rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void run()}
              disabled={pending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run (⌘↵)
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(sql);
                toast.success("Copied SQL");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs hover:bg-accent"
            >
              <Copy className="h-3 w-3" />
              Copy
            </button>
            {result ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {result.ok ? "✓" : "✗"} {result.rowCount} rows · {result.elapsedMs}ms
              </span>
            ) : null}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-1.5 lg:w-64">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Saved queries
          </span>
          <ul className="space-y-1 rounded-xl border bg-card shadow-sm shadow-black/[0.03] p-1.5">
            {SAVED.map((q) => (
              <li key={q.label}>
                <button
                  type="button"
                  onClick={() => setSql(q.sql)}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {q.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResultPanel({ result }: { result: SqlResult }) {
  if (!result.ok) {
    return (
      <div className="space-y-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-xs">
        <div className="font-medium text-red-700 dark:text-red-300">
          Query failed
        </div>
        {result.sqlstate ? (
          <div className="font-mono text-[11px] text-muted-foreground">
            sqlstate {result.sqlstate}
          </div>
        ) : null}
        <pre className="whitespace-pre-wrap break-all font-mono text-xs">
          {result.error}
        </pre>
      </div>
    );
  }

  if (result.rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
        Query returned 0 rows.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {result.rowCount} rows · {result.elapsedMs}ms
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
        <table className="min-w-full text-xs">
          <thead className="bg-muted/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {result.columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2.5 py-1.5 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 500).map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-t border-border/40 hover:bg-accent/30",
                  i % 2 === 1 && "bg-muted/10",
                )}
              >
                {result.columns.map((c) => (
                  <td
                    key={c}
                    className="whitespace-pre-wrap break-all px-2.5 py-1.5 font-mono"
                  >
                    {renderCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length > 500 ? (
        <div className="text-[11px] text-muted-foreground">
          Showing first 500 rows. Add a tighter <code>WHERE</code> /
          <code>LIMIT</code> to see the rest.
        </div>
      ) : null}
    </div>
  );
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
