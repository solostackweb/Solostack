"use client";

import * as React from "react";
import { CalendarClock, Check, Clock, Video } from "lucide-react";
import { toast } from "sonner";

import { confirmMeetingSlotAction } from "../actions";

interface PublicMeeting {
  topic: string;
  notes: string | null;
  durationMinutes: number;
  proposedSlots: string[];
  scheduledAt: string | null;
  status: string;
  meetLink: string | null;
}

const JOIN_OPEN_MIN = 15;
const JOIN_GRACE_MIN = 30;

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
  const [pendingSlot, setPendingSlot] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Booking across timezones is the single most common way these pages go
  // wrong, so name the zone the times are actually rendered in.
  const viewerTimezone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

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

  const startMs = confirmedAt ? new Date(confirmedAt).getTime() : null;
  const joinOpensMs = startMs !== null ? startMs - JOIN_OPEN_MIN * 60_000 : null;
  const joinClosesMs =
    startMs !== null
      ? startMs + meeting.durationMinutes * 60_000 + JOIN_GRACE_MIN * 60_000
      : null;
  const ended =
    (joinClosesMs !== null && now > joinClosesMs) ||
    meeting.status === "completed";
  const canJoin = joinOpensMs !== null && now >= joinOpensMs && !ended;
  const cancelled = meeting.status === "cancelled";
  const minutesToStart =
    startMs !== null ? Math.round((startMs - now) / 60_000) : null;

  return (
    <div
      className="relative min-h-screen bg-slate-50 text-slate-900"
      style={lightVars}
    >
      {/* Soft brand wash at the top of the canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background: "linear-gradient(to bottom, #2563EB14, transparent)",
        }}
      />

      <main className="relative mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Book a call
          </div>
          <div className="mt-4 flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {initials(hostName)}
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
                {meeting.topic}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                <span>
                  with{" "}
                  <span className="font-medium text-slate-700">{hostName}</span>
                </span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {meeting.durationMinutes} min
                </span>
              </p>
            </div>
          </div>
        </header>

        <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-12px_rgba(15,23,42,0.12)]">
          <div className="h-1.5 w-full bg-primary" />
          <div className="p-6 sm:p-8">
          {cancelled ? (
            <p className="text-center text-sm text-slate-600">
              This meeting has been cancelled. Please reach out to {hostName} to
              reschedule.
            </p>
          ) : confirmedAt && ended ? (
            <Centered
              title="This meeting has ended"
              body="Thanks for using Stackivo — you can safely close this tab."
            />
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

              {viewerTimezone ? (
                <p className="text-xs text-slate-400">{viewerTimezone}</p>
              ) : null}

              {canJoin ? (
                meetLink ? (
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mx-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <Video className="h-4 w-4" /> Join on Google Meet
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">
                    {hostName} will share the video link before the call.
                  </p>
                )
              ) : (
                <div className="space-y-2 rounded-lg bg-slate-50 px-4 py-3">
                  {minutesToStart !== null && minutesToStart > 0 ? (
                    <p className="text-sm font-semibold tabular-nums text-slate-700">
                      Starts in{" "}
                      {minutesToStart >= 1440
                        ? `${Math.round(minutesToStart / 1440)} day${
                            Math.round(minutesToStart / 1440) === 1 ? "" : "s"
                          }`
                        : minutesToStart >= 60
                          ? `${Math.round(minutesToStart / 60)} hour${
                              Math.round(minutesToStart / 60) === 1 ? "" : "s"
                            }`
                          : `${minutesToStart} minutes`}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500">
                    The Google Meet button appears {JOIN_OPEN_MIN} minutes
                    before the start — this page updates on its own. A calendar
                    invite is already in your inbox.
                  </p>
                </div>
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
            <div className="space-y-6">
              <p className="text-base font-semibold tracking-tight text-slate-900">
                Pick a time that works for you
              </p>
              {grouped.map(([day, slots]) => (
                <div key={day}>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {day}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => pick(slot)}
                        disabled={busy}
                        className="rounded-xl border px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm transition hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-50"
                      >
                        {pendingSlot === slot ? "Booking…" : fmtTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                Times shown in{" "}
                {viewerTimezone ? (
                  <span className="font-medium text-slate-500">
                    {viewerTimezone}
                  </span>
                ) : (
                  "your local timezone"
                )}
                .
              </p>
            </div>
          )}

          {meeting.notes && !confirmedAt ? (
            <div className="mt-5 border-t pt-4 text-sm leading-relaxed text-slate-600">
              {meeting.notes}
            </div>
          ) : null}
          </div>
        </article>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by Stackivo · This page is private to you.
        </p>
      </main>
    </div>
  );
}

function Centered({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone?: "emerald";
}) {
  return (
    <div className="space-y-3 text-center">
      <div
        className={
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full " +
          (tone === "emerald"
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-500")
        }
      >
        <Check className="h-6 w-6" />
      </div>
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="mx-auto max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}
