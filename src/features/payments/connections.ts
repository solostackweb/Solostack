import "server-only";

/**
 * Read helpers for a freelancer's connected payment platforms.
 * Writes live in ./actions.ts. Stackivo never collects — these are the
 * freelancer's own accounts, surfaced on the invoice for international clients.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { PaymentConnection } from "./providers";

export type { PaymentConnection };

interface PaymentConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  label: string | null;
  kind: "link" | "handle";
  value: string;
  instructions: string | null;
  is_default: boolean;
  status: "active" | "disabled";
  created_at: string;
}

function mapRow(r: PaymentConnectionRow): PaymentConnection {
  return {
    id: r.id,
    userId: r.user_id,
    provider: r.provider,
    label: r.label,
    kind: r.kind,
    value: r.value,
    instructions: r.instructions,
    isDefault: r.is_default,
    status: r.status,
    createdAt: r.created_at,
  };
}

/** The signed-in freelancer's own connections (Settings). RLS-scoped. */
export async function listMyConnections(): Promise<PaymentConnection[]> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("payment_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return ((data as unknown as PaymentConnectionRow[] | null) ?? []).map(mapRow);
}

/**
 * Active connections for an invoice owner — used by the PUBLIC invoice page,
 * so it reads via the service-role client (the public token already gates
 * access to that invoice; we only expose the owner's pay options).
 */
export async function getActiveConnectionsForOwner(
  ownerUserId: string,
): Promise<PaymentConnection[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("payment_connections")
    .select("*")
    .eq("user_id", ownerUserId)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return ((data as unknown as PaymentConnectionRow[] | null) ?? []).map(mapRow);
}
