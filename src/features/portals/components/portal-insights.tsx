"use client";

import * as React from "react";
import {
  Eye, MessageSquare, FileText, CheckCircle2, Clock, Users,
  TrendingUp, Download, AlertCircle, CheckSquare, Wallet,
  Activity, ExternalLink, ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ViewProps } from "./portal-view";

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface PortalInsightsProps {
  data: ViewProps;
  brandColor: string;
}

export function PortalInsights({ data, brandColor }: PortalInsightsProps) {
  const isOwner = data.role === "owner";

  // Compute insights (always run, but only used when isOwner)
  const insights = React.useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;

    // Client activity
    const clientMessages = data.messages.filter(m => m.author_id !== data.currentUserId).length;
    const freelancerMessages = data.messages.filter(m => m.author_id === data.currentUserId).length;
    const lastClientMessage = data.messages
      .filter(m => m.author_id !== data.currentUserId)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    const lastFreelancerMessage = data.messages
      .filter(m => m.author_id === data.currentUserId)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

    // Updates engagement
    const totalUpdates = data.updates.length;
    const deliverableUpdates = data.updates.filter(u => u.update_type === "deliverable").length;
    const pendingApprovals = data.updates.filter(
      u => u.update_type === "deliverable" &&
           u.approval_status !== "approved" &&
           u.approval_status !== "none",
    ).length;
    const approvedDeliverables = data.updates.filter(
      u => u.update_type === "deliverable" && u.approval_status === "approved",
    ).length;
    const clientReactions = data.updates.flatMap(u => u.reactions.filter(r => r.user_id !== data.currentUserId)).length;
    const unacknowledgedUpdates = data.updates.filter(
      u => u.reactions.every(r => r.user_id === data.currentUserId || r.kind !== "acknowledged"),
    ).length;

    // Files
    const totalFiles = data.files.length;
    const deliverableFiles = data.files.filter(f => f.category === "deliverable").length;
    const recentFiles = data.files.filter(f => now - Date.parse(f.created_at) < weekMs).length;

    // Contracts & Invoices
    const unsignedContracts = data.contracts.filter(c => c.status !== "signed" && c.status !== "declined").length;
    const openInvoices = data.invoices.filter(i => i.status !== "paid" && i.status !== "cancelled").length;
    const overdueInvoices = data.invoices.filter(i => i.status === "overdue").length;
    const totalOutstanding = data.invoices
      .filter(i => i.status !== "paid" && i.status !== "cancelled")
      .reduce((sum, i) => sum + i.total_amount, 0);

    // Meetings
    const upcomingMeetings = data.meetings.filter(m => m.status === "accepted" || m.status === "pending").length;
    const completedMeetings = data.meetings.filter(m => m.status === "completed").length;

    // Portal health score (0-100)
    let healthScore = 50;
    if (clientMessages > 0) healthScore += 10;
    if (pendingApprovals === 0 && deliverableUpdates > 0) healthScore += 15;
    if (unsignedContracts === 0) healthScore += 10;
    if (overdueInvoices === 0) healthScore += 10;
    if (upcomingMeetings > 0 || completedMeetings > 0) healthScore += 5;
    if (recentFiles > 0) healthScore += 5;
    healthScore = Math.min(100, Math.max(0, healthScore));

    // Time since last client activity
    const lastClientActivity = [
      lastClientMessage ? Date.parse(lastClientMessage.created_at) : 0,
      ...data.updates.flatMap(u => u.reactions.filter(r => r.user_id !== data.currentUserId).map(r => Date.parse(r.created_at))),
    ].filter(Boolean).sort((a, b) => b - a)[0] ?? 0;
    const daysSinceClientActivity = lastClientActivity ? Math.floor((now - lastClientActivity) / dayMs) : null;

    return {
      healthScore,
      communication: {
        clientMessages,
        freelancerMessages,
        lastClientMessage: lastClientMessage?.created_at ?? null,
        lastFreelancerMessage: lastFreelancerMessage?.created_at ?? null,
        daysSinceClientActivity,
      },
      updates: {
        total: totalUpdates,
        deliverables: deliverableUpdates,
        pendingApprovals,
        approved: approvedDeliverables,
        clientReactions,
        unacknowledged: unacknowledgedUpdates,
      },
      files: {
        total: totalFiles,
        deliverables: deliverableFiles,
        recent: recentFiles,
      },
      financial: {
        unsignedContracts,
        openInvoices,
        overdueInvoices,
        totalOutstanding,
      },
      meetings: {
        upcoming: upcomingMeetings,
        completed: completedMeetings,
      },
    };
  }, [data]);

  if (!isOwner) return null;

  const healthColor = insights.healthScore >= 80 ? "success" : insights.healthScore >= 60 ? "warning" : "destructive";

  return (
    <Card className="border-l-4" style={{ borderLeftColor: brandColor }}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4" style={{ color: brandColor }} />
          Portal Insights
          <Badge variant="secondary" className="h-5 px-2 text-xs ml-auto">
            Health: {insights.healthScore}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="rounded-lg p-4" style={{ background: `${brandColor}10` }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Portal Health</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: brandColor }}>
                {insights.healthScore}/100
              </p>
            </div>
            <div className="w-16 h-16 rounded-full border-4 flex items-center justify-center"
                 style={{ borderColor: `${brandColor}30` }}>
              <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center"
                   style={{
                     borderTopColor: brandColor,
                     borderRightColor: `${brandColor}30`,
                     borderBottomColor: `${brandColor}30`,
                     borderLeftColor: `${brandColor}30`,
                   }}>
                <span className="text-xs font-bold" style={{ color: brandColor }}>
                  {insights.healthScore}%
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width]"
                 style={{ width: `${insights.healthScore}%`, background: brandColor }} />
          </div>
          {insights.communication.daysSinceClientActivity !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last client activity: {insights.communication.daysSinceClientActivity === 0 ? "Today" : `${insights.communication.daysSinceClientActivity}d ago`}
              {insights.communication.daysSinceClientActivity > 7 && (
                <span className="ml-2 text-destructive">⚠ Client inactive for a week+</span>
              )}
            </p>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <InsightStat
            icon={MessageSquare}
            label="Messages"
            value={`${insights.communication.clientMessages} / ${insights.communication.freelancerMessages}`}
            description="Client / You"
            iconColor="blue"
          />
          <InsightStat
            icon={CheckSquare}
            label="Approvals"
            value={insights.updates.pendingApprovals > 0 ? `${insights.updates.pendingApprovals} pending` : "All clear"}
            description={insights.updates.approved > 0 ? `${insights.updates.approved} approved` : "No approvals"}
            iconColor={insights.updates.pendingApprovals > 0 ? "amber" : "green"}
          />
          <InsightStat
            icon={FileText}
            label="Deliverables"
            value={insights.updates.deliverables > 0 ? `${insights.updates.deliverables} shared` : "None yet"}
            description={insights.updates.approved > 0 ? `${insights.updates.approved} approved` : ""}
            iconColor="violet"
          />
          <InsightStat
            icon={Wallet}
            label="Outstanding"
            value={insights.financial.openInvoices > 0 ? `${insights.financial.openInvoices} invoices` : "All settled"}
            description={insights.financial.totalOutstanding > 0 ? `₹${insights.financial.totalOutstanding.toLocaleString()}` : ""}
            iconColor={insights.financial.overdueInvoices > 0 ? "red" : "green"}
          />
        </div>

        {/* Action Required */}
        {(insights.updates.pendingApprovals > 0 || insights.financial.unsignedContracts > 0 || insights.financial.overdueInvoices > 0) && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-warning mb-2">
              <AlertCircle className="h-4 w-4" />
              Action Required
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {insights.updates.pendingApprovals > 0 && (
                <li className="flex items-center gap-2">
                  <CheckSquare className="h-3 w-3 text-warning" />
                  {insights.updates.pendingApprovals} deliverable{insights.updates.pendingApprovals > 1 ? "s" : ""} awaiting client approval
                </li>
              )}
              {insights.updates.unacknowledged > 0 && (
                <li className="flex items-center gap-2">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  {insights.updates.unacknowledged} update{insights.updates.unacknowledged > 1 ? "s" : ""} not acknowledged by client
                </li>
              )}
              {insights.financial.unsignedContracts > 0 && (
                <li className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-warning" />
                  {insights.financial.unsignedContracts} contract{insights.financial.unsignedContracts > 1 ? "s" : ""} unsigned
                </li>
              )}
              {insights.financial.overdueInvoices > 0 && (
                <li className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  {insights.financial.overdueInvoices} overdue invoice{insights.financial.overdueInvoices > 1 ? "s" : ""}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Recent Activity Summary */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Recent Activity</p>
          <div className="space-y-1.5">
            {insights.communication.lastClientMessage && (
              <ActivityRow
                icon={MessageSquare}
                label="Client replied"
                time={insights.communication.lastClientMessage}
                iconColor="blue"
              />
            )}
            {insights.updates.total > 0 && (
              <ActivityRow
                icon={TrendingUp}
                label={`Posted ${insights.updates.total} update${insights.updates.total > 1 ? "s" : ""}`}
                time={data.updates[0]?.created_at}
                iconColor="violet"
              />
            )}
            {insights.files.recent > 0 && (
              <ActivityRow
                icon={FileText}
                label={`${insights.files.recent} file${insights.files.recent > 1 ? "s" : ""} uploaded this week`}
                time={data.files[0]?.created_at}
                iconColor="blue"
              />
            )}
            {insights.meetings.upcoming > 0 && (
              <ActivityRow
                icon={Clock}
                label={`${insights.meetings.upcoming} upcoming meeting${insights.meetings.upcoming > 1 ? "s" : ""}`}
                time={data.meetings.find(m => m.status === "accepted" || m.status === "pending")?.created_at}
                iconColor="amber"
              />
            )}
            {(insights.communication.clientMessages === 0 && insights.updates.total === 0 && insights.files.total === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">No activity yet — start by posting an update or uploading a file</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => window.location.href = `/dashboard/portal/${data.portalId}`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Open in Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => window.location.href = `/portal/${data.portalId}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View as Client
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightStat({ icon: Icon, label, value, description, iconColor }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  description: string;
  iconColor: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    green: "bg-success/10 text-success",
    amber: "bg-warning/10 text-warning",
    red: "bg-destructive/10 text-destructive",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[iconColor] || colors.blue}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

function ActivityRow({ icon: Icon, label, time, iconColor }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  time: string | undefined;
  iconColor: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    green: "bg-success/10 text-success",
    amber: "bg-warning/10 text-warning",
    red: "bg-destructive/10 text-destructive",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`flex h-6 w-6 items-center justify-center rounded ${colors[iconColor] || colors.blue}`}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="text-muted-foreground flex-1">{label}</span>
      {time && <time className="text-muted-foreground/70">{formatRelativeDate(time)}</time>}
    </div>
  );
}