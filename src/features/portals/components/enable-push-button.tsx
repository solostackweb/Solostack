"use client";

/**
 * "Enable notifications" toggle — subscribes the current browser to Web Push.
 * Renders nothing when push isn't supported or VAPID isn't configured, so it
 * is safe to drop anywhere.
 */

import * as React from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function EnablePushButton({ className }: { className?: string }) {
  const [supported, setSupported] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(env.vapidPublicKey);
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      })
      .catch(() => undefined);
  }, []);

  if (!supported) return null;

  async function enable() {
    setPending(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      setSubscribed(true);
    } catch {
      /* user denied or unsupported — leave state unchanged */
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      /* ignore */
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={subscribed ? disable : enable}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : subscribed ? (
        <BellOff className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {subscribed ? "Notifications on" : "Enable notifications"}
    </Button>
  );
}
