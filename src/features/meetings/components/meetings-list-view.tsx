"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Check,
  Copy,
  Plus,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MEETING_STATUS_LABEL, type Meeting } from "../types";
import {
  cancelMeetingAction,
  completeMeetingAction,
  setMeetingLinkAction,
} from "../actions";

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

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

export function MeetingsListView({ meetings }: { meetings: Meeting[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Schedule calls, share a link so clients pick a time, and keep everything in one place."
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/meetings/new">
              <Plus className="h-4 w-4" /> Schedule a call
            </Link>
          </Button>
        }
      />

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
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [meetLink, setMeetLink] = React.useState(meeting.meetLink ?? "");

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${meeting.publicToken}`
      : `/m/${meeting.publicToken}`;

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const run = async (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Something went wrong.");
      return;
    }
    if (res.message) toast.success(res.message);
    router.refresh();
  };

  const active = meeting.status === "proposed" || meeting.status === "confirmed";

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{meeting.topic}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meeting.status === "confirmed" && meeting.scheduledAt
                ? formatSlot(meeting.scheduledAt)
                : meeting.status === "proposed"
                  ? `Awaiting client's pick · ${meeting.proposedSlots.length} option${meeting.proposedSlots.length === 1 ? "" : "s"}`
                  : MEETING_STATUS_LABEL[meeting.status]}
              {" · "}
              {meeting.durationMinutes} min
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              STATUS_STYLE[meeting.status],
            )}
          >
            {MEETING_STATUS_LABEL[meeting.status]}
          </span>
        </div>

        {active ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy client link"}
            </Button>
            {meeting.status === "confirmed" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    run(() =>
                      setMeetingLinkAction({ id: meeting.id, meetLink }),
                    )
                  }
                  disabled={busy}
                >
                  <Video className="h-3.5 w-3.5" /> Save video link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(() => completeMeetingAction({ id: meeting.id }))
                  }
                  disabled={busy}
                >
                  Mark done
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => run(() => cancelMeetingAction({ id: meeting.id }))}
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        ) : null}

        {meeting.status === "confirmed" ? (
          <Input
            value={meetLink}
            onChange={(event) => setMeetLink(event.target.value)}
            placeholder="Paste your Google Meet / Zoom link (in-app video coming)"
            className="text-xs"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
