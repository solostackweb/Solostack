"use server";

/**
 * Time-tracking server actions.
 *
 * Timer model:
 *   - `startTimerAction()` — inserts a row with `ended_at = null`. Refuses
 *     to start a second timer while one is already running.
 *   - `stopTimerAction()` — closes the running row, computes duration +
 *     billable amount.
 *   - `manualTimeEntryAction()` — single insert with explicit duration.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  manualTimeEntrySchema,
  startTimerSchema,
  timeEntryIdSchema,
  updateTimeEntrySchema,
  bulkTimeActionSchema,
} from "./server-schemas";
import { computeAmount, getRunningTimer } from "./server";
import { recordActivity } from "@/features/activity/server";
import { canUseFeature } from "@/features/subscription/server";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

/** Pro-feature gate for time tracking. Returns an error result to short-circuit. */
async function timeGateError(): Promise<{ ok: false; error: string } | null> {
  const allowed = await canUseFeature("time.tracking");
  return allowed
    ? null
    : { ok: false as const, error: "Time tracking is a Pro feature — upgrade to Pro to log time." };
}

// --- Manual entry -----------------------------------------------------------

export async function manualTimeEntryAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = manualTimeEntrySchema.safeParse({
    description: formData.get("description"),
    projectId: formData.get("projectId"),
    clientId: formData.get("clientId"),
    startedAt: formData.get("startedAt"),
    durationSeconds: formData.get("durationSeconds"),
    billable: formData.get("billable") ?? "false",
    hourlyRate: formData.get("hourlyRate") ?? 0,
    tags: formData.get("tags"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const userId = await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();
  const amount = parsed.data.billable
    ? computeAmount(parsed.data.durationSeconds, parsed.data.hourlyRate)
    : 0;
  const startedAt = new Date(parsed.data.startedAt).toISOString();
  const endedAt = new Date(
    new Date(startedAt).getTime() + parsed.data.durationSeconds * 1000,
  ).toISOString();
  const insertRow = {
    user_id: userId,
    description: parsed.data.description ?? null,
    project_id: parsed.data.projectId ?? null,
    client_id: parsed.data.clientId ?? null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: parsed.data.durationSeconds,
    billable: parsed.data.billable,
    hourly_rate: parsed.data.hourlyRate,
    amount,
    tags: parsed.data.tags ?? [],
  };
  const { data, error } = await supabase
    .from("time_entries")
    .insert(insertRow as never)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save entry." };
  }
  revalidatePath("/dashboard/time");
  return { ok: true, data: { id: (data as { id: string }).id }, message: "Entry saved." };
}

// --- Edit -------------------------------------------------------------------

export async function updateTimeEntryAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updateTimeEntrySchema.safeParse({
    id: formData.get("id"),
    description: formData.get("description"),
    projectId: formData.get("projectId"),
    clientId: formData.get("clientId"),
    startedAt: formData.get("startedAt"),
    durationSeconds: formData.get("durationSeconds"),
    billable: formData.get("billable") ?? "false",
    hourlyRate: formData.get("hourlyRate") ?? 0,
    tags: formData.get("tags"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const userId = await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("time_entries")
    .select("invoice_id")
    .eq("id", parsed.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Entry not found." };
  if ((existing as { invoice_id: string | null }).invoice_id) {
    return { ok: false, error: "This entry is on an invoice. Amend the invoice first." };
  }

  const amount = parsed.data.billable
    ? computeAmount(parsed.data.durationSeconds, parsed.data.hourlyRate)
    : 0;
  const startedAt = new Date(parsed.data.startedAt).toISOString();
  const endedAt = new Date(
    new Date(startedAt).getTime() + parsed.data.durationSeconds * 1000,
  ).toISOString();

  const { error } = await supabase
    .from("time_entries")
    .update({
      description: parsed.data.description ?? null,
      project_id: parsed.data.projectId ?? null,
      client_id: parsed.data.clientId ?? null,
      started_at: startedAt,
      ended_at: endedAt,
      duration_seconds: parsed.data.durationSeconds,
      billable: parsed.data.billable,
      hourly_rate: parsed.data.hourlyRate,
      amount,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", parsed.data.id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/time");
  return { ok: true, message: "Entry updated." };
}

// --- Bulk actions -----------------------------------------------------------

export async function bulkUpdateTimeEntriesAction(
  input: { ids: string[]; action: "delete" | "billable" | "non_billable" },
): Promise<ActionResult<{ affected: number }>> {
  const parsed = bulkTimeActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid bulk request." };
  const userId = await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();
  const { ids, action } = parsed.data;
  const now = new Date().toISOString();

  if (action === "delete") {
    const { data } = await supabase
      .from("time_entries")
      .delete()
      .eq("user_id", userId)
      .is("invoice_id", null)
      .in("id", ids)
      .select("id");
    revalidatePath("/dashboard/time");
    const affected = (data as Array<{ id: string }> | null)?.length ?? 0;
    return { ok: true, data: { affected }, message: `${affected} entr${affected === 1 ? "y" : "ies"} deleted.` };
  }

  if (action === "non_billable") {
    const { data } = await supabase
      .from("time_entries")
      .update({ billable: false, amount: 0, updated_at: now } as never)
      .eq("user_id", userId)
      .is("invoice_id", null)
      .in("id", ids)
      .select("id");
    revalidatePath("/dashboard/time");
    const affected = (data as Array<{ id: string }> | null)?.length ?? 0;
    return { ok: true, data: { affected }, message: `${affected} marked non-billable.` };
  }

  const { data: rows } = await supabase
    .from("time_entries")
    .select("id, duration_seconds, hourly_rate")
    .eq("user_id", userId)
    .is("invoice_id", null)
    .in("id", ids);
  const list = (rows as Array<{ id: string; duration_seconds: number; hourly_rate: number }> | null) ?? [];
  let affected = 0;
  for (const r of list) {
    const { error } = await supabase
      .from("time_entries")
      .update({ billable: true, amount: computeAmount(r.duration_seconds, r.hourly_rate), updated_at: now } as never)
      .eq("id", r.id)
      .eq("user_id", userId);
    if (!error) affected += 1;
  }
  revalidatePath("/dashboard/time");
  return { ok: true, data: { affected }, message: `${affected} marked billable.` };
}

// --- Timer ------------------------------------------------------------------

export async function startTimerAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = startTimerSchema.safeParse({
    description: formData.get("description"),
    projectId: formData.get("projectId"),
    clientId: formData.get("clientId"),
    hourlyRate: formData.get("hourlyRate") ?? 0,
    billable: formData.get("billable") ?? "true",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const running = await getRunningTimer();
  if (running) {
    return { ok: false, error: "A timer is already running. Stop it first." };
  }

  const userId = await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();
  const insertRow = {
    user_id: userId,
    description: parsed.data.description ?? null,
    project_id: parsed.data.projectId ?? null,
    client_id: parsed.data.clientId ?? null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: 0,
    billable: parsed.data.billable,
    hourly_rate: parsed.data.hourlyRate,
    amount: 0,
    tags: [] as string[],
  };
  const { data, error } = await supabase
    .from("time_entries")
    .insert(insertRow as never)
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not start timer." };
  }
  revalidatePath("/dashboard/time");
  return { ok: true, data: { id: (data as { id: string }).id } };
}

export async function stopTimerAction(): Promise<ActionResult<{ id: string }>> {
  const running = await getRunningTimer();
  if (!running) return { ok: false, error: "No timer is running." };
  await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();
  const endedAt = new Date();
  const seconds = Math.max(
    1,
    Math.round((endedAt.getTime() - new Date(running.startedAt).getTime()) / 1000),
  );
  const amount = running.billable ? computeAmount(seconds, running.hourlyRate) : 0;
  const { error } = await supabase
    .from("time_entries")
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: seconds,
      amount,
    } as never)
    .eq("id", running.id);
  if (error) return { ok: false, error: error.message };

  await recordActivity({
    kind: "time_logged",
    entityType: "time_entry",
    entityId: running.id,
    title: `Logged ${(seconds / 3600).toFixed(2)}h`,
    metadata: { amount },
  });

  revalidatePath("/dashboard/time");
  return { ok: true, data: { id: running.id }, message: "Timer stopped." };
}

export async function deleteTimeEntryAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = timeEntryIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid entry id." };
  await requireUserId();
  const __gate = await timeGateError();
  if (__gate) return __gate;
  const supabase = await getServerSupabase();
  // Invoiced entries are part of an issued document — refuse to delete.
  const { data: existing } = await supabase
    .from("time_entries")
    .select("invoice_id")
    .eq("id", idParse.data)
    .maybeSingle();
  if ((existing as { invoice_id: string | null } | null)?.invoice_id) {
    return {
      ok: false,
      error: "This entry is on an invoice. Delete or amend the invoice first.",
    };
  }
  const { error } = await supabase.from("time_entries").delete().eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/time");
  return { ok: true, message: "Entry deleted." };
}
