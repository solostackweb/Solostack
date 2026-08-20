import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, Users, Files, TrendingUp, Video, CheckCircle2, Receipt,
  type LucideIcon,
} from "lucide-react";
import { requireFeature } from "@/features/subscription/server";
import { limitFor } from "@/features/subscription/features";
import { effectivePortalStorageCap } from "@/features/portals/storage";
import {
  PortalAccessError,
  getPortalSnapshot,
} from "@/features/portals/server";
import { PortalView } from "@/features/portals/components/portal-view";
import { isR2Configured } from "@/lib/r2/client";
import { portalClientHome } from "@/features/portals/routes";
import { formatCurrencyAmount } from "@/lib/format";
import { BRAND_PRIMARY } from "@/config/brand-colors";

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
  const paidAmount = formatGroupedMoney(
    snapshot.invoices.filter((invoice) => invoice.status === "paid"),
  );
  const openAmount = formatGroupedMoney(
    snapshot.invoices.filter(
      (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
    ),
  );

  return (
    <div className="space-y-5">
      {/* ── Brand header — client name, status, money + view-as-client ─────── */}
      <section
        className="overflow-hidden rounded-lg border bg-card shadow-sm"
        style={{ borderTop: `4px solid ${portal.brand_color ?? BRAND_PRIMARY}` }}
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-micro font-semibold uppercase tracking-widest text-muted-foreground">
              Client portal
            </p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {portal.name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {clientName ?? "No client linked"} · {portal.status}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
            <PortalMoneyStat label="Open" value={openAmount} />
            <PortalMoneyStat label="Paid" value={paidAmount} />
            <PortalMoneyStat label="Files" value={String(snapshot.files.length)} />
            <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 self-center">
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

      <div className="flex flex-wrap gap-2 text-micro">
        {/* Status */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
            isActive
              ? "border-success-subtle bg-success-subtle text-success-strong"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-success" : "bg-muted-foreground/40"}`}
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
            className="inline-flex items-center gap-1.5 rounded-full border border-warning-subtle bg-warning-subtle px-2.5 py-1 font-semibold text-warning-strong transition-colors hover:bg-warning-subtle"
          >
            <TrendingUp className="h-3 w-3" />
            {pendingApprovals} pending review
          </Link>
        )}

        {/* All good */}
        {activeMeetings === 0 && pendingApprovals === 0 && snapshot.members.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-subtle bg-success-subtle px-2.5 py-1 font-medium text-success-strong">
            <CheckCircle2 className="h-3 w-3" />
            All up to date
          </span>
        )}
      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <PortalView
        portalId={id}
        portalName={portal.name}
        brandColor={portal.brand_color ?? BRAND_PRIMARY}
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
        proposals={snapshot.proposals}
        availableProposals={snapshot.availableProposals}
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
        storageCap={effectivePortalStorageCap(limitFor(sub, "storage_bytes"))}
        lastSeenAt={null}
        welcomeVideoUrl={portal.welcome_video_url ?? null}
        welcomeMessage={portal.welcome_message ?? null}
        brandLogoUrl={null}
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
    success: "border-success-subtle bg-success-subtle text-success-strong",
    blue: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    amber: "border-warning-subtle bg-warning-subtle text-warning-strong",
    danger: "border-destructive-subtle bg-destructive-subtle text-destructive-strong",
    muted: "border-border bg-muted text-muted-foreground",
  };

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground">
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
    <div className="min-w-[7rem] shrink-0 rounded-lg border bg-background/70 px-3 py-2">
      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function formatGroupedMoney(
  invoices: Array<{ total_amount: number; currency: string | null }>,
): string {
  if (invoices.length === 0) return formatCurrencyAmount(0, "INR");
  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    const currency = (invoice.currency || "INR").toUpperCase();
    totals.set(currency, (totals.get(currency) ?? 0) + Number(invoice.total_amount));
  }
  return Array.from(totals.entries())
    .map(([currency, amount]) => formatCurrencyAmount(amount, currency))
    .join(" + ");
}
