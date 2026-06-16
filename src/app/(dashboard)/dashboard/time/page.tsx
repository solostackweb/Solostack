import { TimeDashboardView } from "@/features/time/components/time-dashboard-view";
import {
  getRunningTimer,
  listTimeEntries,
  listTimeEntriesPaged,
  getUnbilledTime,
  type ListTimeEntriesPagedOptions,
} from "@/features/time/server";
import { getTimeAnalytics } from "@/features/time/analytics";
import { listProjects } from "@/features/projects/server";
import { listClients } from "@/features/clients/server";

export const metadata = { title: "Time" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
type TimeStatus = NonNullable<ListTimeEntriesPagedOptions["status"]>;
const STATUSES: TimeStatus[] = ["all", "billable", "non_billable", "unbilled", "invoiced"];

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string): string => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const q = str("q");
  const projectParam = str("project") || "all";
  const statusParam = str("status") || "all";
  const status: TimeStatus = (STATUSES as string[]).includes(statusParam)
    ? (statusParam as TimeStatus)
    : "all";
  const page = Math.max(1, Number(str("page")) || 1);
  const projectId =
    projectParam === "all" ? undefined : projectParam === "none" ? null : projectParam;

  const from = str("from") || undefined;
  const toRaw = str("to") || undefined;
  // Make the `to` date inclusive of the full day.
  const to = toRaw && toRaw.length === 10 ? `${toRaw}T23:59:59.999Z` : toRaw;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const [paged, summaryEntries, unbilled, runningTimer, projects, clients, analytics] =
    await Promise.all([
      listTimeEntriesPaged({ q, projectId, status, from, to, page, pageSize: PAGE_SIZE }),
      listTimeEntries({ from: weekStart.toISOString(), limit: 2000 }),
      getUnbilledTime(),
      getRunningTimer(),
      listProjects({ limit: 200 }),
      listClients({ limit: 200 }),
      getTimeAnalytics({ from, to, projectId }),
    ]);

  return (
    <TimeDashboardView
      entries={paged.entries}
      summaryEntries={summaryEntries}
      total={paged.total}
      page={page}
      pageSize={PAGE_SIZE}
      filters={{ q, project: projectParam, status, from: from ?? "", to: toRaw ?? "" }}
      unbilled={{ seconds: unbilled.totalSeconds, amount: unbilled.totalAmount }}
      runningTimer={runningTimer}
      analytics={analytics}
      projects={projects.map((p) => ({ id: p.id, name: p.name, clientId: p.clientId, billingEnabled: p.billingEnabled, hourlyRate: p.hourlyRate }))}
      clients={clients.map((c) => ({ id: c.id, name: c.businessName ?? c.fullName }))}
    />
  );
}
