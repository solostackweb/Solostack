/**
 * Server-side Supabase client.
 *
 * Use inside:
 *   - Server Components (RSC)
 *   - Route Handlers (`app/**\/route.ts`)
 *   - Server Actions (`"use server"`)
 *
 * This client reads/writes auth cookies so the user's session is available
 * on the server. All queries run as the authenticated user (subject to RLS).
 */

import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { env } from "@/config/env";
import type { Database } from "./types";
import { getCurrentOrganizationId } from "@/features/organizations/server-context";

/**
 * Build a request-scoped Supabase client bound to the current cookie store.
 * Automatically sets the Postgres session variable `app.current_organization_id`
 * so triggers and RLS policies can access the organization context.
 *
 * Usage:
 * ```ts
 * const supabase = await getServerSupabase();
 * const { data: { user } } = await supabase.auth.getUser();
 * ```
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  const orgId = await getCurrentOrganizationId();

  const client = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // RSC read-only cookie store — safe to ignore.
        }
      },
    },
    global: {
      headers: {
        // Pass organization ID via header so PostgREST can set session variable
        "x-organization-id": orgId ?? "",
      },
    },
  });

  // Set the Postgres session variable for triggers/RLS
  if (orgId) {
    // Use a lightweight RPC to set the session variable
    // This runs in the same transaction as subsequent queries
    await client.rpc("set_config", {
      setting: "app.current_organization_id",
      value: orgId,
      is_local: true,
    });
  }

  return client;
}
