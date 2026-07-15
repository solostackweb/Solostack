"use client";

import * as React from "react";
import { CheckCircle2, Video } from "lucide-react";
import { toast } from "sonner";

import { confirmMeetingSlotAction } from "../actions";
import { DailyEmbed, isEmbeddableRoom } from "./daily-embed";

interface PortalMeeting {
  id: string;
  topic: string;
  durationMinutes: number;
  proposedSlots: string[];
  scheduledAt: string | null;
  status: string;
  meetLink: string | null;
  publicToken: string;
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

/**
 * Client-portal section that mirrors the standalone booking experience: the
 * client picks a proposed time and joins the call — reusing the same confirm
 * action and Daily embed as the public /m/[token] page.
 */
export function PortalScheduledCalls({
  meetings,
}: {
  meetings: PortalMeeting[];
}) {
  if (meetings.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Scheduled calls</h2>
      <div className="space-y-3">
        {meetings.map((meeting) => (
          <PortalCallCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </section>
  );
}

function PortalCallCard({ meeting }: { meeting: PortalMeeting }) {
  const [confirmedAt, setConfirmedAt] = React.useState<string | null>(
    meeting.status === "confirmed" ? meeting.scheduledAt : null,
  );
  const [busy, setBusy] = React.useState(false);
  const [joined, setJoined] = React.useState(false);

  const pick = async (slot: string) => {
    setBusy(true);
    const res = await confirmMeetingSlotAction({
      token: meeting.publicToken,
      slot,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirmedAt(slot);
    toast.success(res.message ?? "Your time is confirmed.");
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">{meeting.topic}</p>
      <p className="text-xs text-muted-foreground">
        {meeting.durationMinutes} min
      </p>

      {confirmedAt ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            {formatSlot(confirmedAt)}
          </div>
          {meeting.meetLink ? (
            isEmbeddableRoom(meeting.meetLink) ? (
              joined ? (
                <DailyEmbed url={meeting.meetLink} title={meeting.topic} />
              ) : (
                <button
                  type="button"
                  onClick={() => setJoined(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Video className="h-4 w-4" /> Join call
                </button>
              )
            ) : (
              <a
                href={meeting.meetLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                <Video className="h-4 w-4" /> Join call
              </a>
            )
          ) : (
            <p className="text-xs text-muted-foreground">
              The video link will appear here before the call.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Pick a time that works for you:
          </p>
          {meeting.proposedSlots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => pick(slot)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2 text-left text-sm transition hover:border-primary disabled:opacity-60"
            >
              {formatSlot(slot)}
              <span className="text-xs text-muted-foreground">Select</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
