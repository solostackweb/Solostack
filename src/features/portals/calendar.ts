/**
 * Calendar connectivity helpers — pure, dependency-free.
 *
 * Generates RFC 5545 (.ics) text plus "add to calendar" deep-links for
 * Google / Outlook. Safe to import on both server (route handlers) and client
 * (meeting UI) — no Node-only or server-only imports.
 */

export interface CalendarEvent {
  /** Stable unique id (the meeting id). */
  uid: string;
  /** Event title. */
  title: string;
  /** ISO timestamp of the start. */
  startIso: string;
  /** Duration in minutes. */
  durationMinutes: number;
  /** Optional longer description. */
  description?: string | null;
  /** Optional URL (join link / portal link). */
  url?: string | null;
  /** Optional location text (e.g. the meet link). */
  location?: string | null;
}

const PRODID = "-//Stackivo//Portal//EN";

/** Format a Date as a UTC iCalendar timestamp: YYYYMMDDTHHMMSSZ. */
function toICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escape text per RFC 5545 (commas, semicolons, backslashes, newlines). */
function escapeICS(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold long lines to <=75 octets with CRLF + space continuation. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

function buildVEvent(event: CalendarEvent): string[] {
  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeICS(event.uid)}@stackivo`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${escapeICS(event.url)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Wrap one or more events into a full VCALENDAR document. */
export function buildICS(
  events: CalendarEvent[],
  opts?: { calendarName?: string },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  if (opts?.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeICS(opts.calendarName)}`);
  }
  for (const event of events) {
    lines.push(...buildVEvent(event));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Google Calendar "create event" template link. */
export function buildGoogleCalendarLink(event: CalendarEvent): string {
  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toICSDate(start)}/${toICSDate(end)}`,
  });
  const details = [event.description, event.url].filter(Boolean).join("\n\n");
  if (details) params.set("details", details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook.com "create event" deep-link. */
export function buildOutlookLink(event: CalendarEvent): string {
  const start = new Date(event.startIso);
  const end = new Date(start.getTime() + event.durationMinutes * 60_000);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  const body = [event.description, event.url].filter(Boolean).join("\n\n");
  if (body) params.set("body", body);
  if (event.location) params.set("location", event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** All add-to-calendar destinations for a single event. */
export function buildCalendarLinks(
  event: CalendarEvent,
  icsHref: string,
): { google: string; outlook: string; ics: string } {
  return {
    google: buildGoogleCalendarLink(event),
    outlook: buildOutlookLink(event),
    ics: icsHref,
  };
}
