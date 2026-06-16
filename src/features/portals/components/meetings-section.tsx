"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Video, Plus, Loader2, CheckCircle2, XCircle,
  CalendarDays, Link2, ExternalLink, ChevronDown, ChevronUp,
  Clock, CalendarPlus, Rss, Check,
} from "lucide-react";
import { sharePortalMeetingOnWhatsApp } from "@/lib/whatsapp";
import { portalClientHome } from "../routes";
import { buildCalendarLinks } from "../calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  requestPortalMeetingAction,
  acceptPortalMeetingAction,
  declinePortalMeetingAction,
  completePortalMeetingAction,
  cancelPortalMeetingAction,
  getPortalCalendarFeedTokenAction,
} from "../actions-meetings";
import type { PortalMeetingRow, PortalMeetingStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MeetingWithData = PortalMeetingRow & {
  requester: { full_name: string | null; email: string | null } | null;
};

interface MeetingsSectionProps {
  portalId: string;
  portalName: string;
  meetings: MeetingWithData[];
  isOwner: boolean;
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  PortalMeetingStatus,
  { label: string; dot: string; badge: string }
> = {
  pending:   {
    label: "Awaiting confirmation",
    dot:   "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  accepted:  {
    label: "Confirmed",
    dot:   "bg-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  declined:  {
    label: "Declined",
    dot:   "bg-red-500",
    badge: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  completed: {
    label: "Completed",
    dot:   "bg-sky-500",
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  cancelled: {
    label: "Cancelled",
    dot:   "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  },
};

function StatusPill({ status }: { status: PortalMeetingStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diffMs   = Date.now() - Date.parse(iso);
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7)   return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Single meeting card
// ---------------------------------------------------------------------------

function MeetingCard({
  meeting, isOwner, currentUserId, portalId, portalName, onPatch,
}: {
  meeting: MeetingWithData;
  isOwner: boolean;
  currentUserId: string;
  portalId: string;
  portalName: string;
  onPatch: (id: string, patch: Partial<MeetingWithData>) => void;
}) {
  const router = useRouter();
  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const [meetLink, setMeetLink] = React.useState(meeting.meet_link ?? "");
  // Confirmed time is now a real date+time picker. We hold an ISO-ish
  // `datetime-local` value and format it to a readable string on submit.
  const [confirmedAt, setConfirmedAt] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState(30);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isRequester = meeting.requested_by === currentUserId;
  const isActive    = meeting.status === "pending" || meeting.status === "accepted";
  const isConfirmed = meeting.status === "accepted";
  const isDimmed    = meeting.status === "declined" || meeting.status === "cancelled";
  const requesterName =
    meeting.requester?.full_name ?? meeting.requester?.email ?? "Someone";

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    // Format the picked datetime into a friendly, human string for storage.
    const formattedTime = confirmedAt
      ? new Date(confirmedAt).toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : meeting.proposed_time ?? undefined;
    const res = await acceptPortalMeetingAction({
      portalId, meetingId: meeting.id,
      meetLink: meetLink.trim() || undefined,
      proposedTime: formattedTime || undefined,
      scheduledAt: confirmedAt ? new Date(confirmedAt).toISOString() : undefined,
      durationMinutes,
    });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not confirm."); return; }
    setAcceptOpen(false);
    onPatch(meeting.id, {
      status: "accepted",
      meet_link: meetLink.trim() || meeting.meet_link,
      proposed_time: formattedTime ?? meeting.proposed_time,
      scheduled_at: confirmedAt ? new Date(confirmedAt).toISOString() : meeting.scheduled_at,
    });
    router.refresh();
  }

  async function handleDecline() {
    setPending(true);
    const res = await declinePortalMeetingAction({ portalId, meetingId: meeting.id });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not decline."); return; }
    onPatch(meeting.id, { status: "declined" });
    router.refresh();
  }

  async function handleComplete() {
    setPending(true);
    const res = await completePortalMeetingAction({ portalId, meetingId: meeting.id });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not complete."); return; }
    onPatch(meeting.id, { status: "completed" });
    router.refresh();
  }

  async function handleCancel() {
    setPending(true);
    const res = await cancelPortalMeetingAction({ portalId, meetingId: meeting.id });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not cancel."); return; }
    onPatch(meeting.id, { status: "cancelled" });
    router.refresh();
  }

  return (
    <li
      className={`overflow-hidden rounded-lg border bg-card transition-opacity ${isDimmed ? "opacity-55" : ""}`}
    >
      {/* Coloured top stripe for confirmed meetings */}
      {isConfirmed && (
        <div className="h-0.5 w-full bg-emerald-500" />
      )}
      {meeting.status === "pending" && (
        <div className="h-0.5 w-full bg-amber-500" />
      )}

      <div className="p-4 space-y-3">
        {/* Topic + status */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-snug">{meeting.topic}</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={meeting.status as PortalMeetingStatus} />
              <span className="text-[11px] text-muted-foreground">
                by{" "}
                <span className="font-medium text-foreground">{requesterName}</span>
                {" · "}
                {relativeTime(meeting.created_at)}
              </span>
            </div>
          </div>

          {/* Primary CTA — Join button when confirmed */}
          {isConfirmed && meeting.meet_link && (
            <Button
              asChild
              size="sm"
              className="h-8 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <a href={meeting.meet_link} target="_blank" rel="noreferrer">
                <Video className="h-3.5 w-3.5" />
                Join
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>

        {/* Meeting details: time + link + notes */}
        {(meeting.proposed_time || meeting.meet_link || meeting.notes) && (
          <div className="space-y-1.5 rounded-md bg-muted/40 px-3 py-2.5">
            {meeting.proposed_time && (
              <div className="flex items-center gap-2 text-xs">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{meeting.proposed_time}</span>
              </div>
            )}
            {meeting.meet_link && (
              <div className="flex items-center gap-2 text-xs">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a
                  href={meeting.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline"
                >
                  {meeting.meet_link}
                </a>
              </div>
            )}
            {meeting.notes && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {meeting.notes}
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </p>
        )}

        {/* Actions */}
        {isActive && (
          <div className="flex flex-wrap gap-2 pt-1">
            {/* Owner: Accept */}
            {isOwner && meeting.status === "pending" && (
              <Button
                size="sm"
                className="h-8"
                onClick={() => { setError(null); setAcceptOpen(true); }}
                disabled={pending}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm
              </Button>
            )}
            {/* Owner: Decline */}
            {isOwner && meeting.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDecline}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Decline
              </Button>
            )}
            {/* Owner: Edit link / time of a confirmed meeting */}
            {isOwner && meeting.status === "accepted" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => { setError(null); setAcceptOpen(true); }}
                disabled={pending}
              >
                <Link2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
            {/* Owner: Mark completed */}
            {isOwner && meeting.status === "accepted" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleComplete}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark completed
              </Button>
            )}
            {/* Requester or owner: Cancel */}
            {(isRequester || isOwner) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-muted-foreground"
                onClick={handleCancel}
                disabled={pending}
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Cancel
              </Button>
            )}

            {/* Add to calendar — confirmed meetings with a real scheduled time */}
            {isConfirmed && meeting.scheduled_at && (
              <div className="ml-auto">
                <AddToCalendarMenu meeting={meeting} portalId={portalId} />
              </div>
            )}

            {/* WhatsApp share — confirmed meetings with a link */}
            {isConfirmed && meeting.meet_link && (
              <button
                type="button"
                aria-label="Share meeting via WhatsApp"
                title="Share via WhatsApp"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-[#25D366]"
                onClick={() => {
                  const portalUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${portalClientHome(portalId)}#portal-meetings`;
                  sharePortalMeetingOnWhatsApp({
                    portalName,
                    topic: meeting.topic,
                    proposedTime: meeting.proposed_time ?? undefined,
                    meetLink: meeting.meet_link ?? undefined,
                    portalUrl,
                  });
                }}
              >
                <WhatsAppIcon className="h-3 w-3" />
                Share
              </button>
            )}
          </div>
        )}
      </div>

      {/* Accept / confirm dialog */}
      <Dialog
        open={acceptOpen}
        onOpenChange={(next) => { setAcceptOpen(next); if (!next) setError(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {meeting.status === "accepted" ? "Edit meeting" : "Confirm meeting"}
            </DialogTitle>
            <DialogDescription>
              Set a date and time, and add a video call link (Google Meet or Zoom).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="accept-time" className="text-xs">Confirmed date &amp; time</Label>
                <Input
                  id="accept-time"
                  type="datetime-local"
                  value={confirmedAt}
                  onChange={(e) => setConfirmedAt(e.target.value)}
                />
                {meeting.proposed_time && !confirmedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Client proposed: {meeting.proposed_time}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accept-duration" className="text-xs">Duration</Label>
                <select
                  id="accept-duration"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accept-link" className="text-xs">
                Video call link
              </Label>
              <Input
                id="accept-link"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
              />
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Create a new Google Meet
              </a>
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAcceptOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  <Loader2 className="animate-spin" />
                ) : meeting.status === "accepted" ? (
                  "Save changes"
                ) : (
                  "Confirm meeting"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add-to-calendar menu (per confirmed meeting)
// ---------------------------------------------------------------------------

function AddToCalendarMenu({
  meeting, portalId,
}: {
  meeting: MeetingWithData;
  portalId: string;
}) {
  if (!meeting.scheduled_at) return null;
  const icsHref = `/api/portals/${portalId}/meetings/${meeting.id}/calendar.ics`;
  const links = buildCalendarLinks(
    {
      uid: meeting.id,
      title: meeting.topic,
      startIso: meeting.scheduled_at,
      durationMinutes: meeting.duration_minutes ?? 30,
      description: meeting.notes,
      url: meeting.meet_link,
      location: meeting.meet_link,
    },
    icsHref,
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <CalendarPlus className="h-3 w-3" />
          Add to calendar
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <a href={links.google} target="_blank" rel="noreferrer">Google Calendar</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.outlook} target="_blank" rel="noreferrer">Outlook</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={links.ics} download>Apple / .ics file</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Subscribe-to-calendar button (whole portal feed)
// ---------------------------------------------------------------------------

function SubscribeCalendarButton({ portalId }: { portalId: string }) {
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function onSubscribe() {
    setPending(true);
    const res = await getPortalCalendarFeedTokenAction({ portalId });
    setPending(false);
    if (!res.ok || !res.data) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const httpUrl = `${origin}/api/portals/${portalId}/calendar.ics?key=${res.data.token}`;
    const webcalUrl = httpUrl.replace(/^https?:\/\//, "webcal://");
    try {
      await navigator.clipboard.writeText(webcalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.open(webcalUrl, "_blank");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 text-xs"
      onClick={onSubscribe}
      disabled={pending}
      title="Subscribe in your calendar app — future meetings sync automatically"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Rss className="h-3.5 w-3.5" />
      )}
      {copied ? "Link copied" : "Subscribe"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Request meeting dialog
// ---------------------------------------------------------------------------

function RequestMeetingDialog({
  portalId,
  currentUserId,
  onCreated,
}: {
  portalId: string;
  currentUserId: string;
  onCreated: (meeting: MeetingWithData) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [topic, setTopic] = React.useState("");
  const [time, setTime] = React.useState("");
  const [link, setLink] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setTopic(""); setTime(""); setLink(""); setNotes(""); setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setPending(true);
    setError(null);
    const formattedTime = time
      ? new Date(time).toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : undefined;
    const res = await requestPortalMeetingAction({
      portalId,
      topic: topic.trim(),
      proposedTime: formattedTime,
      meetLink: link.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setPending(false);
    if (!res.ok) { setError(res.error ?? "Could not request meeting."); return; }
    onCreated({
      id: res.data?.meetingId ?? `optimistic-${Date.now()}`,
      portal_id: portalId,
      requested_by: currentUserId,
      topic: topic.trim(),
      proposed_time: formattedTime ?? null,
      meet_link: link.trim() || null,
      notes: notes.trim() || null,
      status: "pending",
      scheduled_at: null,
      duration_minutes: 30,
      timezone: "Asia/Kolkata",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      requester: null,
    });
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => { reset(); setOpen(true); }}
      >
        <Plus className="h-3.5 w-3.5" />
        Request meeting
      </Button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a meeting</DialogTitle>
            <DialogDescription>
              Propose a topic and time. The other party will confirm or suggest a change.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="req-topic" className="text-xs">
                Topic <span className="text-destructive">*</span>
              </Label>
              <Input
                id="req-topic"
                placeholder="Design review, project kickoff…"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-time" className="text-xs">
                Proposed time{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="req-time"
                type="datetime-local"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-link" className="text-xs">
                Google Meet link{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="req-link"
                placeholder="https://meet.google.com/xxx-xxxx-xxx"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                maxLength={500}
              />
              <a
                href="https://meet.google.com/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
                Create a new Google Meet
              </a>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="req-notes" className="text-xs">
                Notes{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="req-notes"
                placeholder="Agenda items, questions to cover…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={4000}
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !topic.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main section export
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WhatsApp icon (inline SVG)
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

export function MeetingsSection({
  portalId, portalName, meetings: meetingsProp, isOwner, currentUserId,
}: MeetingsSectionProps) {
  const [showHistory, setShowHistory] = React.useState(false);
  // Local copy so create/confirm/decline/etc. reflect instantly; re-synced from props.
  const [meetings, setMeetings] = React.useState(meetingsProp);
  React.useEffect(() => setMeetings(meetingsProp), [meetingsProp]);

  const patchMeeting = React.useCallback(
    (id: string, patch: Partial<MeetingWithData>) =>
      setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    [],
  );
  const addMeeting = React.useCallback(
    (m: MeetingWithData) => setMeetings((prev) => [m, ...prev]),
    [],
  );

  const active  = meetings.filter((m) => m.status === "pending" || m.status === "accepted");
  const history = meetings.filter(
    (m) => m.status === "declined" || m.status === "completed" || m.status === "cancelled",
  );

  // Next confirmed meeting (for the quick glance pill)
  const nextMeeting = active.find((m) => m.status === "accepted") ?? active[0];

  return (
    <Card id="portal-meetings" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Video className="h-4 w-4 text-muted-foreground" />
          Meetings
          {active.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              {active.length}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          <SubscribeCalendarButton portalId={portalId} />
          <RequestMeetingDialog
            portalId={portalId}
            currentUserId={currentUserId}
            onCreated={addMeeting}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Quick-glance strip for the next confirmed meeting */}
        {nextMeeting?.status === "accepted" && nextMeeting.proposed_time && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Next: {nextMeeting.proposed_time}
              </p>
              <p className="text-[11px] text-muted-foreground">{nextMeeting.topic}</p>
            </div>
            {nextMeeting.meet_link && (
              <Button asChild size="sm" className="ml-auto h-7 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700">
                <a href={nextMeeting.meet_link} target="_blank" rel="noreferrer">
                  <Video className="h-3 w-3" />
                  Join
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Active meetings */}
        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <Video className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            <p className="text-xs text-muted-foreground/70">
              {isOwner
                ? "Request a meeting or wait for your client to propose a time."
                : "Use the button above to request a meeting."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {active.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                isOwner={isOwner}
                currentUserId={currentUserId}
                portalId={portalId}
                portalName={portalName}
                onPatch={patchMeeting}
              />
            ))}
          </ul>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showHistory ? "Hide" : "Show"} past meetings ({history.length})
            </button>
            {showHistory && (
              <ul className="mt-2.5 space-y-2.5">
                {history.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    isOwner={isOwner}
                    currentUserId={currentUserId}
                    portalId={portalId}
                    portalName={portalName}
                    onPatch={patchMeeting}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
