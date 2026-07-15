import "server-only";

/**
 * Minimal iCalendar (.ics) builder for a confirmed meeting. Attached to the
 * confirmation emails so both sides can one-click add the call to their
 * calendar. Times are emitted in UTC (the trailing Z), which every calendar
 * app converts to the viewer's local zone.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function icsStamp(date: Date): string {
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildMeetingIcs(input: {
  uid: string;
  topic: string;
  startIso: string;
  durationMinutes: number;
  description?: string | null;
  location?: string | null;
}): string {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stackivo//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@stackivo`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(input.topic)}`,
  ];
  if (input.description) {
    lines.push(`DESCRIPTION:${escapeIcs(input.description)}`);
  }
  if (input.location) {
    lines.push(`LOCATION:${escapeIcs(input.location)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n");
}
