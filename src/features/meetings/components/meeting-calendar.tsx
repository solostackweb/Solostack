"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Meeting, MeetingStatus } from "../types";

/**
 * Month calendar of booked calls.
 *
 * Deliberately hand-rolled rather than pulling in a date library: the only
 * arithmetic needed is "which days are in this month grid", and a dependency
 * for that would cost more than it saves. Only meetings with a confirmed time
 * can appear — a proposed call has no date yet, so it lives on the board.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT: Record<MeetingStatus, string> = {
  proposed: "bg-amber-400",
  confirmed: "bg-emerald-500",
  cancelled: "bg-muted-foreground/40",
  completed: "bg-primary/60",
};

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** The 6×7 grid covering a month, padded with neighbouring days. */
function buildGrid(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  // getDay() is Sunday-first; shift so Monday starts the week.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - lead);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function MeetingCalendar({
  meetings,
  selectedDate,
  onSelectDate,
  onOpenMeeting,
}: {
  meetings: Meeting[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  onOpenMeeting: (id: string) => void;
}) {
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = React.useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Scheduled meetings bucketed by local calendar day.
  const byDay = React.useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings) {
      if (!meeting.scheduledAt) continue;
      const date = new Date(meeting.scheduledAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = startOfDay(date).toDateString();
      const list = map.get(key) ?? [];
      list.push(meeting);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduledAt ?? 0).getTime() -
          new Date(b.scheduledAt ?? 0).getTime(),
      );
    }
    return map;
  }, [meetings]);

  const grid = React.useMemo(() => buildGrid(view), [view]);
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(view);

  const shiftMonth = (delta: number) =>
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const dayMeetings = selectedDate
    ? (byDay.get(startOfDay(selectedDate).toDateString()) ?? [])
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setView(new Date(today.getFullYear(), today.getMonth(), 1));
              onSelectDate(null);
            }}
            className="rounded-md border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {day.slice(0, 1)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const key = day.toDateString();
          const items = byDay.get(key) ?? [];
          const outside = day.getMonth() !== view.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = selectedDate ? sameDay(day, selectedDate) : false;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : day)}
              className={cn(
                "flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border border-transparent p-1 text-xs transition-colors",
                outside && "text-muted-foreground/40",
                !outside && "hover:border-border hover:bg-muted/60",
                isToday && "font-bold text-primary",
                isSelected && "border-primary bg-primary/10",
              )}
              aria-label={`${day.toDateString()}, ${items.length} meeting${
                items.length === 1 ? "" : "s"
              }`}
            >
              <span className="tabular-nums leading-none">{day.getDate()}</span>
              {items.length > 0 ? (
                <span className="flex flex-wrap justify-center gap-0.5">
                  {items.slice(0, 3).map((meeting) => (
                    <span
                      key={meeting.id}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        DOT[meeting.status],
                      )}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Day detail — only rendered when a day is actually chosen, so the
          calendar doesn't reserve empty space for it. */}
      {selectedDate ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold">
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(selectedDate)}
          </p>
          {dayMeetings.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing scheduled this day.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dayMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => onOpenMeeting(meeting.id)}
                    className="flex w-full items-center gap-2 rounded-md bg-background p-2 text-left text-xs transition-colors hover:bg-background/60"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        DOT[meeting.status],
                      )}
                    />
                    <span className="shrink-0 font-semibold tabular-nums">
                      {meeting.scheduledAt ? timeLabel(meeting.scheduledAt) : "—"}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {meeting.topic}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
