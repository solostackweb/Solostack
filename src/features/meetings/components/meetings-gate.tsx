"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Clock3,
  LifeBuoy,
  Link2,
  Users,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MeetingsCalendarState } from "../calendar-state";

const meetingFlow = [
  { label: "Set availability", icon: Clock3 },
  { label: "Client picks", icon: Users },
  { label: "Meet link created", icon: Video },
];

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
    const storageUnavailable = calendar.configured && !calendar.tokenStorageReady;
    return (
      <GateCard
        eyebrow="Deployment setup needed"
        title={
          storageUnavailable
            ? "Calendar connections cannot be stored yet."
            : "Google scheduling is not enabled yet."
        }
        body={
          storageUnavailable
            ? "Stackivo cannot securely save a Google Calendar connection on this deployment. Support needs to finish the storage setup before you connect."
            : "Support needs to enable Google Calendar and Meet for this deployment before you can schedule client calls."
        }
        action={
          <Button asChild className="min-h-11">
            <Link href="/help">
              <LifeBuoy /> Get setup help
            </Link>
          </Button>
        }
      />
    );
  }

  if (!calendar.connected) {
    return (
      <GateCard
        eyebrow="Calendar connection"
        title="Connect Google Calendar to start scheduling"
        body="Clients book against your real free time, a calendar event is created for both of you, and every call gets a Google Meet link automatically."
        action={
          <Button asChild className="min-h-11">
            <a href={`/api/google/connect?next=${returnTo}`}>
              <Link2 /> Connect Google Calendar
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
  eyebrow,
  title,
  body,
  action,
  footnote,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  footnote?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-border/60 bg-primary/[0.025] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
          <p className="text-micro font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h2 className="mt-3 max-w-md font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {body}
          </p>
          <div className="mt-6">{action}</div>
          {footnote ? (
            <p className="mt-4 max-w-md text-xs leading-5 text-muted-foreground">
              {footnote}
            </p>
          ) : null}
        </div>

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-lg rounded-lg border border-border/70 bg-background p-5 sm:p-6">
            <div className="flex items-center gap-3 border-b border-border/60 pb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Once connected
                </p>
                <p className="mt-1 text-sm font-semibold">
                  One calendar, one client call flow
                </p>
              </div>
            </div>

            <div className="relative mt-6 grid grid-cols-3">
              <div
                aria-hidden
                className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-primary/25"
              />
              {meetingFlow.map(({ label, icon: Icon }, index) => (
                <div
                  key={label}
                  className="relative z-10 flex flex-col items-center text-center"
                >
                  <span
                    className={
                      index === 0
                        ? "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                        : "flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-background text-primary"
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="mt-2 max-w-24 text-xs font-semibold leading-4">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-6 border-t border-border/60 pt-5 text-sm leading-6 text-muted-foreground">
              Busy times stay private. Stackivo only checks availability and
              creates the event you schedule.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
