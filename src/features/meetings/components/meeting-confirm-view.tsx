"use client";

import * as React from "react";
import { CalendarClock, Check, Clock, Video } from "lucide-react";
import { toast } from "sonner";

import { confirmMeetingSlotAction } from "../actions";
import { DailyEmbed, isEmbeddableRoom } from "./daily-embed";

interface PublicMeeting {
  topic: string;
  notes: string | null;
  durationMinutes: number;
  proposedSlots: string[];
  scheduledAt: string | null;
  status: string;
  meetLink: string | null;
}

function fmtFull(iso: string): string {
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

function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "S"
  );
}

export function MeetingConfirmView({
  token,
  hostName,
  meeting,
}: {
  token: string;
  hostName: string;
  meeting: PublicMeeting;
}) {
  const [confirmedAt, setConfirmedAt] = React.useState<string | null>(
    meeting.status === "confirmed" ? meeting.scheduledAt : null,
  );
  const [meetLink, setMeetLink] = React.useState<string | null>(
    meeting.meetLink,
  );
  const [busy, setBusy] = React.useState(false);
  const [joined, setJoined] = React.useState(false);
  const [pendingSlot, setPendingSlot] = React.useState<string | null>(null);

  const grouped = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of meeting.proposedSlots) {
      const key = fmtDay(slot);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [meeting.proposedSlots]);

  const pick = async (slot: string) => {
    setBusy(true);
    setPendingSlot(slot);
    const res = await confirmMeetingSlotAction({ token, slot });
    setBusy(false);
    setPendingSlot(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirmedAt(slot);
    setMeetLink(res.data?.meetLink ?? null);
    toast.success(res.message ?? "Your time is confirmed.");
  };

  const lightVars = {
    "--background": "0 0% 100%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--muted": "210 40% 96%",
    "--muted-foreground": "215 16% 47%",
    "--primary": "224 76% 40%",
    "--primary-foreground": "0 0% 100%",
    "--border": "214 32% 91%",
    colorScheme: "light",
  } as React.CSSProperties;

  const cancelled = meeting.status === "cancelled";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={lightVars}>
      <header
        className="px-5 pb-14 pt-12 text-white sm:px-10 sm:pt-16"
        style={{ background: "linear-gradient(135deg, #2563EB, #0F172A)" }}
      >
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
            <CalendarClock className="h-3.5 w-3.5" />
            Book a call
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold backdrop-blur">
              {initials(hostName)}
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {meeting.topic}
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-sm opacity-90">
                <span>with {hostName}</span>
                <span className="opacity-60">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {meeting.durationMinutes} min
                </span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-xl px-5 pb-12 sm:px-10">
        <article className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          {cancelled ? (
            <p className="text-sm text-slate-600">
              This meeting has been cancelled. Please reach out to {hostName} to
              reschedule.
            </p>
          ) : confirmedAt ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  You&apos;re booked
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {fmtFull(confirmedAt)}
                </p>
              </div>
              {meetLink ? (
                isEmbeddableRoom(meetLink) ? (
                  joined ? (
                    <DailyEmbed url={meetLink} title={meeting.topic} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setJoined(true)}
                      className="mx-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      <Video className="h-4 w-4" /> Join the call
                    </button>
                  )
                ) : (
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mx-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Video className="h-4 w-4" /> Join the call
                  </a>
                )
              ) : (
                <p className="text-xs text-slate-500">
                  {hostName} will share the video link before the call. A
                  calendar invite is on its way to your inbox.
                </p>
              )}
            </div>
          ) : meeting.proposedSlots.length === 0 ? (
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium text-slate-700">
                No open times right now
              </p>
              <p className="text-sm text-slate-500">
                Please check back shortly, or reach out to {hostName} directly.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm font-medium text-slate-700">
                Pick a time that works for you
              </p>
              {grouped.map(([day, slots]) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {day}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => pick(slot)}
                        disabled={busy}
                        className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {pendingSlot === slot ? "Booking…" : fmtTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                Times are shown in your local timezone.
              </p>
            </div>
          )}

          {meeting.notes && !confirmedAt ? (
            <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-600">
              {meeting.notes}
            </div>
          ) : null}
        </article>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by Stackivo · This page is private to you.
        </p>
      </main>
    </div>
  );
}
