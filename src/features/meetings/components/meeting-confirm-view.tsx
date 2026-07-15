"use client";

import * as React from "react";
import { CalendarClock, CheckCircle2, Video } from "lucide-react";
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
  const [busy, setBusy] = React.useState(false);

  const pick = async (slot: string) => {
    setBusy(true);
    const res = await confirmMeetingSlotAction({ token, slot });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setConfirmedAt(slot);
    toast.success(res.message ?? "Your time is confirmed.");
  };

  const lightVars = {
    "--background": "0 0% 100%",
    "--foreground": "222 47% 11%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 47% 11%",
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
        className="px-5 pb-12 pt-12 text-white sm:px-10 sm:pt-16"
        style={{ background: "linear-gradient(135deg, #2563EB, #0F172A)" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
          <CalendarClock className="h-3.5 w-3.5" />
          Schedule a call
        </div>
        <h1 className="mx-auto mt-3 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {meeting.topic}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base opacity-90">
          with {hostName} · {meeting.durationMinutes} minutes
        </p>
      </header>

      <main className="mx-auto max-w-xl px-5 py-10 sm:px-10">
        <article className="space-y-5 rounded-xl border bg-white p-6 shadow-sm sm:p-8">
          {cancelled ? (
            <p className="text-sm text-slate-600">
              This meeting has been cancelled. Please reach out to {hostName} to
              reschedule.
            </p>
          ) : confirmedAt ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">You&apos;re booked</span>
              </div>
              <p className="text-sm text-slate-700">
                {formatSlot(confirmedAt)}
              </p>
              {meeting.meetLink ? (
                <a
                  href={meeting.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  <Video className="h-4 w-4" /> Join the call
                </a>
              ) : (
                <p className="text-xs text-slate-500">
                  {hostName} will share the video link before the call.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Pick a time that works for you:
              </p>
              <div className="space-y-2">
                {meeting.proposedSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => pick(slot)}
                    disabled={busy}
                    className="flex w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
                  >
                    {formatSlot(slot)}
                    <span className="text-xs font-normal text-slate-400">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {meeting.notes ? (
            <div className="border-t pt-4 text-sm leading-relaxed text-slate-600">
              {meeting.notes}
            </div>
          ) : null}
        </article>

        <p className="mt-6 text-center text-xs text-slate-500">
          Sent via Stackivo · This page is private to you.
        </p>
      </main>
    </div>
  );
}
