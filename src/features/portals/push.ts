import "server-only";

/**
 * Web Push (VAPID) send helpers.
 *
 * Gracefully no-ops when VAPID env vars are unset (same pattern as the other
 * optional integrations). `web-push` is imported lazily and loosely typed so
 * the project type-checks even before `npm install web-push` is run.
 */

import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { PushSubscriptionRow } from "@/lib/supabase/types";

interface WebPushModule {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string,
  ): Promise<unknown>;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path to open on click (defaults to the app root). */
  url?: string;
  /** Collapse key so repeat notifications replace rather than stack. */
  tag?: string;
}

let cached: WebPushModule | null | undefined;

export function isPushConfigured(): boolean {
  const env = requireServerEnv();
  return Boolean(env.vapidPublicKey && env.vapidPrivateKey);
}

async function getWebPush(): Promise<WebPushModule | null> {
  if (cached !== undefined) return cached;
  const env = requireServerEnv();
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    cached = null;
    return null;
  }
  try {
    const moduleName = "web-push"; // non-literal → not statically resolved by tsc
    const mod = (await import(moduleName)) as unknown as
      { default?: WebPushModule } & WebPushModule;
    const webpush = (mod.default ?? mod) as WebPushModule;
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    cached = webpush;
  } catch {
    cached = null;
  }
  return cached;
}

/** Send a push to every device a user has registered. Prunes dead endpoints. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const webpush = await getWebPush();
  if (!webpush) return;

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  const subs = (data ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
}

/** Send to all portal members (owner + active members) except the actor. */
export async function sendPushToPortal(
  portalId: string,
  exceptUserId: string,
  payload: PushPayload,
): Promise<void> {
  if (!isPushConfigured()) return;
  const admin = getAdminSupabase();

  const { data: portal } = await admin
    .from("portals")
    .select("owner_user_id")
    .eq("id", portalId)
    .maybeSingle();
  const ownerId = (portal as { owner_user_id?: string } | null)?.owner_user_id;

  const { data: members } = await admin
    .from("portal_members")
    .select("user_id")
    .eq("portal_id", portalId)
    .is("revoked_at", null);

  const ids = new Set<string>();
  if (ownerId) ids.add(ownerId);
  for (const m of (members ?? []) as Array<{ user_id: string }>) ids.add(m.user_id);
  ids.delete(exceptUserId);

  await Promise.all(Array.from(ids).map((uid) => sendPushToUser(uid, payload)));
}
