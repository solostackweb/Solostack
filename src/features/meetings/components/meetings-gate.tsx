"use client";

import * as React from "react";
import { CalendarCheck, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MeetingsCalendarState } from "../calendar-state";

/**
 * The single gate for the whole meetings feature.
 *
 * Shared by every entry point rather than living on the board alone — the
 * board used to be the only guarded surface, so /dashboard/meetings/new was
 * reachable directly and produced meetings that could never get a Meet link.
 *
 * Returns null when the user is good to go, so callers can render it
 * unconditionally and fall through to their own content.
 */
export function MeetingsGate({
  calendar,
  returnTo = "/dashboard/meetings",
}: {
  calendar: MeetingsCalendarState;
  returnTo?: string;
}) {
  if (!calendar.configured || !calendar.tokenStorageReady) {
    return (
      <GateCard
        title="Meetings aren't set up on this deployment"
        body="Scheduling runs on Google Calendar and Google Meet. The Google credentials are missing from this environment, so there's nothing to connect to yet."
      />
    );
  }

  if (!calendar.connected) {
    return (
      <GateCard
        title="Connect Google Calendar to start scheduling"
        body="Clients book against your real free time, a calendar event is created for both of you, and every call gets a Google Meet link automatically."
        action={
          <Button asChild>
            <a href={`/api/google/connect?next=${returnTo}`}>
              <Link2 className="h-4 w-4" /> Connect Google Calendar
            </a>
          </Button>
        }
        footnote="Stackivo reads your busy times and creates events. It never reads the contents of your existing meetings."
      />
    );
  }

  return null;
}

function GateCard({
  title,
  body,
  action,
  footnote,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  footnote?: string;
}) {
  return (
    <Card>
      <CardContent className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        {action}
        {footnote ? (
          <p className="text-xs text-muted-foreground">{footnote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
