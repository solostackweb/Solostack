"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Loader2, Trash2, CheckCircle2, MessageSquare,
  ThumbsUp, RotateCcw, ChevronDown, ChevronUp,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  createPortalUpdateAction,
  deletePortalUpdateAction,
  reactToPortalUpdateAction,
} from "../actions-updates";
import { portalClientHome } from "../routes";
import { sharePortalUpdateOnWhatsApp } from "@/lib/whatsapp";
import type {
  PortalUpdateRow,
  PortalUpdateReactionRow,
  PortalUpdateType,
  PortalUpdateApprovalStatus,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UpdateWithData = PortalUpdateRow & {
  author: { full_name: string | null; email: string | null } | null;
  reactions: Array<
    PortalUpdateReactionRow & {
      profile: { full_name: string | null; email: string | null } | null;
    }
  >;
};

interface UpdatesSectionProps {
  portalId: string;
  portalName: string;
  updates: UpdateWithData[];
  isOwner: boolean;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Label / color maps
// ---------------------------------------------------------------------------

const UPDATE_TYPE_LABELS: Record<PortalUpdateType, string> = {
  progress:    "Progress",
  deliverable: "Deliverable",
  revision:    "Revision",
  payment:     "Payment",
  milestone:   "Milestone",
  meeting:     "Meeting",
  general:     "Update",
};

// Left-border accent colour per update type — the visual differentiator
const UPDATE_TYPE_BORDER: Record<PortalUpdateType, string> = {
  progress:    "border-l-blue-500",
  deliverable: "border-l-violet-500",
  revision:    "border-l-amber-500",
  payment:     "border-l-emerald-500",
  milestone:   "border-l-orange-500",
  meeting:     "border-l-sky-500",
  general:     "border-l-border",
};

const UPDATE_TYPE_BADGE: Record<PortalUpdateType, string> = {
  progress:    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  deliverable: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  revision:    "bg-warning-subtle text-warning-strong",
  payment:     "bg-success-subtle text-success-strong",
  milestone:   "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  meeting:     "bg-info-subtle text-info-strong",
  general:     "bg-muted text-muted-foreground",
};

const APPROVAL_LABELS: Record<PortalUpdateApprovalStatus, string> = {
  none:                "",
  submitted:           "Pending review",
  under_review:        "Under review",
  approved:            "Approved",
  revision_requested:  "Revision requested",
};

const APPROVAL_BADGE: Record<PortalUpdateApprovalStatus, string> = {
  none:               "",
  submitted:          "bg-warning-subtle text-warning-strong",
  under_review:       "bg-info-subtle text-info-strong",
  approved:           "bg-success-subtle text-success-strong",
  revision_requested: "bg-destructive-subtle text-destructive-strong",
};

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------

export function UpdatesSection({
  portalId, portalName, updates, isOwner, currentUserId,
}: UpdatesSectionProps) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

  const visible = showAll ? updates : updates.slice(0, 5);
  const hasMore = updates.length > 5;

  return (
    <Card id="portal-updates" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Updates
          {updates.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-micro font-semibold text-primary">
              {updates.length}
            </span>
          )}
        </CardTitle>
        {isOwner && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Post update
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {updates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <TrendingUp className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "Post updates to keep your client informed."
                : "No updates yet — check back soon."}
            </p>
            {isOwner && (
              <p className="text-xs text-muted-foreground/70">
                Share progress, milestones, deliverables, and revision notes here.
              </p>
            )}
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {visible.map((update) => (
                <UpdateCard
                  key={update.id}
                  update={update}
                  portalId={portalId}
                  portalName={portalName}
                  isOwner={isOwner}
                  currentUserId={currentUserId}
                />
              ))}
            </ul>
            {hasMore && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 py-1 text-micro font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? (
                  <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5" /> Show {updates.length - 5} older updates</>
                )}
              </button>
            )}
          </>
        )}
      </CardContent>

      <CreateUpdateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        portalId={portalId}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Single update card
// ---------------------------------------------------------------------------

function UpdateCard({
  update, portalId, portalName, isOwner, currentUserId,
}: {
  update: UpdateWithData;
  portalId: string;
  portalName: string;
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [commentOpen, setCommentOpen] = React.useState(false);
  const [commentBody, setCommentBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasAcknowledged = update.reactions.some(
    (r) => r.user_id === currentUserId && r.kind === "acknowledged",
  );
  const hasApproved = update.reactions.some(
    (r) => r.user_id === currentUserId && r.kind === "approved",
  );
  const hasRevisionRequested = update.reactions.some(
    (r) => r.user_id === currentUserId && r.kind === "revision_requested",
  );
  const comments = update.reactions.filter((r) => r.kind === "comment");

  const isDeliverable = update.update_type === "deliverable";
  const showApprovalActions = !isOwner && isDeliverable &&
    update.approval_status !== "approved";

  async function react(kind: "acknowledged" | "approved" | "revision_requested") {
    setPending(true);
    setError(null);
    const res = await reactToPortalUpdateAction({ portalId, updateId: update.id, kind });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || pending) return;
    setPending(true);
    setError(null);
    const res = await reactToPortalUpdateAction({
      portalId, updateId: update.id, kind: "comment", body: commentBody.trim(),
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setCommentBody("");
    setCommentOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete this update?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await deletePortalUpdateAction({ portalId, updateId: update.id });
    router.refresh();
  }

  const borderClass = UPDATE_TYPE_BORDER[update.update_type] ?? "border-l-border";

  return (
    <li className={`rounded-lg border border-l-4 bg-card p-4 space-y-3 ${borderClass}`}>
      {/* Header row: badges + timestamp + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-micro font-semibold ${UPDATE_TYPE_BADGE[update.update_type]}`}>
            {UPDATE_TYPE_LABELS[update.update_type]}
          </span>
          {update.approval_status !== "none" && APPROVAL_LABELS[update.approval_status] && (
            <span className={`inline-flex items-center rounded-lg px-1.5 py-0.5 text-micro font-semibold ${APPROVAL_BADGE[update.approval_status]}`}>
              {APPROVAL_LABELS[update.approval_status]}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <time
            dateTime={update.created_at}
            className="text-xs tabular-nums text-muted-foreground"
          >
            {formatRelativeDate(update.created_at)}
          </time>
          {isOwner && (
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              onClick={handleDelete}
              aria-label="Delete update"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <p className="text-sm font-semibold leading-snug">{update.title}</p>
        {update.body && (
          <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {update.body}
          </p>
        )}
        <p className="text-micro text-muted-foreground">
          by{" "}
          <span className="font-medium text-foreground">
            {update.author?.full_name ?? update.author?.email ?? "Freelancer"}
          </span>
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Comments thread */}
      {comments.length > 0 && (
        <ul className="space-y-1.5 border-t pt-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2 text-xs">
              <span className="shrink-0 font-semibold text-foreground">
                {c.profile?.full_name ?? c.profile?.email ?? "User"}
              </span>
              <span className="text-muted-foreground leading-relaxed">{c.body}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {!isOwner && !hasAcknowledged && update.approval_status !== "approved" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            disabled={pending}
            onClick={() => react("acknowledged")}
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Acknowledge
          </Button>
        )}
        {!isOwner && hasAcknowledged && update.approval_status !== "approved" && (
          <span className="inline-flex items-center gap-1 text-micro font-medium text-success-strong">
            <CheckCircle2 className="h-3 w-3" /> Acknowledged
          </span>
        )}

        {/* Approve / Request revision (deliverable, client) */}
        {showApprovalActions && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs border-success-subtle text-success-strong hover:bg-success-subtle"
              disabled={pending || hasApproved}
              onClick={() => react("approved")}
            >
              <ThumbsUp className="h-3 w-3" />
              {hasApproved ? "Approved" : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs border-warning-subtle text-warning-strong hover:bg-warning-subtle"
              disabled={pending || hasRevisionRequested}
              onClick={() => react("revision_requested")}
            >
              <RotateCcw className="h-3 w-3" />
              {hasRevisionRequested ? "Revision requested" : "Request revision"}
            </Button>
          </>
        )}
        {!isOwner && hasApproved && (
          <span className="inline-flex items-center gap-1 text-micro font-medium text-success-strong">
            <ThumbsUp className="h-3 w-3" /> Approved
          </span>
        )}

        {/* Comment */}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setCommentOpen((v) => !v)}
        >
          <MessageSquare className="h-3 w-3" />
          {commentOpen ? "Cancel" : comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Comment"}
        </button>

        {/* WhatsApp share — owner only */}
        {isOwner && (
          <button
            type="button"
            aria-label="Share via WhatsApp"
            title="Share via WhatsApp"
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-[#25D366]"
            onClick={() => {
              const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${portalClientHome(portalId)}#portal-updates`;
              sharePortalUpdateOnWhatsApp({
                portalName,
                updateTitle: update.title,
                updateType: update.update_type,
                portalUrl,
                senderName: update.author?.full_name ?? undefined,
              });
            }}
          >
            <WhatsAppIcon className="h-3 w-3" />
            Share
          </button>
        )}
      </div>

      {/* Inline comment box */}
      {commentOpen && (
        <form onSubmit={submitComment} className="space-y-2 border-t pt-3">
          <Textarea
            placeholder="Add a comment or clarification…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={2}
            maxLength={4000}
            required
            className="text-xs"
            aria-label="Comment"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setCommentOpen(false); setCommentBody(""); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs"
              disabled={pending || !commentBody.trim()}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create update dialog
// ---------------------------------------------------------------------------

function CreateUpdateDialog({
  open, onOpenChange, portalId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  portalId: string;
}) {
  const router = useRouter();
  const [type, setType] = React.useState<PortalUpdateType>("progress");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setType("progress"); setTitle(""); setBody(""); setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !title.trim()) return;
    setPending(true);
    setError(null);
    const res = await createPortalUpdateAction({
      portalId,
      updateType: type,
      title: title.trim(),
      body: body.trim() || undefined,
    });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    reset();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}
      className="sm:max-w-md"
      title="Post an update"
      description="Keep your client informed with structured, typed updates."
    >
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Update type</Label>
            <Select value={type} onValueChange={(v) => setType(v as PortalUpdateType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="progress">🔵 Progress update</SelectItem>
                <SelectItem value="deliverable">🟣 Deliverable shared</SelectItem>
                <SelectItem value="revision">🟡 Revision update</SelectItem>
                <SelectItem value="milestone">🟠 Milestone reached</SelectItem>
                <SelectItem value="payment">🟢 Payment update</SelectItem>
                <SelectItem value="meeting">🔷 Meeting summary</SelectItem>
                <SelectItem value="general">⬜ General update</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="update-title" className="text-xs">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="update-title"
              placeholder="e.g. Homepage design completed"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="update-body" className="text-xs">Details (optional)</Label>
            <Textarea
              id="update-body"
              placeholder="Add context, links, or notes for your client…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={8000}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
          )}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !title.trim()}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post update"}
            </Button>
          </div>
        </form>
    </ResponsiveModal>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp icon (inline SVG — no extra dependency)
// ---------------------------------------------------------------------------

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(iso: string): string {
  const diff  = Date.now() - Date.parse(iso);
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
