import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, Users, Files, TrendingUp, Video, CheckCircle2, Receipt,
  type LucideIcon,
} from "lucide-react";
import { requireFeature } from "@/features/subscription/server";
import { limitFor } from "@/features/subscription/features";
import {
  PortalAccessError,
  getPortalSnapshot,
} from "@/features/portals/server";
import { PortalView } from "@/features/portals/components/portal-view";
import { isR2Configured } from "@/lib/r2/client";
import { portalClientHome } from "@/features/portals/routes";

export const metadata = { title: "Portal" };

export default async function PortalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sub = await requireFeature("clients.portal");

  let snapshot;
  try {
    snapshot = await getPortalSnapshot(id);
  } catch (err) {
    if (err instanceof PortalAccessError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const { access } = snapshot;
  const portal = access.portal;

  // Derived stats for the overview strip
  const activeMeetings = snapshot.meetings.filter(
    (m) => m.status === "pending" || m.status === "accepted",
  ).length;
  const pendingApprovals = snapshot.updates.filter(
    (u) => u.approval_status === "submitted" || u.approval_status === "under_review",
  ).length;
  const outstandingInvoices = snapshot.invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
  ).length;
  const sharedDocuments =
    snapshot.invoices.length +
    snapshot.contracts.length +
    snapshot.welcomeDocuments.length;
  const clientName =
    snapshot.client?.fullName ?? snapshot.client?.businessName ?? null;
  const isActive = portal.status === "active";

  // Money totals for the brand header strip.
  const paidAmount = snapshot.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const openAmount = snapshot.invoices
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const currency = snapshot.invoices[0]?.currency ?? "INR";
  const money = (amount: number) =>
    `${currency} ${new Intl.NumberFormat("en-IN").format(amount)}`;

  return (
    <div className="space-y-5">
      {/* ── Brand header — client name, status, money + view-as-client ─────── */}
      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        style={{ borderTop: `4px solid ${portal.brand_color ?? "#2563EB"}` }}
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Client portal
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {portal.name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {clientName ?? "No client linked"} · {portal.status}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <PortalMoneyStat label="Open" value={money(openAmount)} />
              <PortalMoneyStat label="Paid" value={money(paidAmount)} />
              <PortalMoneyStat label="Files" value={String(snapshot.files.length)} />
            </div>
            <Button asChild variant="outline" size="sm" className="self-start sm:self-end">
              <Link href={portalClientHome(id)} target="_blank">
                View as client <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Compact overview strip ─────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalMetric
          icon={Users}
          label="Client access"
          value={
            snapshot.members.length > 0
              ? "Connected"
              : snapshot.pendingInvitations.length > 0
                ? "Invite pending"
                : "Not invited"
          }
          tone={snapshot.members.length > 0 ? "success" : "muted"}
        />
        <PortalMetric
          icon={Files}
          label="Shared assets"
          value={`${snapshot.files.length} file${snapshot.files.length === 1 ? "" : "s"}`}
          tone="blue"
        />
        <PortalMetric
          icon={Receipt}
          label="Documents"
          value={`${sharedDocuments} linked`}
          tone="amber"
        />
        <PortalMetric
          icon={TrendingUp}
          label="Needs attention"
          value={`${pendingApprovals + outstandingInvoices + activeMeetings} open`}
          tone={pendingApprovals + outstandingInvoices + activeMeetings > 0 ? "danger" : "success"}
        />
      </section>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {/* Status */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
            isActive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            aria-hidden
          />
          {isActive ? "Active" : portal.status}
        </span>

        {/* Client */}
        {snapshot.members.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 font-medium text-foreground">
            <Users className="h-3 w-3 text-muted-foreground" />
            {snapshot.members.find((m) => m.role !== "owner")?.profile?.full_name
              ?? snapshot.members.find((m) => m.role !== "owner")?.profile?.email
              ?? "Client connected"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed bg-card px-2.5 py-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            No client yet
          </span>
        )}

        {/* Files */}
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 font-medium text-foreground">
          <Files className="h-3 w-3 text-muted-foreground" />
          {snapshot.files.length} file{snapshot.files.length !== 1 ? "s" : ""}
        </span>

        {/* Active meetings */}
        {activeMeetings > 0 && (
          <Link
            href="#portal-meetings"
            className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 font-semibold text-violet-700 transition-colors hover:bg-violet-500/15 dark:text-violet-400"
          >
            <Video className="h-3 w-3" />
            {activeMeetings} meeting{activeMeetings > 1 ? "s" : ""}
          </Link>
        )}

        {/* Pending approvals */}
        {pendingApprovals > 0 && (
          <Link
            href="#portal-updates"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
          >
            <TrendingUp className="h-3 w-3" />
            {pendingApprovals} pending review
          </Link>
        )}

        {/* All good */}
        {activeMeetings === 0 && pendingApprovals === 0 && snapshot.members.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            All up to date
          </span>
        )}
      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <PortalView
        portalId={id}
        portalName={portal.name}
        brandColor={portal.brand_color ?? "#2563EB"}
        portalStatus={portal.status}
        currentUserId={access.userId}
        role="owner"
        clientId={snapshot.client?.id ?? portal.client_id}
        clientName={clientName}
        clientEmail={snapshot.client?.email ?? null}
        members={snapshot.members.map((m) => ({
          user_id: m.user_id,
          role: m.role,
          profile: m.profile,
        }))}
        pendingInvitations={snapshot.pendingInvitations.map((i) => ({
          id: i.id,
          email: i.email,
          expires_at: i.expires_at,
        }))}
        files={snapshot.files}
        messages={snapshot.messages}
        contracts={snapshot.contracts}
        availableContracts={snapshot.availableContracts}
        invoices={snapshot.invoices}
        availableInvoices={snapshot.availableInvoices}
        welcomeDocuments={snapshot.welcomeDocuments}
        availableWelcomeDocuments={snapshot.availableWelcomeDocuments}
        activity={snapshot.activity}
        updates={snapshot.updates}
        meetings={snapshot.meetings}
        timeByProject={snapshot.timeByProject}
        storageUsage={snapshot.storageUsage}
        storageCap={limitFor(sub, "storage_bytes")}
        r2Enabled={isR2Configured()}
      />
    </div>
  );
}

function PortalMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "success" | "blue" | "amber" | "danger" | "muted";
}) {
  const tones = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    danger: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    muted: "border-border bg-muted text-muted-foreground",
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function PortalMoneyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}
