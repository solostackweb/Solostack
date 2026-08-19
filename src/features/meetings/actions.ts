"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/features/email/service";
import {
  buildEmailBrand,
  renderMeetingConfirmedEmail,
  renderMeetingInviteEmail,
  type EmailBrand,
} from "@/features/email/templates";
import { getPublicAppUrl } from "@/features/documents/urls";
import {
  accessTokenForBooking,
  computeOpenSlots,
} from "@/features/scheduling/server";
import { createCalendarEvent } from "@/features/scheduling/google";
import { buildMeetingIcs } from "./calendar";

export type MeetingActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function makeToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "")
  );
}

function revalidateLinks(input: {
  proposalId?: string | null;
  contractId?: string | null;
}) {
  if (input.proposalId) {
    revalidatePath(`/dashboard/proposals/${input.proposalId}`);
  }
  if (input.contractId) {
    revalidatePath(`/dashboard/contracts/${input.contractId}`);
  }
  revalidatePath("/dashboard/meetings");
}

// ---------------------------------------------------------------------------
// CREATE — freelancer proposes a few time slots
// ---------------------------------------------------------------------------

const createSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(4000).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  timezone: z.string().trim().max(80).optional(),
  slots: z.array(z.string().trim().min(1)).max(5).optional(),
  mode: z.enum(["slots", "availability"]).optional(),
  clientId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  proposalId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
});

export async function createMeetingAction(
  input: z.infer<typeof createSchema>,
): Promise<MeetingActionResult<{ id: string; publicToken: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const d = parsed.data;
  const mode = d.mode ?? "slots";
  const slots = d.slots ?? [];
  if (mode === "slots" && slots.length === 0) {
    return { ok: false, error: "Offer at least one time slot." };
  }
  if (mode === "availability") {
    const openSlots = await computeOpenSlots(userId, {
      durationMinutes: d.durationMinutes ?? 30,
    });
    if (openSlots.length === 0) {
      return {
        ok: false,
        error:
          "No bookable times are available in the next 14 days. Connect your calendar or adjust your availability before sharing this link.",
      };
    }
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      user_id: userId,
      topic: d.topic,
      notes: d.notes ?? null,
      duration_minutes: d.durationMinutes ?? 30,
      timezone: d.timezone ?? "Asia/Kolkata",
      proposed_slots: slots,
      mode,
      client_id: d.clientId ?? null,
      project_id: d.projectId ?? null,
      proposal_id: d.proposalId ?? null,
      contract_id: d.contractId ?? null,
      status: "proposed",
      public_token: makeToken(),
    } as never)
    .select("id, public_token")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Could not schedule the call.",
    };
  }
  const row = data as { id: string; public_token: string };
  revalidateLinks(d);

  // Best-effort: email the client the booking link. Never blocks creation.
  await notifyClientOfInvite({
    userId,
    clientId: d.clientId ?? null,
    topic: d.topic,
    durationMinutes: d.durationMinutes ?? 30,
    token: row.public_token,
  }).catch(() => undefined);

  return {
    ok: true,
    data: { id: row.id, publicToken: row.public_token },
    message: "Call created — share the link so your client can pick a time.",
  };
}

// ---------------------------------------------------------------------------
// CONFIRM — client picks one slot from the public link (no auth)
// ---------------------------------------------------------------------------

const confirmSchema = z.object({
  token: z.string().trim().min(10).max(200),
  slot: z.string().trim().min(1),
});

export async function confirmMeetingSlotAction(
  input: z.infer<typeof confirmSchema>,
): Promise<MeetingActionResult<{ meetLink: string | null }>> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const admin = getAdminSupabase();
  const { data: found } = await admin
    .from("meetings")
    .select(
      "id, proposed_slots, status, user_id, topic, timezone, duration_minutes, client_id, meet_link, mode, notes",
    )
    .eq("public_token", parsed.data.token)
    .maybeSingle();

  const meeting = found as
    | {
        id: string;
        proposed_slots: unknown;
        status: string;
        user_id: string;
        topic: string;
        timezone: string;
        duration_minutes: number;
        client_id: string | null;
        meet_link: string | null;
        mode: string;
        notes: string | null;
      }
    | null;
  if (!meeting) {
    return { ok: false, error: "This scheduling link is no longer valid." };
  }
  if (meeting.status === "cancelled") {
    return { ok: false, error: "This meeting was cancelled." };
  }
  if (meeting.status === "confirmed") {
    return { ok: false, error: "This meeting is already booked." };
  }

  const slot = parsed.data.slot;
  if (meeting.mode === "availability") {
    // Re-check live availability to avoid double-booking.
    const open = await computeOpenSlots(meeting.user_id, {
      durationMinutes: meeting.duration_minutes,
    });
    if (!open.includes(slot)) {
      return { ok: false, error: "That time is no longer available." };
    }
  } else {
    const slots = Array.isArray(meeting.proposed_slots)
      ? (meeting.proposed_slots as unknown[]).filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (!slots.includes(slot)) {
      return { ok: false, error: "That time is no longer available." };
    }
  }

  // Every confirmed meeting becomes a real event on the freelancer's Google
  // Calendar with a Meet link attached. That is the only video path — there is
  // no in-app room and no pasted link to fall back to.
  const endIso = new Date(
    new Date(slot).getTime() + meeting.duration_minutes * 60_000,
  ).toISOString();

  let meetLink = meeting.meet_link;
  const token = await accessTokenForBooking(meeting.user_id);
  if (token) {
    const clientEmail = await lookupClientEmail(meeting.client_id);
    const event = await createCalendarEvent(token, {
      summary: meeting.topic,
      description: meeting.notes ?? undefined,
      startIso: slot,
      endIso,
      attendeeEmail: clientEmail,
      timezone: meeting.timezone,
      withMeet: true,
    });
    if (event?.meetLink) meetLink = event.meetLink;
  }

  const { error } = await admin
    .from("meetings")
    .update({
      scheduled_at: slot,
      status: "confirmed",
      meet_link: meetLink,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("public_token", parsed.data.token);

  if (error) return { ok: false, error: error.message };

  // Best-effort: calendar invite (.ics) + notify both sides.
  const ics = buildMeetingIcs({
    uid: meeting.id,
    topic: meeting.topic,
    startIso: slot,
    durationMinutes: meeting.duration_minutes,
    description: meetLink ? `Join: ${meetLink}` : null,
    location: meetLink ?? null,
  });
  const attachment = {
    name: "meeting.ics",
    content: Buffer.from(ics, "utf8"),
  };

  await notifyOwnerOfConfirm({
    userId: meeting.user_id,
    topic: meeting.topic,
    timezone: meeting.timezone,
    slot: parsed.data.slot,
    attachment,
  }).catch(() => undefined);
  await notifyClientOfConfirm({
    userId: meeting.user_id,
    clientId: meeting.client_id,
    topic: meeting.topic,
    timezone: meeting.timezone,
    slot: parsed.data.slot,
    durationMinutes: meeting.duration_minutes,
    meetLink,
    attachment,
  }).catch(() => undefined);

  return {
    ok: true,
    data: { meetLink },
    message: "Your time is confirmed.",
  };
}

// ---------------------------------------------------------------------------
// OWNER updates — video link, cancel, complete
// ---------------------------------------------------------------------------

/**
 * Create (or replace) the Google Meet link for a confirmed meeting.
 *
 * Normally the link is generated the moment a client books. This is the
 * recovery path for the one case that can leave a meeting without one — the
 * freelancer's Google connection was missing or expired at confirmation time.
 */
export async function regenerateMeetingLinkAction(input: {
  id: string;
}): Promise<MeetingActionResult<{ meetLink: string | null }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("meetings")
    .select("id, topic, notes, scheduled_at, duration_minutes, timezone, client_id")
    .eq("id", input.id)
    .eq("user_id", userId)
    .maybeSingle();

  const meeting = data as
    | {
        id: string;
        topic: string;
        notes: string | null;
        scheduled_at: string | null;
        duration_minutes: number;
        timezone: string;
        client_id: string | null;
      }
    | null;
  if (!meeting) return { ok: false, error: "Meeting not found." };
  if (!meeting.scheduled_at) {
    return {
      ok: false,
      error: "This meeting doesn't have a confirmed time yet.",
    };
  }

  const token = await accessTokenForBooking(userId);
  if (!token) {
    return {
      ok: false,
      error: "Connect Google Calendar first — Meet links are created there.",
    };
  }

  const endIso = new Date(
    new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60_000,
  ).toISOString();
  const clientEmail = await lookupClientEmail(meeting.client_id);
  const event = await createCalendarEvent(token, {
    summary: meeting.topic,
    description: meeting.notes ?? undefined,
    startIso: meeting.scheduled_at,
    endIso,
    attendeeEmail: clientEmail,
    timezone: meeting.timezone,
    withMeet: true,
  });

  if (!event?.meetLink) {
    return { ok: false, error: "Google didn't return a Meet link. Try again." };
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      meet_link: event.meetLink,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/meetings/${input.id}`);
  revalidatePath("/dashboard/meetings");
  return {
    ok: true,
    data: { meetLink: event.meetLink },
    message: "Meet link created.",
  };
}

async function setStatus(
  id: string,
  status: "cancelled" | "completed",
): Promise<MeetingActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("meetings")
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, message: `Meeting ${status}.` };
}

export async function cancelMeetingAction(input: {
  id: string;
}): Promise<MeetingActionResult> {
  return setStatus(input.id, "cancelled");
}

export async function completeMeetingAction(input: {
  id: string;
}): Promise<MeetingActionResult> {
  return setStatus(input.id, "completed");
}

// ---------------------------------------------------------------------------
// Email comms (best-effort — never block or fail the primary action)
// ---------------------------------------------------------------------------

async function lookupClientEmail(
  clientId: string | null,
): Promise<string | null> {
  if (!clientId) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("clients")
    .select("email")
    .eq("id", clientId)
    .maybeSingle();
  return (data as { email: string | null } | null)?.email ?? null;
}

async function ownerContact(
  userId: string,
): Promise<{ email: string | null; name: string; brand: EmailBrand }> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("email, business_name, full_name, brand_color, business_email, business_phone, website")
    .eq("id", userId)
    .maybeSingle();
  const p = data as
    | {
        email: string | null;
        business_name: string | null;
        full_name: string | null;
        brand_color: string | null;
        business_email: string | null;
        business_phone: string | null;
        website: string | null;
      }
    | null;
  return {
    email: p?.email ?? null,
    name: p?.business_name || p?.full_name || "Your freelancer",
    brand: buildEmailBrand({
      businessName: p?.business_name ?? null,
      fullName: p?.full_name ?? null,
      brandColor: p?.brand_color ?? null,
      businessEmail: p?.business_email ?? null,
      email: p?.email ?? null,
      businessPhone: p?.business_phone ?? null,
      website: p?.website ?? null,
    }),
  };
}

async function notifyClientOfInvite(args: {
  userId: string;
  clientId: string | null;
  topic: string;
  durationMinutes: number;
  token: string;
}): Promise<void> {
  if (!args.clientId) return;

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("clients")
    .select("email, full_name, business_name")
    .eq("id", args.clientId)
    .maybeSingle();
  const client = data as
    | { email: string | null; full_name: string; business_name: string | null }
    | null;
  if (!client?.email) return;

  const owner = await ownerContact(args.userId);
  const url = `${getPublicAppUrl()}/m/${args.token}`;
  const clientName = client.business_name || client.full_name || "there";

  const rendered = renderMeetingInviteEmail({
    topic: args.topic,
    durationMinutes: args.durationMinutes,
    clientName,
    hostName: owner.name,
    publicUrl: url,
    brand: owner.brand,
  });

  await sendEmail({
    type: "share",
    to: { email: client.email, name: clientName },
    ...(owner.email ? { replyTo: { email: owner.email, name: owner.name } } : {}),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    tags: ["meeting-invite"],
  });
}

async function notifyOwnerOfConfirm(args: {
  userId: string;
  topic: string;
  timezone: string;
  slot: string;
  attachment?: { name: string; content: Buffer };
}): Promise<void> {
  const owner = await ownerContact(args.userId);
  if (!owner.email) return;

  let when = args.slot;
  try {
    when = new Intl.DateTimeFormat("en-IN", {
      timeZone: args.timezone || "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(args.slot));
  } catch {
    /* fall back to the raw ISO string */
  }

  const rendered = renderMeetingConfirmedEmail({
    audience: "host",
    topic: args.topic,
    whenFormatted: when,
    hostName: owner.name,
    hasCalendarAttachment: Boolean(args.attachment),
    brand: owner.brand,
  });

  await sendEmail({
    type: "share",
    to: { email: owner.email, name: owner.name },
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: args.attachment ? [args.attachment] : undefined,
    tags: ["meeting-confirmed"],
  });
}

async function notifyClientOfConfirm(args: {
  userId: string;
  clientId: string | null;
  topic: string;
  timezone: string;
  slot: string;
  durationMinutes?: number;
  meetLink: string | null;
  attachment?: { name: string; content: Buffer };
}): Promise<void> {
  if (!args.clientId) return;

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("clients")
    .select("email, full_name, business_name")
    .eq("id", args.clientId)
    .maybeSingle();
  const client = data as
    | { email: string | null; full_name: string; business_name: string | null }
    | null;
  if (!client?.email) return;

  const owner = await ownerContact(args.userId);
  const clientName = client.business_name || client.full_name || "there";
  let when = args.slot;
  try {
    when = new Intl.DateTimeFormat("en-IN", {
      timeZone: args.timezone || "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(args.slot));
  } catch {
    /* fall back to the raw ISO string */
  }

  const rendered = renderMeetingConfirmedEmail({
    audience: "client",
    topic: args.topic,
    whenFormatted: when,
    durationMinutes: args.durationMinutes,
    clientName,
    hostName: owner.name,
    meetLink: args.meetLink,
    hasCalendarAttachment: Boolean(args.attachment),
    brand: owner.brand,
  });

  await sendEmail({
    type: "share",
    to: { email: client.email, name: clientName },
    ...(owner.email ? { replyTo: { email: owner.email, name: owner.name } } : {}),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: args.attachment ? [args.attachment] : undefined,
    tags: ["meeting-confirmed-client"],
  });
}

// ---------------------------------------------------------------------------
// NOTES — client-facing brief and the freelancer's private notes
// ---------------------------------------------------------------------------

const notesSchema = z.object({
  id: z.string().uuid(),
  /** Shown to the client on the public booking page. */
  notes: z.string().trim().max(4000).nullable().optional(),
  /** Never leaves the dashboard. */
  privateNotes: z.string().trim().max(8000).nullable().optional(),
});

export async function updateMeetingNotesAction(
  input: z.infer<typeof notesSchema>,
): Promise<MeetingActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const parsed = notesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check your notes." };
  const d = parsed.data;

  // Only write the fields the caller actually sent, so saving private notes
  // can never blank out the client brief (or the reverse).
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (d.notes !== undefined) patch.notes = d.notes || null;
  if (d.privateNotes !== undefined) patch.private_notes = d.privateNotes || null;

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("meetings")
    .update(patch as never)
    .eq("id", d.id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/meetings/${d.id}`);
  revalidatePath("/dashboard/meetings");
  return { ok: true, message: "Notes saved." };
}
