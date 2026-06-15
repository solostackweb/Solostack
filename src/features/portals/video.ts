/**
 * Built-in video room helper (Jitsi Meet).
 *
 * Deterministic, account-free rooms on the public meet.jit.si instance.
 * If the public instance ever requires moderator auth, the portal still
 * works because the freelancer can paste any external link (Zoom/Meet) to
 * override `meet_link`.
 */

const JITSI_BASE = "https://meet.jit.si";

/** Stable room URL for a given portal + meeting. */
export function buildJitsiRoom(portalId: string, meetingId: string): string {
  // UUIDs are URL-safe; prefix namespaces the room to avoid collisions.
  return `${JITSI_BASE}/stackivo-${portalId}-${meetingId}`;
}

/** True if a link is one of our generated Jitsi rooms. */
export function isJitsiRoom(link: string | null | undefined): boolean {
  return !!link && link.startsWith(`${JITSI_BASE}/stackivo-`);
}
