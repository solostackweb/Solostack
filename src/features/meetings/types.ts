import type { MeetingRow, MeetingStatus } from "@/lib/supabase/types";

export type { MeetingStatus };

/** How a meeting's video link gets produced. */
export type VideoProvider = "daily" | "google_meet" | "zoom" | "manual_link";

export const VIDEO_PROVIDERS: VideoProvider[] = [
  "daily",
  "google_meet",
  "zoom",
  "manual_link",
];

export const VIDEO_PROVIDER_LABEL: Record<VideoProvider, string> = {
  daily: "Stackivo video",
  google_meet: "Google Meet",
  zoom: "Zoom",
  manual_link: "My own link",
};

function parseVideoProvider(value: unknown): VideoProvider | null {
  return typeof value === "string" &&
    (VIDEO_PROVIDERS as string[]).includes(value)
    ? (value as VideoProvider)
    : null;
}

/**
 * The provider a meeting should actually use.
 *
 * Rows created before the picker existed store null. Those kept an implicit
 * provider: availability bookings always produced a Google Meet link, slot
 * bookings a Daily room. Falling back that way means no existing meeting
 * changes behaviour when this column ships.
 */
export function effectiveVideoProvider(
  stored: string | null | undefined,
  mode: string,
): VideoProvider {
  return (
    parseVideoProvider(stored) ??
    (mode === "availability" ? "google_meet" : "daily")
  );
}

/** UI-facing meeting model (camelCase) mapped from the DB row. */
export interface Meeting {
  id: string;
  topic: string;
  notes: string | null;
  durationMinutes: number;
  timezone: string;
  /** ISO-8601 start times the freelancer offered. */
  proposedSlots: string[];
  scheduledAt: string | null;
  meetLink: string | null;
  /** Null on meetings created before the provider picker existed. */
  videoProvider: VideoProvider | null;
  location: string | null;
  status: MeetingStatus;
  mode: string;
  publicToken: string;
  clientId: string | null;
  projectId: string | null;
  proposalId: string | null;
  contractId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapMeetingRow(row: MeetingRow): Meeting {
  const proposedSlots = Array.isArray(row.proposed_slots)
    ? (row.proposed_slots as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  return {
    id: row.id,
    topic: row.topic,
    notes: row.notes,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    proposedSlots,
    scheduledAt: row.scheduled_at,
    meetLink: row.meet_link,
    videoProvider: parseVideoProvider(row.video_provider),
    location: row.location,
    status: row.status,
    mode: row.mode,
    publicToken: row.public_token,
    clientId: row.client_id,
    projectId: row.project_id,
    proposalId: row.proposal_id,
    contractId: row.contract_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  proposed: "Awaiting time",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};
