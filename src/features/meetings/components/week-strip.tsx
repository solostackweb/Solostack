"use client";

import * as React from "react";
import { ArrowRight, CalendarDays, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Meeting } from "../types";

/**
 * A slim seven-day band above the board.
 *
 * Replaces a month grid that sat in a side column and cost the board a quarter
 * of the page. What a freelancer checks daily is "what's next and is today
 * busy" — that needs one row, not a 6×7 matrix. The month view still exists,
 * one click away, for the times you're actually planning ahead.
 */

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function relativeLabel(target: number, now: number): string {
  const diff = target - now;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (Math.abs(diff) < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (Math.abs(diff) < day) return rtf.format(Math.round(diff / hour), "hour");
  return rtf.format(Math.round(diff / day), "day");
}

export function WeekStrip({
  meetings,
  onOpenMonth,
  onOpenMeeting,
}: {
  meetings: Meeting[];
  onOpenMonth: () => void;
  onOpenMeeting: (id: string) => void;
}) {
  // Recomputed on mount only; a meetings board doesn't need second-accuracy.
  const [now] = React.useState(() => Date.now());
  const today = React.useMemo(() => startOfDay(new Date(now)), [now]);

  const days = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return date;
      }),
    [today],
  );

  const scheduled = React.useMemo(
    () =>
      meetings
        .filter((m) => m.status === "confirmed" && m.scheduledAt)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt ?? 0).getTime() -
            new Date(b.scheduledAt ?? 0).getTime(),
        ),
    [meetings],
  );

  const countFor = React.useCallback(
    (day: Date) =>
      scheduled.filter((m) =>
        m.scheduledAt
          ? startOfDay(new Date(m.scheduledAt)).getTime() === day.getTime()
          : false,
      ).length,
    [scheduled],
  );

  const next = scheduled.find(
    (m) => m.scheduledAt && new Date(m.scheduledAt).getTime() >= now,
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Next call — the single most useful fact on this page. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            next ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <CalendarDays className="h-4 w-4" />
        </div>
        {next && next.scheduledAt ? (
          <button
            type="button"
            onClick={() => onOpenMeeting(next.id)}
            className="min-w-0 text-left"
          >
            <p className="truncate text-sm font-semibold hover:underline">
              {next.topic}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeLabel(new Date(next.scheduledAt).getTime(), now)} ·{" "}
              {timeLabel(next.scheduledAt)}
            </p>
          </button>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold">No upcoming calls</p>
            <p className="text-xs text-muted-foreground">
              Your week is clear.
            </p>
          </div>
        )}
        {next?.meetLink ? (
          <Button asChild size="sm" variant="outline" className="ml-auto shrink-0 sm:ml-0">
            <a href={next.meetLink} target="_blank" rel="noreferrer">
              <Video className="h-3.5 w-3.5" /> Join
            </a>
          </Button>
        ) : null}
      </div>

      {/* Seven-day band. */}
      <div className="flex items-center gap-1 overflow-x-auto sm:gap-1.5">
        {days.map((day, index) => {
          const count = countFor(day);
          const isToday = index === 0;
          return (
            <div
              key={day.toDateString()}
              className={cn(
                "flex min-w-[44px] flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5",
                isToday && "border-primary/40 bg-primary/5",
                !isToday && count === 0 && "border-transparent",
              )}
              title={`${day.toDateString()} — ${count} call${
                count === 1 ? "" : "s"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, { weekday: "short" })
                  .format(day)
                  .slice(0, 2)}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums leading-none",
                  isToday && "text-primary",
                )}
              >
                {day.getDate()}
              </span>
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  count > 0 ? "bg-emerald-500" : "bg-transparent",
                )}
              />
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onOpenMonth}
        className="shrink-0 text-muted-foreground"
      >
        Month <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
