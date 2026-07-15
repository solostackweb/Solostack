"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Copy,
  Plus,
  Settings2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MEETING_STATUS_LABEL, type Meeting } from "../types";
import { cancelMeetingAction, completeMeetingAction } from "../actions";

interface Connection {
  connected: boolean;
  email: string | null;
}

interface Settings {
  timezone: string;
  workingHours: Record<string, Array<[string, string]>>;
  bufferMinutes: number;
  minNoticeHours: number;
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

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

export function MeetingsHubView({
  meetings,
  connection,
  settings,
  googleConfigured,
}: {
  meetings: Meeting[];
  connection: Connection;
  settings: Settings;
  googleConfigured: boolean;
}) {
  const now = Date.now();
  const pending = meetings.filter((m) => m.status === "proposed");
  const upcoming = meetings
    .filter(
      (m) =>
        m.status === "confirmed" &&
        (!m.scheduledAt || new Date(m.scheduledAt).getTime() >= now),
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt ?? 0).getTime() -
        new Date(b.scheduledAt ?? 0).getTime(),
    );
  const past = meetings
    .filter(
      (m) =>
        m.status === "completed" ||
        m.status === "cancelled" ||
        (m.status === "confirmed" &&
          m.scheduledAt !== null &&
          new Date(m.scheduledAt).getTime() < now),
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledAt ?? b.createdAt).getTime() -
        new Date(a.scheduledAt ?? a.createdAt).getTime(),
    );
  const completedCount = meetings.filter(
    (m) => m.status === "completed",
  ).length;

  const enabledDays = Object.values(settings.workingHours).filter(
    (ranges) => Array.isArray(ranges) && ranges.length > 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Schedule client calls, track who still needs to pick a time, and manage your availability — all in one place."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/meetings/availability">
                <Settings2 className="h-4 w-4" /> Availability
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/meetings/new">
                <Plus className="h-4 w-4" /> Schedule a call
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Awaiting client" value={pending.length} tone="amber" />
        <Stat label="Upcoming" value={upcoming.length} tone="emerald" />
        <Stat label="Completed" value={completedCount} tone="primary" />
      </div>

      {/* Availability / calendar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {googleConfigured && connection.connected
                  ? "Live availability is on"
                  : "Availability"}
              </p>
              <p className="text-xs text-muted-foreground">
                {googleConfigured && connection.connected
                  ? `Google Calendar connected${connection.email ? ` · ${connection.email}` : ""}`
                  : googleConfigured
                    ? "Connect Google Calendar to let clients book your live open times."
                    : "Set your working hours; clients pick from the times you offer."}
                {" · "}
                {enabledDays} day{enabledDays === 1 ? "" : "s"}/week · {settings.bufferMinutes}m buffer ·{" "}
                {settings.minNoticeHours}h notice
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/meetings/availability">
              {googleConfigured && connection.connected
                ? "Manage"
                : "Set up"}
            </Link>
          </Button>
        </CardContent>
      </Card>

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
        <div className="space-y-6">
          <Section title="Awaiting client's pick" count={pending.length}>
            {pending.map((m) => (
              <MeetingCard key={m.id} meeting={m} variant="pending" />
            ))}
          </Section>
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.map((m) => (
              <MeetingCard key={m.id} meeting={m} variant="upcoming" />
            ))}
          </Section>
          <Section title="Past" count={past.length} muted>
            {past.map((m) => (
              <MeetingCard key={m.id} meeting={m} variant="past" />
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald" | "primary";
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "emerald"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-primary";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 text-3xl font-bold tabular-nums", toneClass)}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h2
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-[0.14em]",
          muted ? "text-muted-foreground/70" : "text-muted-foreground",
        )}
      >
        {title} · {count}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MeetingCard({
  meeting,
  variant,
}: {
  meeting: Meeting;
  variant: "pending" | "upcoming" | "past";
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

  const subtitle =
    meeting.status === "confirmed" && meeting.scheduledAt
      ? formatSlot(meeting.scheduledAt)
      : meeting.status === "proposed"
        ? `${meeting.proposedSlots.length || "Live"} ${
            meeting.mode === "availability"
              ? "availability"
              : meeting.proposedSlots.length === 1
                ? "option"
                : "options"
          }`
        : MEETING_STATUS_LABEL[meeting.status];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/meetings/${meeting.id}`}
              className="truncate text-sm font-semibold hover:underline"
            >
              {meeting.topic}
            </Link>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                STATUS_STYLE[meeting.status],
              )}
            >
              {MEETING_STATUS_LABEL[meeting.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle} · {meeting.durationMinutes} min
          </p>
        </div>

        <div className="flex items-center gap-2">
          {variant === "pending" ? (
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          ) : null}
          {variant === "upcoming" && meeting.meetLink ? (
            <Button asChild size="sm">
              <a href={meeting.meetLink} target="_blank" rel="noreferrer">
                <Video className="h-3.5 w-3.5" /> Join
              </a>
            </Button>
          ) : null}
          {variant === "upcoming" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => run(() => completeMeetingAction({ id: meeting.id }))}
              disabled={busy}
            >
              Done
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/dashboard/meetings/${meeting.id}`}>Open</Link>
          </Button>
          {variant !== "past" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => run(() => cancelMeetingAction({ id: meeting.id }))}
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
