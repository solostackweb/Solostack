"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, Video, X } from "lucide-react";
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
import { enableMeetingVideoAction } from "../video-actions";
import { DailyEmbed, isEmbeddableRoom } from "./daily-embed";

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
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

export function MeetingDetailView({
  meeting,
  dailyConfigured,
}: {
  meeting: Meeting;
  dailyConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [meetLink, setMeetLink] = React.useState(meeting.meetLink ?? "");
  const [joining, setJoining] = React.useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${meeting.publicToken}`
      : `/m/${meeting.publicToken}`;
  const embeddable = isEmbeddableRoom(meeting.meetLink);

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
  ) => {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={meeting.topic}
        description={`${meeting.durationMinutes} minutes`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4" /> Meetings
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            STATUS_STYLE[meeting.status],
          )}
        >
          {MEETING_STATUS_LABEL[meeting.status]}
        </span>
        {meeting.status === "confirmed" && meeting.scheduledAt ? (
          <span className="text-sm text-muted-foreground">
            {formatSlot(meeting.scheduledAt)}
          </span>
        ) : null}
      </div>

      {/* Schedule + share */}
      <Card>
        <CardContent className="space-y-4 p-6">
          {meeting.status === "proposed" ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Proposed times
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {meeting.proposedSlots.map((slot) => (
                  <li key={slot}>{formatSlot(slot)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Client link
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Input readOnly value={shareUrl} className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {meeting.notes ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {meeting.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Video */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Video</h2>
          </div>

          {meeting.status !== "confirmed" ? (
            <p className="text-sm text-muted-foreground">
              Video options appear once your client confirms a time.
            </p>
          ) : embeddable ? (
            <div className="space-y-3">
              {joining ? (
                <DailyEmbed url={meeting.meetLink ?? ""} title={meeting.topic} />
              ) : (
                <Button type="button" onClick={() => setJoining(true)}>
                  <Video className="h-4 w-4" /> Join call
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                In-app video is on. Your client joins from the same link.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dailyConfigured ? (
                <Button
                  type="button"
                  onClick={() =>
                    run(() => enableMeetingVideoAction({ id: meeting.id }))
                  }
                  disabled={busy}
                >
                  <Video className="h-4 w-4" /> Turn on in-app video
                </Button>
              ) : null}
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Or paste your own Google Meet / Zoom link:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    value={meetLink}
                    onChange={(event) => setMeetLink(event.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      run(() =>
                        setMeetingLinkAction({ id: meeting.id, meetLink }),
                      )
                    }
                    disabled={busy}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      {meeting.status === "proposed" || meeting.status === "confirmed" ? (
        <div className="flex flex-wrap gap-2">
          {meeting.status === "confirmed" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => run(() => completeMeetingAction({ id: meeting.id }))}
              disabled={busy}
            >
              <Check className="h-4 w-4" /> Mark done
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => run(() => cancelMeetingAction({ id: meeting.id }))}
            disabled={busy}
          >
            <X className="h-4 w-4" /> Cancel meeting
          </Button>
        </div>
      ) : null}
    </div>
  );
}
