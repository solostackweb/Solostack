/**
 * Service-role Supabase client.
 *
 * BYPASSES ROW LEVEL SECURITY. Use only for:
 *   - Webhook handlers (e.g. Razorpay payment events)
 *   - Cron / scheduled jobs
 *   - Trusted admin routes
 *
 * NEVER expose the service-role key to the browser. The `server-only` guard
 * makes an accidental client import fail at build time.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/config/env";
import type { Database } from "./types";

let adminClient: SupabaseClient<Database> | null = null;

export function getAdminSupabase(): SupabaseClient<Database> {
  if (adminClient) return adminClient;
  const serverEnv = requireServerEnv();
  adminClient = createClient<Database>(
    serverEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  return adminClient;
}

/**
 * Get admin client with organization context set.
 * For admin operations that need to filter by organization.
 */
export async function getAdminSupabaseWithOrg(orgId: string): Promise<SupabaseClient<Database>> {
  const client = getAdminSupabase();
  await client.rpc("set_config", {
    setting: "app.current_organization_id",
    value: orgId,
    is_local: true,
  });
  return client;
}
