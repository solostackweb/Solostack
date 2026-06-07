import * as React from "react";
import Link from "next/link";
import {
  CircleDollarSign,
  Landmark,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR } from "@/lib/format";
import { RevenueChart as DashboardRevenueChart } from "@/components/dashboard/revenue-chart";

import {
  getClientRevenue,
  getPaidInvoiceSummary,
  getRevenueSeries,
  type ClientRevenueRow,
} from "../server";
import { mapClientRow, type ClientRecord } from "@/features/clients/server";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/supabase/types";

type Range = "3m" | "6m" | "12m";

const RANGE_MONTHS: Record<Range, number> = { "3m": 3, "6m": 6, "12m": 12 };
const RANGE_LABEL: Record<Range, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
};

function parseRange(value: string | undefined): Range {
  return value === "3m" || value === "6m" || value === "12m" ? value : "6m";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ".";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || ".";
}

interface TopClientItem extends ClientRevenueRow {
  name: string;
  initials: string;
}

async function hydrateTopClients(
  rows: ClientRevenueRow[],
): Promise<TopClientItem[]> {
  const ids = rows
    .map((r) => r.clientId)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return rows.map((r) => ({
      ...r,
      name: "Unknown client",
      initials: ".",
    }));
  }
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("clients").select("*").in("id", ids);
  const map = new Map<string, ClientRecord>();
  for (const row of (data as unknown as ClientRow[]) ?? []) {
    const c = mapClientRow(row);
    map.set(c.id, c);
  }
  return rows.map((r) => {
    const c = r.clientId ? map.get(r.clientId) : undefined;
    const name = c?.businessName ?? c?.fullName ?? "Unknown client";
    return { ...r, name, initials: initialsFromName(name) };
  });
}

interface PulseDashboardViewProps {
  range?: Range;
}

/**
 * Pulse - finance overview. Server-rendered from real Supabase data.
 */
export async function PulseDashboardView({
  range: explicitRange,
}: PulseDashboardViewProps = {}) {
  const range = explicitRange ?? "6m";
  const months = RANGE_MONTHS[range];

  const [series, paidSummary, topClientsRaw] = await Promise.all([
    getRevenueSeries(months),
    getPaidInvoiceSummary(),
    getClientRevenue(5),
  ]);

  const totalPaid = series.reduce((s, p) => s + p.paid, 0);
  const averageMonthly = months > 0 ? totalPaid / months : 0;
  const topClients = await hydrateTopClients(topClientsRaw);
  const topClient = topClients[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pulse"
        description="Your paid revenue, top clients, and business trends at a glance."
      />

      <div className="flex items-center overflow-x-auto">
        <Tabs value={range}>
          <TabsList className="shrink-0">
            {(Object.keys(RANGE_MONTHS) as Range[]).map((r) => (
              <TabsTrigger key={r} value={r} asChild>
                <Link href={`/dashboard/pulse?range=${r}`} replace>
                  {RANGE_LABEL[r]}
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi
          icon={CircleDollarSign}
          label={`Revenue (${RANGE_LABEL[range]})`}
          value={formatINR(totalPaid)}
          tone="primary"
          helper={totalPaid === 0 ? "No paid invoices yet" : "Paid invoice total"}
        />
        <Kpi
          icon={Wallet}
          label="Average monthly"
          value={formatINR(averageMonthly)}
          helper="Paid revenue pace"
        />
        <Kpi
          icon={Receipt}
          label="Paid invoices"
          value={String(paidSummary.count)}
          helper={formatINR(paidSummary.total)}
        />
        <Kpi
          icon={Users}
          label="Best client"
          value={topClient ? formatINR(topClient.totalPaid) : formatINR(0)}
          helper={topClient?.name ?? "No paid clients yet"}
          tone={topClient ? "success" : "default"}
        />
      </div>

      <DashboardRevenueChart series={series} />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Top clients by paid revenue
            </p>
            <Link
              href="/dashboard/clients"
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              View all →
            </Link>
          </div>
          {topClients.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No paid revenue yet"
              description="When paid invoices are created, clients will show up here ranked by revenue."
              className="min-h-[200px]"
            />
          ) : (
            <ul className="divide-y">
              {topClients.map((c) => (
                <li
                  key={c.clientId ?? c.name}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-accent/50"
                >
                  {c.clientId ? (
                    <Link
                      href={`/dashboard/clients/${c.clientId}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <ClientCell name={c.name} initials={c.initials} count={c.invoiceCount} />
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ClientCell name={c.name} initials={c.initials} count={c.invoiceCount} />
                    </div>
                  )}
                  <span className="text-sm font-bold tabular-nums">
                    {formatINR(c.totalPaid)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ComingSoonCard
          icon={Wallet}
          label="Expense tracking"
          description="Capture vendor expenses, categorise spend, and see month-over-month burn alongside your revenue."
        />
        <ComingSoonCard
          icon={Landmark}
          label="Tax estimates"
          description="Quarterly TDS / GST forecasts based on your paid invoice history."
        />
      </div>
    </div>
  );
}

function ClientCell({
  name,
  initials,
  count,
}: {
  name: string;
  initials: string;
  count: number;
}) {
  return (
    <>
      <Avatar className="h-9 w-9 ring-1 ring-border">
        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-indigo-500/10 text-[11px] font-bold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {count} paid invoice{count === 1 ? "" : "s"}
        </p>
      </div>
    </>
  );
}

type KpiTone = "default" | "primary" | "success";

function Kpi({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
  tone?: KpiTone;
}) {
  const iconTone =
    tone === "primary"
      ? "bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-primary/15"
      : tone === "success"
        ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400"
        : "bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-primary/15";
  return (
    <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${iconTone}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </p>
        {helper && (
          <p className="text-[11px] text-muted-foreground">{helper}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ComingSoonCard({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <Card className="border-dashed bg-muted/20">
      <CardContent className="flex items-start gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/50 text-muted-foreground ring-1 ring-border">
          <Icon className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold tracking-tight">{label}</p>
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              Soon
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { parseRange };
