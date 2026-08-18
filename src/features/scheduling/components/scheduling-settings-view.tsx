"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarCheck, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: "1", label: "Monday" },
  { key: "2", label: "Tuesday" },
  { key: "3", label: "Wednesday" },
  { key: "4", label: "Thursday" },
  { key: "5", label: "Friday" },
  { key: "6", label: "Saturday" },
  { key: "0", label: "Sunday" },
];

interface DayRow {
  key: string;
  label: string;
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

  const save = async () => {
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
    <div className="space-y-6">
      <PageHeader
        title="Calendar & availability"
        description="Connect your calendar so clients can book against your real open times, and set your working hours."
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
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Google Calendar</h2>
          </div>
          {!googleConfigured ? (
            <p className="text-sm text-muted-foreground">
              Live availability isn&apos;t enabled on this deployment yet.
              You can still use manual time slots when booking a call.
            </p>
          ) : connection.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Connected{connection.email ? ` as ${connection.email}` : ""}. Busy
                times are hidden from clients automatically.
              </p>
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
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to let clients pick from your live
                availability, with events created automatically.
              </p>
              <Button asChild>
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
        <CardContent className="space-y-5 p-6">
          <h2 className="text-sm font-semibold">Working hours</h2>
          <div className="space-y-2">
            {days.map((day) => (
              <div
                key={day.key}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <label className="flex w-32 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(event) =>
                      updateDay(day.key, { enabled: event.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  {day.label}
                </label>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.start}
                      onChange={(event) =>
                        updateDay(day.key, { start: event.target.value })
                      }
                      className="w-32"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={day.end}
                      onChange={(event) =>
                        updateDay(day.key, { end: event.target.value })
                      }
                      className="w-32"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Unavailable
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Labeled label="Timezone">
              <Input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Asia/Kolkata"
              />
            </Labeled>
            <Labeled label="Buffer (min)">
              <Input
                type="number"
                min={0}
                max={240}
                value={buffer}
                onChange={(event) => setBuffer(Number(event.target.value || 0))}
              />
            </Labeled>
            <Labeled label="Min notice (hrs)">
              <Input
                type="number"
                min={0}
                max={336}
                value={notice}
                onChange={(event) => setNotice(Number(event.target.value || 0))}
              />
            </Labeled>
            <Labeled label="Slot interval (min)">
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

          <div className="flex justify-end">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save availability"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
