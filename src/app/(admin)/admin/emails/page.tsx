/**
 * /admin/emails
 *
 * Three stacked sections:
 *
 *   0. Brevo Stats       — 30-day aggregate metrics (delivery/open/click/bounce)
 *   1. Delivery log      — filterable (status, recipient email substring),
 *                           paginated. Click-through to Brevo dashboard
 *                           if `provider_message_id` exists.
 *   2. Suppression list  — last 100 rows, search by email, remove inline.
 *                           New manual additions via the small add form.
 */

import Link from "next/link";
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { listEmails, listSuppressions } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, StatCard } from "@/components/admin/kit";
import {
  formatIstStamp,
  formatRelative,
  shortenId,
} from "@/features/admin/format";
import {
  SuppressionAddForm,
  SuppressionRemoveButton,
} from "@/components/admin/suppression-actions";
import { cn } from "@/lib/utils";
import {
  getBrevoEmailStats,
  getBrevoAccount,
  isBrevoConfigured,
} from "@/lib/brevo-api";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_TABS = [
  "all",
  "delivered",
  "failed",
  "bounced",
  "blocked",
] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default async function AdminEmailsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = parseStatusTab(asString(sp.status)) ?? "all";
  const q = asString(sp.q) ?? undefined;
  const suppQ = asString(sp.supp) ?? undefined;
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const [emails, suppressions, brevoStats, brevoAccount] = await Promise.all([
    listEmails({
      status: status === "all" ? "all" : status,
      q,
      page,
      pageSize: 50,
    }),
    listSuppressions(suppQ, 100),
    getBrevoEmailStats(),
    getBrevoAccount(),
  ]);
  const totalPages = Math.max(1, Math.ceil(emails.total / 50));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Emails"
        subtitle={
          <span>
            Delivery log + suppressions · last-24h counts:{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              ✓ {emails.counts.delivered}
            </span>{" "}
            ·{" "}
            <span className="text-red-600 dark:text-red-400">
              ✗ {emails.counts.failed + emails.counts.bounced + emails.counts.blocked}
            </span>
          </span>
        }
      />

      {/* ── Brevo 30-day stats ─────────────────────────────────────────────── */}
      {isBrevoConfigured() ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Brevo — Last 30 Days
            </h2>
            {brevoAccount && (
              <span className="text-[11px] text-muted-foreground">
                {brevoAccount.email} · Plan: {brevoAccount.plan}
                {brevoAccount.creditsLeft !== null
                  ? ` · ${brevoAccount.creditsLeft.toLocaleString()} sends left`
                  : ""}
              </span>
            )}
          </div>
          {brevoStats ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <BrevoCard label="Sent" value={brevoStats.sent} />
              <BrevoCard label="Delivered" value={brevoStats.delivered} />
              <BrevoCard
                label="Delivery Rate"
                value={brevoStats.deliveryRate !== null ? `${brevoStats.deliveryRate}%` : "—"}
                tone={
                  brevoStats.deliveryRate === null
                    ? "neutral"
                    : brevoStats.deliveryRate >= 95
                      ? "good"
                      : brevoStats.deliveryRate >= 85
                        ? "warn"
                        : "bad"
                }
              />
              <BrevoCard
                label="Open Rate"
                value={brevoStats.openRate !== null ? `${brevoStats.openRate}%` : "—"}
                tone={
                  brevoStats.openRate === null
                    ? "neutral"
                    : brevoStats.openRate >= 25
                      ? "good"
                      : brevoStats.openRate >= 15
                        ? "warn"
                        : "bad"
                }
              />
              <BrevoCard
                label="Click Rate"
                value={brevoStats.clickRate !== null ? `${brevoStats.clickRate}%` : "—"}
                tone={
                  brevoStats.clickRate === null
                    ? "neutral"
                    : brevoStats.clickRate >= 3
                      ? "good"
                      : "neutral"
                }
              />
              <BrevoCard
                label="Bounces"
                value={brevoStats.bounces}
                tone={brevoStats.bounces === 0 ? "good" : brevoStats.bounces < 5 ? "warn" : "bad"}
              />
              <BrevoCard
                label="Bounce Rate"
                value={brevoStats.bounceRate !== null ? `${brevoStats.bounceRate}%` : "—"}
                tone={
                  brevoStats.bounceRate === null
                    ? "neutral"
                    : brevoStats.bounceRate < 2
                      ? "good"
                      : brevoStats.bounceRate < 5
                        ? "warn"
                        : "bad"
                }
              />
              <BrevoCard
                label="Spam Reports"
                value={brevoStats.spamReports}
                tone={brevoStats.spamReports === 0 ? "good" : "bad"}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not load Brevo statistics. Check that{" "}
              <code className="text-xs">BREVO_API_KEY</code> is valid.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Brevo stats unavailable — set{" "}
          <code className="text-xs">BREVO_API_KEY</code> in environment
          variables to enable 30-day email metrics.
        </section>
      )}

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-1">
        {STATUS_TABS.map((t) => {
          const active = t === status;
          const count =
            t === "all"
              ? null
              : t === "delivered"
                ? emails.counts.delivered
                : t === "failed"
                  ? emails.counts.failed
                  : t === "bounced"
                    ? emails.counts.bounced
                    : emails.counts.blocked;
          return (
            <Link
              key={t}
              href={`/admin/emails?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {t}
              {count !== null ? (
                <span
                  className={cn(
                    "rounded bg-muted px-1.5 text-[10px] tabular-nums",
                    active
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {count.toLocaleString("en-IN")}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Filter form */}
      <form
        method="get"
        action="/admin/emails"
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="status" value={status} />
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Recipient email…"
          className="h-8 w-56 rounded border bg-background px-2 text-xs"
        />
        <button
          type="submit"
          className="h-8 rounded border bg-background px-3 text-xs hover:bg-accent"
        >
          Filter
        </button>
        {q ? (
          <Link
            href={`/admin/emails?status=${status}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {/* Delivery log */}
      <section className="space-y-2">
        <SectionTitle>
          Delivery log · {emails.total.toLocaleString("en-IN")} matches · page{" "}
          {page} / {totalPages}
        </SectionTitle>
        {emails.rows.length === 0 ? (
          <Empty>No matching deliveries.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
            {emails.rows.map((row) => (
              <li
                key={row.id}
                className="border-b border-border/40 p-2.5 text-xs last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusDot status={row.status} />
                  <span className="font-medium">{row.kind}</span>
                  <span className="text-muted-foreground">{row.channel}</span>
                  {row.to_email ? (
                    <span className="font-mono">{row.to_email}</span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {formatIstStamp(row.created_at)}
                    </span>
                    {row.provider_message_id ? (
                      <span className="font-mono">
                        {shortenId(row.provider_message_id)}
                      </span>
                    ) : null}
                  </span>
                </div>
                {row.subject ? (
                  <div className="ml-4 mt-0.5 truncate text-muted-foreground">
                    {row.subject}
                  </div>
                ) : null}
                {row.error ? (
                  <div className="ml-4 mt-0.5 truncate text-red-600 dark:text-red-400">
                    {row.error}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 ? (
          <nav className="flex items-center justify-between text-xs">
            <PageLink
              page={Math.max(1, page - 1)}
              status={status}
              q={q}
              disabled={page === 1}
            >
              ← Prev
            </PageLink>
            <span className="text-muted-foreground tabular-nums">
              Page {page} / {totalPages}
            </span>
            <PageLink
              page={Math.min(totalPages, page + 1)}
              status={status}
              q={q}
              disabled={page === totalPages}
            >
              Next →
            </PageLink>
          </nav>
        ) : null}
      </section>

      {/* Suppression list */}
      <section className="space-y-2">
        <SectionTitle>
          Suppressions · {suppressions.length} recent
        </SectionTitle>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <form method="get" action="/admin/emails" className="flex gap-1.5">
            <input type="hidden" name="status" value={status} />
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <input
              type="text"
              name="supp"
              defaultValue={suppQ ?? ""}
              placeholder="Filter by email…"
              className="h-7 w-48 rounded border bg-background px-2 text-xs"
            />
            <button
              type="submit"
              className="h-7 rounded border bg-background px-3 text-xs hover:bg-accent"
            >
              Filter
            </button>
          </form>
          <SuppressionAddForm />
        </div>

        {suppressions.length === 0 ? (
          <Empty>No suppressions on file.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
            {suppressions.map((s) => (
              <li
                key={s.email}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{s.email}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.reason}
                  </span>
                  <span className="text-muted-foreground">{s.provider}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatRelative(s.updated_at)}
                  </span>
                  <SuppressionRemoveButton email={s.email} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground">
        Brevo dashboard{" "}
        <a
          className="inline-flex items-center gap-0.5 hover:text-foreground"
          href="https://app.brevo.com/transactional-email/list"
          target="_blank"
          rel="noreferrer"
        >
          opens here <ExternalLink className="h-3 w-3" />
        </a>{" "}
        — search by provider message id to inspect headers.
      </p>
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "delivered" || status === "opened" || status === "clicked"
      ? "bg-emerald-500"
      : status === "queued" || status === "sent"
        ? "bg-sky-500"
        : status === "bounced" || status === "blocked" || status === "failed"
          ? "bg-red-500"
          : "bg-muted-foreground/50";
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", tone)} aria-hidden />
      <span className="text-muted-foreground">{status}</span>
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function PageLink({
  page,
  status,
  q,
  disabled,
  children,
}: {
  page: number;
  status: StatusTab;
  q: string | undefined;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border px-2 py-1 opacity-40">{children}</span>
    );
  }
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("page", String(page));
  if (q) params.set("q", q);
  return (
    <Link
      href={`/admin/emails?${params.toString()}`}
      className="rounded border px-2 py-1 hover:bg-accent"
    >
      {children}
    </Link>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseStatusTab(v: string | undefined): StatusTab | undefined {
  return (STATUS_TABS as readonly string[]).includes(v ?? "")
    ? (v as StatusTab)
    : undefined;
}

// ---------------------------------------------------------------------------
// Brevo metric card
// ---------------------------------------------------------------------------

type CardTone = "good" | "warn" | "bad" | "neutral";

function BrevoCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: CardTone;
}) {
  const kitTone =
    tone === "good" ? "ok" : tone === "bad" ? "alert" : tone === "warn" ? "warn" : "neutral";
  return (
    <StatCard
      label={label}
      value={typeof value === "number" ? value.toLocaleString() : value}
      tone={kitTone}
    />
  );
}
