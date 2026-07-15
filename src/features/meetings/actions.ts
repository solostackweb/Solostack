"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/features/email/service";
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
): Promise<MeetingActionResult> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const admin = getAdminSupabase();
  const { data: found } = await admin
    .from("meetings")
    .select(
      "id, proposed_slots, status, user_id, topic, timezone, duration_minutes, client_id, meet_link, mode",
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
      }
    | null;
  if (!meeting) {
    return { ok: false, error: "This scheduling link is no longer valid." };
  }
  if (meeting.status === "cancelled") {
    return { ok: false, error: "This meeting was cancelled." };
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

  // Availability bookings create the event on the freelancer's Google Calendar
  // and use the generated Meet link.
  let meetLink = meeting.meet_link;
  if (meeting.mode === "availability") {
    const token = await accessTokenForBooking(meeting.user_id);
    if (token) {
      const clientEmail = await lookupClientEmail(meeting.client_id);
      const endIso = new Date(
        new Date(slot).getTime() + meeting.duration_minutes * 60_000,
      ).toISOString();
      const event = await createCalendarEvent(token, {
        summary: meeting.topic,
        startIso: slot,
        endIso,
        attendeeEmail: clientEmail,
        timezone: meeting.timezone,
        withMeet: true,
      });
      if (event?.meetLink) meetLink = event.meetLink;
    }
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
    clientId: meeting.client_id,
    topic: meeting.topic,
    timezone: meeting.timezone,
    slot: parsed.data.slot,
    meetLink,
    attachment,
  }).catch(() => undefined);

  return { ok: true, message: "Your time is confirmed." };
}

// ---------------------------------------------------------------------------
// OWNER updates — video link, cancel, complete
// ---------------------------------------------------------------------------

const linkSchema = z.object({
  id: z.string().uuid(),
  meetLink: z.string().trim().url().max(600).or(z.literal("")),
});

export async function setMeetingLinkAction(
  input: z.infer<typeof linkSchema>,
): Promise<MeetingActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid meeting URL." };
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("meetings")
    .update({
      meet_link: parsed.data.meetLink || null,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Meeting link saved." };
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
): Promise<{ email: string | null; name: string }> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("user_profiles")
    .select("email, business_name, full_name")
    .eq("id", userId)
    .maybeSingle();
  const p = data as
    | {
        email: string | null;
        business_name: string | null;
        full_name: string | null;
      }
    | null;
  return {
    email: p?.email ?? null,
    name: p?.business_name || p?.full_name || "Your freelancer",
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

  await sendEmail({
    type: "share",
    to: { email: client.email, name: clientName },
    subject: `${owner.name} would like to schedule a call: ${args.topic}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6">
        <p>Hi ${escapeHtml(clientName)},</p>
        <p><strong>${escapeHtml(owner.name)}</strong> would like to schedule a call &mdash; <strong>${escapeHtml(args.topic)}</strong> (${args.durationMinutes} minutes).</p>
        <p>Pick the time that works best for you:</p>
        <p><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Choose a time</a></p>
        <p style="color:#64748b;font-size:12px">Or open this link: ${url}</p>
      </div>`,
    text: `${owner.name} would like to schedule "${args.topic}" (${args.durationMinutes} min). Pick a time: ${url}`,
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

  await sendEmail({
    type: "share",
    to: { email: owner.email, name: owner.name },
    subject: `Confirmed: ${args.topic}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6">
        <p>Your client picked a time for <strong>${escapeHtml(args.topic)}</strong>.</p>
        <p><strong>${escapeHtml(when)}</strong></p>
        <p style="color:#64748b;font-size:12px">Add the video link from your Stackivo meetings page so they can join.</p>
      </div>`,
    text: `Your client confirmed "${args.topic}" for ${when}.`,
    attachments: args.attachment ? [args.attachment] : undefined,
    tags: ["meeting-confirmed"],
  });
}

async function notifyClientOfConfirm(args: {
  clientId: string | null;
  topic: string;
  timezone: string;
  slot: string;
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

  const joinLine = args.meetLink
    ? `<p><a href="${args.meetLink}">Join link</a></p>`
    : "";

  await sendEmail({
    type: "share",
    to: { email: client.email, name: clientName },
    subject: `Confirmed: ${args.topic}`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6">
        <p>Hi ${escapeHtml(clientName)},</p>
        <p>Your call <strong>${escapeHtml(args.topic)}</strong> is confirmed:</p>
        <p><strong>${escapeHtml(when)}</strong></p>
        ${joinLine}
        <p style="color:#64748b;font-size:12px">A calendar invite is attached.</p>
      </div>`,
    text: `Your call "${args.topic}" is confirmed for ${when}.`,
    attachments: args.attachment ? [args.attachment] : undefined,
    tags: ["meeting-confirmed-client"],
  });
}
