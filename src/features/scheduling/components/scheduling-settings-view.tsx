"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Copy,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  saveSchedulingSettingsAction,
  disconnectCalendarAction,
} from "../actions";

interface SchedulingSettings {
  timezone: string;
  workingHours: Record<string, Array<[string, string]>>;
  bufferMinutes: number;
  minNoticeHours: number;
  slotIntervalMinutes: number;
}

const WEEKDAYS: Array<{ key: string; label: string; short: string }> = [
  { key: "1", label: "Monday", short: "Mon" },
  { key: "2", label: "Tuesday", short: "Tue" },
  { key: "3", label: "Wednesday", short: "Wed" },
  { key: "4", label: "Thursday", short: "Thu" },
  { key: "5", label: "Friday", short: "Fri" },
  { key: "6", label: "Saturday", short: "Sat" },
  { key: "0", label: "Sunday", short: "Sun" },
];

interface DayRow {
  key: string;
  label: string;
  short: string;
  enabled: boolean;
  start: string;
  end: string;
}

export function SchedulingSettingsView({
  googleConfigured,
  connection,
  settings,
}: {
  googleConfigured: boolean;
  connection: { connected: boolean; email: string | null };
  settings: SchedulingSettings;
}) {
  const router = useRouter();
  const [timezone, setTimezone] = React.useState(settings.timezone);
  const [buffer, setBuffer] = React.useState(settings.bufferMinutes);
  const [notice, setNotice] = React.useState(settings.minNoticeHours);
  const [interval, setIntervalMinutes] = React.useState(
    settings.slotIntervalMinutes,
  );
  const [saving, setSaving] = React.useState(false);
  const [days, setDays] = React.useState<DayRow[]>(() =>
    WEEKDAYS.map((day) => {
      const range = settings.workingHours[day.key]?.[0];
      return {
        key: day.key,
        label: day.label,
        short: day.short,
        enabled: Boolean(range),
        start: range?.[0] ?? "09:00",
        end: range?.[1] ?? "17:00",
      };
    }),
  );

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) toast.success("Google Calendar connected.");
    const error = params.get("error");
    if (error === "not_configured")
      toast.error("Google isn't configured on this deployment yet.");
    else if (error === "storage")
      toast.error(
        "Can't store the connection securely — TOKEN_ENCRYPTION_KEY is missing.",
      );
    else if (error) toast.error("Couldn't connect your calendar. Try again.");
  }, []);

  const updateDay = (key: string, patch: Partial<DayRow>) =>
    setDays((prev) =>
      prev.map((day) => (day.key === key ? { ...day, ...patch } : day)),
    );

  /** Push one day's hours onto every other enabled day. */
  const copyToAll = (source: DayRow) =>
    setDays((prev) =>
      prev.map((day) =>
        day.enabled ? { ...day, start: source.start, end: source.end } : day,
      ),
    );

  const enabledCount = days.filter((day) => day.enabled).length;
  const weeklyHours = days.reduce((total, day) => {
    if (!day.enabled) return total;
    const [sh, sm] = day.start.split(":").map(Number);
    const [eh, em] = day.end.split(":").map(Number);
    const minutes = eh * 60 + em - (sh * 60 + sm);
    return total + Math.max(0, minutes);
  }, 0);

  const save = async () => {
    const invalid = days.find(
      (day) => day.enabled && day.start >= day.end,
    );
    if (invalid) {
      toast.error(`${invalid.label} ends before it starts.`);
      return;
    }

    const workingHours: Record<string, Array<[string, string]>> = {};
    for (const day of days) {
      if (day.enabled) workingHours[day.key] = [[day.start, day.end]];
    }
    setSaving(true);
    const res = await saveSchedulingSettingsAction({
      timezone: timezone.trim() || "Asia/Kolkata",
      workingHours,
      bufferMinutes: buffer,
      minNoticeHours: notice,
      slotIntervalMinutes: interval,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved.");
    router.refresh();
  };

  const disconnect = async () => {
    const res = await disconnectCalendarAction();
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Disconnected.");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Calendar & availability"
        description="Your Google Calendar decides what clients can book. These hours decide when."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/meetings">
              <ArrowLeft className="h-4 w-4" /> Meetings
            </Link>
          </Button>
        }
      />

      {/* Connection */}
      <Card>
        <CardContent className="p-5">
          {!googleConfigured ? (
            <div className="flex items-start gap-3">
              <StatusDot tone="muted" />
              <div>
                <p className="text-sm font-medium">
                  Google isn&apos;t set up on this deployment
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Scheduling needs Google Calendar credentials in the
                  environment before anyone can connect.
                </p>
              </div>
            </div>
          ) : connection.connected ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <StatusDot tone="emerald" />
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CalendarCheck className="h-4 w-4 text-emerald-600" />
                    Connected
                    {connection.email ? (
                      <span className="font-normal text-muted-foreground">
                        as {connection.email}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Busy times are hidden from clients automatically, and every
                    booked call gets a Google Meet link.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={disconnect}
              >
                <Unlink className="h-4 w-4" /> Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <StatusDot tone="amber" />
                <div>
                  <p className="text-sm font-medium">Not connected</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Connect Google Calendar to let clients book against your
                    real open times.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <a href="/api/google/connect?next=/dashboard/meetings/availability">
                  <Link2 className="h-4 w-4" /> Connect Google Calendar
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working hours */}
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Working hours</h2>
            <p className="text-xs text-muted-foreground">
              {enabledCount === 0
                ? "No days available — clients can't book anything"
                : `${enabledCount} day${enabledCount === 1 ? "" : "s"} · ${(
                    weeklyHours / 60
                  ).toFixed(1)} hrs/week bookable`}
            </p>
          </div>

          <div className="space-y-1.5">
            {days.map((day) => (
              <div
                key={day.key}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-2.5 transition-colors",
                  !day.enabled && "bg-muted/30",
                )}
              >
                <div className="flex w-32 shrink-0 items-center gap-2.5">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(checked) =>
                      updateDay(day.key, { enabled: checked })
                    }
                    aria-label={day.label}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      !day.enabled && "text-muted-foreground",
                    )}
                  >
                    {day.label}
                  </span>
                </div>

                {day.enabled ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={day.start}
                        onChange={(event) =>
                          updateDay(day.key, { start: event.target.value })
                        }
                        className="w-32"
                        aria-label={`${day.label} start`}
                      />
                      <span className="text-sm text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={day.end}
                        onChange={(event) =>
                          updateDay(day.key, { end: event.target.value })
                        }
                        className="w-32"
                        aria-label={`${day.label} end`}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-xs text-muted-foreground"
                      onClick={() => copyToAll(day)}
                      title="Apply these hours to every active day"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy to all
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unavailable
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking rules */}
      <Card>
        <CardContent className="space-y-5 p-5">
          <h2 className="text-sm font-semibold">Booking rules</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled
              label="Timezone"
              hint="Your working hours are read in this zone."
            >
              <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Asia/Kolkata"
              />
            </Labeled>
            <Labeled
              label="Buffer (min)"
              hint="Gap kept around existing events."
            >
              <Input
                type="number"
                min={0}
                max={240}
                value={buffer}
                onChange={(event) => setBuffer(Number(event.target.value || 0))}
              />
            </Labeled>
            <Labeled
              label="Min notice (hrs)"
              hint="How far ahead clients must book."
            >
              <Input
                type="number"
                min={0}
                max={336}
                value={notice}
                onChange={(event) => setNotice(Number(event.target.value || 0))}
              />
            </Labeled>
            <Labeled
              label="Slot interval (min)"
              hint="Spacing between offered times."
            >
              <Input
                type="number"
                min={10}
                max={240}
                value={interval}
                onChange={(event) =>
                  setIntervalMinutes(Number(event.target.value || 30))
                }
              />
            </Labeled>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save availability"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusDot({ tone }: { tone: "emerald" | "amber" | "muted" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
        tone === "emerald" && "bg-emerald-500",
        tone === "amber" && "bg-amber-400",
        tone === "muted" && "bg-muted-foreground/40",
      )}
    />
  );
}

function Labeled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
