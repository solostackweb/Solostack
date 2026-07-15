import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { MeetingRow } from "@/lib/supabase/types";
import { mapMeetingRow, type Meeting } from "./types";

async function currentUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface MeetingFilter {
  proposalId?: string;
  contractId?: string;
  clientId?: string;
  projectId?: string;
}

/** Meetings owned by the signed-in freelancer, newest first. */
export async function listMeetingsForOwner(
  filter: MeetingFilter = {},
): Promise<Meeting[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const supabase = await getServerSupabase();
  let query = supabase
    .from("meetings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filter.proposalId) query = query.eq("proposal_id", filter.proposalId);
  if (filter.contractId) query = query.eq("contract_id", filter.contractId);
  if (filter.clientId) query = query.eq("client_id", filter.clientId);
  if (filter.projectId) query = query.eq("project_id", filter.projectId);

  const { data } = await query;
  return ((data ?? []) as MeetingRow[]).map(mapMeetingRow);
}

/**
 * Meetings tied to a client — used inside the client portal. Access is already
 * enforced by the portal loader before this is called, so this uses the
 * service-role client scoped by client_id. Cancelled meetings are hidden.
 */
export async function listMeetingsForClient(
  clientId: string,
): Promise<Meeting[]> {
  if (!clientId) return [];
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("meetings")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  return ((data ?? []) as MeetingRow[]).map(mapMeetingRow);
}

/** A single meeting owned by the signed-in freelancer, for the detail page. */
export async function getMeetingForOwner(id: string): Promise<Meeting | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as MeetingRow | null;
  return row ? mapMeetingRow(row) : null;
}

/**
 * Public lookup by token — used by the client-facing confirm page. The client
 * is not logged in, so this goes through the service-role client and is scoped
 * strictly by the secret token.
 */
export async function getMeetingByToken(
  token: string,
): Promise<{ meeting: Meeting; hostName: string } | null> {
  if (!token) return null;
  const admin = getAdminSupabase();

  const { data } = await admin
    .from("meetings")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  const row = data as MeetingRow | null;
  if (!row) return null;

  const { data: profile } = await admin
    .from("user_profiles")
    .select("business_name, company_name, legal_name, full_name")
    .eq("id", row.user_id)
    .maybeSingle();

  const p = profile as
    | {
        business_name: string | null;
        company_name: string | null;
        legal_name: string | null;
        full_name: string | null;
      }
    | null;

  const hostName =
    p?.business_name ||
    p?.company_name ||
    p?.legal_name ||
    p?.full_name ||
    "Your freelancer";

  return { meeting: mapMeetingRow(row), hostName };
}
