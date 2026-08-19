import type { MeetingRow, MeetingStatus } from "@/lib/supabase/types";

export type { MeetingStatus };

/**
 * UI-facing meeting model (camelCase) mapped from the DB row.
 *
 * Video is always Google Meet: the link is created on the freelancer's own
 * calendar when a client confirms a time. There is no provider choice, no
 * in-app room, and no pasted link.
 */
export interface Meeting {
  id: string;
  topic: string;
  /** The brief shown to the client on the public booking page. */
  notes: string | null;
  /** Agenda / outcomes / follow-ups. Never leaves the dashboard. */
  privateNotes: string | null;
  durationMinutes: number;
  timezone: string;
  /** ISO-8601 start times the freelancer offered. */
  proposedSlots: string[];
  scheduledAt: string | null;
  /** Google Meet URL, created with the calendar event on confirmation. */
  meetLink: string | null;
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
    privateNotes: row.private_notes ?? null,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    proposedSlots,
    scheduledAt: row.scheduled_at,
    meetLink: row.meet_link,
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
