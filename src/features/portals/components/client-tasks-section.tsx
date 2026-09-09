"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2, Clock3, AlertCircle, FileText, Wallet,
  MessageSquare, ExternalLink, ChevronRight,
  CheckSquare, ThumbsUp, RotateCcw, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ViewProps } from "./portal-view";
import type { PortalMessageRow } from "@/lib/supabase/types";

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

interface ClientTasksSectionProps {
  data: ViewProps;
  brandColor: string;
}

/**
 * Unified task/approval hub for the client portal home.
 * Combines onboarding items, pending approvals, unsigned contracts,
 * open invoices, and unread messages into one actionable list.
 */
export function ClientTasksSection({ data, brandColor }: ClientTasksSectionProps) {
  // Collect all actionable items
  const tasks = React.useMemo(() => {
    const items: Array<{
      id: string;
      type: "onboarding" | "approval" | "contract" | "invoice" | "proposal" | "message";
      priority: "high" | "medium" | "low";
      label: string;
      description: string;
      href: string;
      external?: boolean;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string;
      badgeColor?: "red" | "amber" | "blue" | "green" | "violet";
      completed?: boolean;
      dueDate?: string;
    }> = [];

    // Onboarding items (high priority)
    const unsignedContracts = data.contracts.filter(
      (c) => c.status !== "signed" && c.status !== "declined",
    );
    if (unsignedContracts.length > 0) {
      items.push({
        id: "contracts-unsigned",
        type: "contract",
        priority: "high",
        label: "Review & sign contract",
        description: `${unsignedContracts.length} contract${unsignedContracts.length > 1 ? "s" : ""} awaiting signature`,
        href: `/portal/${data.portalId}/files`,
        icon: FileText,
        badge: `${unsignedContracts.length}`,
        badgeColor: "red",
      });
    }

    const openProposals = data.proposals.filter(
      (p) => p.status !== "accepted" && p.status !== "declined" && p.status !== "converted",
    );
    if (openProposals.length > 0) {
      items.push({
        id: "proposals-open",
        type: "proposal",
        priority: "high",
        label: "Review proposal",
        description: `${openProposals.length} proposal${openProposals.length > 1 ? "s" : ""} awaiting your review`,
        href: `/portal/${data.portalId}/proposals`,
        icon: MessageSquare,
        badge: `${openProposals.length}`,
        badgeColor: "blue",
      });
    }

    const openInvoices = data.invoices.filter(
      (invoice) => invoice.status !== "paid" && invoice.status !== "cancelled",
    );
    if (openInvoices.length > 0) {
      items.push({
        id: "invoices-open",
        type: "invoice",
        priority: "high",
        label: "Settle invoice",
        description: `${openInvoices.length} invoice${openInvoices.length > 1 ? "s" : ""} open`,
        href: `/portal/${data.portalId}/invoices`,
        icon: Wallet,
        badge: `${openInvoices.length}`,
        badgeColor: "amber",
      });
    }

    // Pending approvals (deliverables)
    const pendingApprovals = data.updates.filter(
      (update) =>
        update.update_type === "deliverable" &&
        update.approval_status !== "approved" &&
        update.approval_status !== "none",
    );
    pendingApprovals.forEach((update) => {
      items.push({
        id: `approval-${update.id}`,
        type: "approval",
        priority: "high",
        label: "Review deliverable",
        description: update.title,
        href: `/portal/${data.portalId}/updates#update-${update.id}`,
        icon: CheckSquare,
        badge: APPROVAL_LABELS[update.approval_status] || "Pending",
        badgeColor: APPROVAL_BADGE_COLOR[update.approval_status],
        dueDate: update.created_at as string,
      });
    });

    // Other onboarding-style items (medium priority)
    if (data.contracts.length > 0 && unsignedContracts.length === 0) {
      items.push({
        id: "contracts-signed",
        type: "contract",
        priority: "low",
        label: "Contracts signed",
        description: "All contracts completed",
        href: `/portal/${data.portalId}/files`,
        icon: CheckCircle2,
        badge: "Done",
        badgeColor: "green",
        completed: true,
      });
    }

    if (data.proposals.length > 0 && openProposals.length === 0) {
      items.push({
        id: "proposals-reviewed",
        type: "proposal",
        priority: "low",
        label: "Proposals reviewed",
        description: "All proposals completed",
        href: `/portal/${data.portalId}/proposals`,
        icon: CheckCircle2,
        badge: "Done",
        badgeColor: "green",
        completed: true,
      });
    }

    if (data.invoices.length > 0 && openInvoices.length === 0) {
      items.push({
        id: "invoices-settled",
        type: "invoice",
        priority: "low",
        label: "All invoices settled",
        description: "No outstanding payments",
        href: `/portal/${data.portalId}/invoices`,
        icon: CheckCircle2,
        badge: "Done",
        badgeColor: "green",
        completed: true,
      });
    }

    // Unread messages (medium priority) — count messages from freelancer
    // since there's no read_at field, we use a simple heuristic
    const freelancerMessages = data.messages.filter(
      (m) => m.author_id !== data.currentUserId,
    ).length;
    if (freelancerMessages > 0) {
      items.push({
        id: "messages-unread",
        type: "message",
        priority: "medium",
        label: "New messages",
        description: `${freelancerMessages} message${freelancerMessages > 1 ? "s" : ""} from your freelancer`,
        href: `/portal/${data.portalId}/chat`,
        icon: MessageSquare,
        badge: `${freelancerMessages}`,
        badgeColor: "violet",
      });
    }

    // Upcoming meeting
    const upcomingMeeting = data.meetings.find(
      (meeting) => meeting.status === "accepted" || meeting.status === "pending",
    );
    if (upcomingMeeting?.meet_link) {
      items.push({
        id: `meeting-${upcomingMeeting.id}`,
        type: "approval",
        priority: "medium",
        label: "Upcoming meeting",
        description: upcomingMeeting.topic || "Meeting scheduled",
        href: upcomingMeeting.meet_link,
        external: true,
        icon: Clock3,
        badge: upcomingMeeting.proposed_time ?? undefined,
        badgeColor: "blue",
      });
    }

    // Sort by priority (high first), then by type
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [data]);

  if (tasks.length === 0) return null;

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <section className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tasks & Approvals</h2>
          <p className="text-xs text-muted-foreground">
            {incompleteTasks.length} pending {incompleteTasks.length === 1 ? "item" : "items"}
            {completedTasks.length > 0 ? ` · ${completedTasks.length} done` : ""}
          </p>
        </div>
        {incompleteTasks.length > 0 && (
          <Badge variant="secondary" className="h-5 gap-1 text-xs">
            <AlertCircle className="h-3 w-3" />
            {incompleteTasks.length} action needed
          </Badge>
        )}
      </div>

      {/* High priority items first */}
      {incompleteTasks.length > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: brandColor }}>
          <CardContent className="p-0">
            <ul className="divide-y">
              {incompleteTasks.map((task) => (
                <li key={task.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        task.priority === "high"
                          ? "bg-destructive/10 text-destructive"
                          : task.priority === "medium"
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <task.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{task.label}</span>
                        {task.badge && (
                          <Badge
                            variant={
                              task.badgeColor === "red"
                                ? "destructive"
                              : task.badgeColor === "amber"
                                ? "secondary"
                              : task.badgeColor === "blue"
                                ? "default"
                              : task.badgeColor === "green"
                                ? "success"
                                : "outline"
                            }
                            className="h-4 px-2 text-xs"
                          >
                            {task.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                      {task.dueDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Posted {formatRelativeDate(task.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {task.external ? (
                        <a
                          href={task.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Open
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <Link
                          href={task.href}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          View
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                      {task.type === "approval" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs border-success-subtle text-success-strong hover:bg-success-subtle"
                          >
                            <ThumbsUp className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs border-warning-subtle text-warning-strong hover:bg-warning-subtle"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Revision
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Completed items - collapsed by default */}
      {completedTasks.length > 0 && (
        <details className="group rounded-lg border bg-muted/30">
          <summary className="flex items-center gap-2 p-3 text-sm font-medium text-muted-foreground cursor-pointer list-none">
            <CheckCircle2 className="h-4 w-4" />
            <span>{completedTasks.length} completed</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-3 pb-3 space-y-2">
            {completedTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <task.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-through text-muted-foreground">{task.label}</p>
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                </div>
                <Badge variant="success" className="h-4 px-2 text-xs">
                  Done
                </Badge>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

// Re-use label/badge maps from updates-section
const APPROVAL_LABELS: Record<string, string> = {
  none: "",
  submitted: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  revision_requested: "Revision requested",
};

const APPROVAL_BADGE_COLOR: Record<string, "red" | "amber" | "blue" | "green" | "violet"> = {
  none: "violet",
  submitted: "amber",
  under_review: "blue",
  approved: "green",
  revision_requested: "red",
};