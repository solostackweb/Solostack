/**
 * Formatting helpers for time values. These are pure — safe to import from
 * client components. The domain record shape lives in `./server.ts`
 * (`TimeEntryRecord`); UI components should consume that directly.
 */

/**
 * Format a duration in seconds as `HH:MM:SS` (or `MM:SS` if under an hour).
 * Used by the live timer widget + entries table.
 */
export function formatDuration(seconds: number, opts: { compact?: boolean } = {}) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (opts.compact) {
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${sec}s`;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

/** Convert seconds → decimal hours rounded to 2dp (e.g. 5432s → 1.51h). */
export function secondsToHours(seconds: number) {
  return Math.round((seconds / 3600) * 100) / 100;
}

/**
 * Group by the viewer's LOCAL calendar day (YYYY-MM-DD), not the UTC day.
 */
export function dateKeyFromISO(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date key in the viewer's local timezone (YYYY-MM-DD). */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
