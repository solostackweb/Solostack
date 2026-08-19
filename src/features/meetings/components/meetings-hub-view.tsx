"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Copy,
  Link2,
  Plus,
  Settings2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";
import { MEETING_STATUS_LABEL, type Meeting, type MeetingStatus } from "../types";
import { cancelMeetingAction, completeMeetingAction } from "../actions";
import { MeetingCalendar } from "./meeting-calendar";

/**
 * Google connection state. Meetings run entirely on Google Calendar + Meet, so
 * this is a gate rather than a nicety: without it there is no availability to
 * offer and no link to join.
 */
export interface MeetingsCalendarState {
  configured: boolean;
  tokenStorageReady: boolean;
  connected: boolean;
  email: string | null;
}

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const STATUS_STYLE: Record<MeetingStatus, string> = {
  proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

type ColumnKey = "waiting" | "scheduled" | "wrapped";

const COLUMNS: Array<{
  key: ColumnKey;
  label: string;
  dot: string;
  count: string;
  empty: string;
}> = [
  {
    key: "waiting",
    label: "Waiting for client",
    dot: "bg-amber-400",
    count: "text-amber-600 dark:text-amber-400",
    empty: "No calls waiting on a client.",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    dot: "bg-emerald-400",
    count: "text-emerald-600 dark:text-emerald-400",
    empty: "Nothing scheduled yet.",
  },
  {
    key: "wrapped",
    label: "Wrapped up",
    dot: "bg-slate-400",
    count: "text-muted-foreground",
    empty: "Completed and cancelled calls land here.",
  },
];

function columnForStatus(status: MeetingStatus): ColumnKey {
  if (status === "proposed") return "waiting";
  if (status === "confirmed") return "scheduled";
  return "wrapped"; // completed | cancelled
}

export function MeetingsHubView({
  meetings,
  calendar,
}: {
  meetings: Meeting[];
  calendar: MeetingsCalendarState;
}) {
  const router = useRouter();
  // Optimistic status overrides so a completed card jumps columns instantly.
  const [override, setOverride] = React.useState<Record<string, MeetingStatus>>(
    {},
  );
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const draggingId = React.useRef<string | null>(null);
  const [overCol, setOverCol] = React.useState<ColumnKey | null>(null);

  // The OAuth flow returns here, so report its outcome here.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("connected") && !params.has("error")) return;
    if (params.get("connected")) {
      toast.success("Google Calendar connected.");
    } else if (params.get("error") === "not_configured") {
      toast.error("Google isn't set up on this deployment yet.");
    } else if (params.get("error") === "storage") {
      toast.error("Couldn't store the connection securely. Contact support.");
    } else {
      toast.error("Couldn't connect your calendar. Try again.");
    }
    window.history.replaceState({}, "", "/dashboard/meetings");
  }, []);

  const statusOf = React.useCallback(
    (m: Meeting): MeetingStatus => override[m.id] ?? m.status,
    [override],
  );

  const byColumn = React.useMemo(() => {
    const map: Record<ColumnKey, Meeting[]> = {
      waiting: [],
      scheduled: [],
      wrapped: [],
    };
    for (const m of meetings) map[columnForStatus(statusOf(m))].push(m);
    map.waiting.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    map.scheduled.sort(
      (a, b) =>
        new Date(a.scheduledAt ?? a.createdAt).getTime() -
        new Date(b.scheduledAt ?? b.createdAt).getTime(),
    );
    map.wrapped.sort(
      (a, b) =>
        new Date(b.scheduledAt ?? b.updatedAt).getTime() -
        new Date(a.scheduledAt ?? a.updatedAt).getTime(),
    );
    return map;
  }, [meetings, statusOf]);

  const markDone = React.useCallback(
    async (id: string) => {
      setOverride((p) => ({ ...p, [id]: "completed" }));
      const res = await completeMeetingAction({ id });
      if (!res.ok) {
        setOverride((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
        toast.error(res.error ?? "Could not update the call.");
        return;
      }
      toast.success("Marked as done.");
      router.refresh();
    },
    [router],
  );

  const handleDrop = (col: ColumnKey) => {
    const id = draggingId.current;
    draggingId.current = null;
    setOverCol(null);
    if (!id) return;
    const meeting = meetings.find((m) => m.id === id);
    // The only valid drag transition is a scheduled call → wrapped up.
    if (meeting && col === "wrapped" && statusOf(meeting) === "confirmed") {
      void markDone(id);
    }
  };

  // ---- Gate: no Google, no meetings ---------------------------------------
  if (!calendar.configured || !calendar.tokenStorageReady) {
    return (
      <div className="space-y-6">
        <Header calendar={calendar} gated />
        <GateCard
          title="Meetings aren't set up on this deployment"
          body="Scheduling runs on Google Calendar and Google Meet. The Google credentials are missing from this environment, so there's nothing to connect to yet."
        />
      </div>
    );
  }

  if (!calendar.connected) {
    return (
      <div className="space-y-6">
        <Header calendar={calendar} gated />
        <GateCard
          title="Connect Google Calendar to start scheduling"
          body="Clients book against your real free time, a calendar event is created for both of you, and every call gets a Google Meet link automatically."
          action={
            <Button asChild>
              <a href="/api/google/connect?next=/dashboard/meetings">
                <Link2 className="h-4 w-4" /> Connect Google Calendar
              </a>
            </Button>
          }
          footnote="Stackivo reads your busy times and creates events. It never reads the contents of your existing meetings."
        />
      </div>
    );
  }

  // ---- Connected: calendar + board ----------------------------------------
  return (
    <div className="space-y-5">
      <Header calendar={calendar} />

      <div className="grid gap-4 lg:grid-cols-[minmax(300px,340px)_1fr]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="p-4">
            <MeetingCalendar
              meetings={meetings}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onOpenMeeting={(id) => router.push(`/dashboard/meetings/${id}`)}
            />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-3">
          {meetings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No calls yet. Schedule one and share the link with your client.
                </p>
                <Button asChild size="sm">
                  <Link href="/dashboard/meetings/new">
                    <Plus className="h-4 w-4" /> Schedule a call
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {COLUMNS.map((col) => {
                  const items = byColumn[col.key];
                  const isTarget = col.key === "wrapped";
                  const isOver = overCol === col.key && isTarget;
                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => {
                        if (!isTarget) return;
                        e.preventDefault();
                        if (overCol !== col.key) setOverCol(col.key);
                      }}
                      onDragLeave={() =>
                        setOverCol((c) => (c === col.key ? null : c))
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(col.key);
                      }}
                      className={cn(
                        "flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 transition-colors",
                        isOver && "ring-2 ring-emerald-400/60",
                      )}
                    >
                      <div className="flex items-center gap-2 px-1">
                        <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                        <h2 className="text-sm font-semibold">{col.label}</h2>
                        <span
                          className={cn(
                            "ml-auto text-xs font-semibold tabular-nums",
                            col.count,
                          )}
                        >
                          {items.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {items.length === 0 ? (
                          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                            {col.empty}
                          </p>
                        ) : (
                          items.map((m) => (
                            <MeetingCard
                              key={m.id}
                              meeting={m}
                              status={statusOf(m)}
                              onMarkDone={() => markDone(m.id)}
                              onDragStart={() => {
                                draggingId.current = m.id;
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: drag a scheduled call into &ldquo;Wrapped up&rdquo; to mark
                it done.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GateCard({
  title,
  body,
  action,
  footnote,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  footnote?: string;
}) {
  return (
    <Card>
      <CardContent className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        {action}
        {footnote ? (
          <p className="text-xs text-muted-foreground">{footnote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Header({
  calendar,
  gated,
}: {
  calendar: MeetingsCalendarState;
  gated?: boolean;
}) {
  return (
    <PageHeader
      title="Meetings"
      description="Track every client call from request to wrap-up, on your own calendar."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {calendar.connected ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
              title={
                calendar.email
                  ? `Google Calendar connected as ${calendar.email}`
                  : "Google Calendar connected"
              }
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {calendar.email ?? "Calendar connected"}
            </span>
          ) : null}
          {gated ? null : (
            <>
              <IvoEntryPoint prompt="What meetings do I have coming up, and who still needs to pick a time?" />
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/meetings/availability">
                  <Settings2 className="h-4 w-4" /> Calendar &amp; availability
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/dashboard/meetings/new">
                  <Plus className="h-4 w-4" /> Schedule a call
                </Link>
              </Button>
            </>
          )}
        </div>
      }
    />
  );
}

function MeetingCard({
  meeting,
  status,
  onMarkDone,
  onDragStart,
}: {
  meeting: Meeting;
  status: MeetingStatus;
  onMarkDone: () => void;
  onDragStart: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${meeting.publicToken}`
      : `/m/${meeting.publicToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cancel = async () => {
    setBusy(true);
    const res = await cancelMeetingAction({ id: meeting.id });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not cancel the call.");
      return;
    }
    toast.success("Meeting cancelled.");
    router.refresh();
  };

  const draggable = status === "confirmed";
  const isCancelled = status === "cancelled";
  const pastDue =
    status === "confirmed" &&
    meeting.scheduledAt !== null &&
    new Date(meeting.scheduledAt).getTime() < Date.now();

  const subtitle =
    status === "confirmed" && meeting.scheduledAt
      ? formatSlot(meeting.scheduledAt)
      : status === "proposed"
        ? `${meeting.proposedSlots.length || "Live"} ${
            meeting.mode === "availability"
              ? "availability"
              : meeting.proposedSlots.length === 1
                ? "option"
                : "options"
          }`
        : status === "cancelled"
          ? "Cancelled"
          : meeting.scheduledAt
            ? formatSlot(meeting.scheduledAt)
            : "Completed";

  return (
    <Card
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      className={cn(
        "border",
        draggable && "cursor-grab active:cursor-grabbing",
        isCancelled && "opacity-60",
      )}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/dashboard/meetings/${meeting.id}`}
            className="truncate text-sm font-semibold hover:underline"
          >
            {meeting.topic}
          </Link>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              STATUS_STYLE[status],
            )}
          >
            {MEETING_STATUS_LABEL[status]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {subtitle} · {meeting.durationMinutes} min
          {pastDue ? " · ended" : ""}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {status === "proposed" ? (
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          ) : null}
          {status === "confirmed" && meeting.meetLink ? (
            <Button asChild size="sm">
              <a href={meeting.meetLink} target="_blank" rel="noreferrer">
                <Video className="h-3.5 w-3.5" /> Join
              </a>
            </Button>
          ) : null}
          {status === "confirmed" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onMarkDone}
            >
              <Check className="h-3.5 w-3.5" /> Mark done
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/dashboard/meetings/${meeting.id}`}>Open</Link>
          </Button>
          {status === "proposed" || status === "confirmed" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={cancel}
              disabled={busy}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
