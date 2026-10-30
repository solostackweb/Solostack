/**
 * Service-role Supabase client.
 *
 * BYPASSES ROW LEVEL SECURITY. Use only for:
 *   - Webhook handlers (e.g. Razorpay payment events)
 *   - Cron / scheduled jobs
 *   - Trusted admin routes
 *
 * NEVER expose the service-role key to the browser.
 */

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
