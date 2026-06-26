/**
 * /admin/notifications - broadcast composer + recent broadcast log.
 *
 * The recent broadcast stream is derived from notification rows and grouped
 * by title plus minute-resolution timestamp.
 */

import { Activity, Bell, Users } from "lucide-react";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { formatIstStamp, formatRelative } from "@/features/admin/format";

export const dynamic = "force-dynamic";

interface BroadcastSummary {
  title: string;
  type: string;
  first_at: string;
  recipients: number;
}

async function fetchRecentBroadcasts(): Promise<BroadcastSummary[]> {
  const admin = getAdminSupabase();
  const result = await admin
    .from("notifications")
    .select("title, type, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows =
    (result.data as Array<{
      title: string;
      type: string;
      created_at: string;
    }> | null) ?? [];

  const groups = new Map<string, BroadcastSummary>();
  for (const r of rows) {
    const minute = r.created_at.slice(0, 16);
    const key = `${minute}::${r.title}`;
    const existing = groups.get(key);
    if (existing) {
      existing.recipients += 1;
    } else {
      groups.set(key, {
        title: r.title,
        type: r.type,
        first_at: r.created_at,
        recipients: 1,
      });
    }
  }
  return Array.from(groups.values())
    .filter((g) => g.recipients > 1)
    .sort((a, b) => b.first_at.localeCompare(a.first_at))
    .slice(0, 20);
}

export default async function AdminNotificationsPage() {
  const broadcasts = await fetchRecentBroadcasts();
  const recentRecipients = broadcasts.reduce(
    (sum, row) => sum + row.recipients,
    0,
  );

  return (
    <AdminSection>
      <AdminPageHeader
        title="Notifications"
        subtitle="Broadcast in-app messages, review recent sends, and keep the trail auditable."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          icon={Bell}
          label="Recent broadcasts"
          value={broadcasts.length}
          hint="Grouped from notification rows"
        />
        <SummaryCard
          icon={Users}
          label="Recent recipients"
          value={recentRecipients.toLocaleString("en-IN")}
          hint="Across grouped broadcast history"
        />
        <SummaryCard
          icon={Activity}
          label="Control"
          value="Audited"
          hint="Typed confirmation required"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
        <BroadcastForm />

        <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-4 py-3">
            <h2 className="text-sm font-semibold">Recent Broadcasts</h2>
            <p className="text-[11px] text-muted-foreground">
              Multi-recipient sends grouped by title and minute.
            </p>
          </div>
          {broadcasts.length === 0 ? (
            <div className="m-4 rounded-md border border-dashed bg-muted/20 px-3 py-10 text-center text-xs text-muted-foreground">
              No broadcasts in the recent history.
            </div>
          ) : (
            <ul className="divide-y divide-border/50 text-xs">
              {broadcasts.map((b) => (
                <li key={`${b.first_at}::${b.title}`} className="p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{b.title}</span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {formatRelative(b.first_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wider">
                      {b.type}
                    </span>
                    <span className="tabular-nums">
                      {b.recipients.toLocaleString("en-IN")} recipients
                    </span>
                    <span className="font-mono">{formatIstStamp(b.first_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminSection>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
