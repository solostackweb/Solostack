"use client";

/**
 * Live portal chat — Supabase Realtime.
 *
 * One channel per portal carries three signals:
 *   - postgres_changes (INSERT on portal_messages) → live messages
 *   - presence                                      → online / offline
 *   - broadcast 'typing' / 'read'                   → typing + read receipts
 *
 * RLS scopes message rows to portal members, and Realtime honours RLS, so a
 * subscriber only ever receives their own portal's messages. Read receipts are
 * also persisted (markPortalReadAction) so they survive reloads.
 */

import * as React from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { postPortalMessageAction, markPortalReadAction } from "../actions";
import type { PortalMessageRow } from "@/lib/supabase/types";

export type PortalChatMessage = PortalMessageRow & {
  author: { full_name: string | null; email: string | null } | null;
  /** True while an optimistic message is awaiting the server id. */
  pending?: boolean;
};

interface Options {
  portalId: string;
  currentUserId: string;
  initialMessages: PortalChatMessage[];
}

function sortAsc(list: PortalChatMessage[]): PortalChatMessage[] {
  return [...list].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
}

export function usePortalMessages({
  portalId,
  currentUserId,
  initialMessages,
}: Options) {
  const [messages, setMessages] = React.useState<PortalChatMessage[]>(
    () => sortAsc(initialMessages),
  );
  const [onlineUserIds, setOnlineUserIds] = React.useState<string[]>([]);
  const [peerTyping, setPeerTyping] = React.useState(false);
  const [peerReadAt, setPeerReadAt] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const channelRef = React.useRef<ReturnType<
    ReturnType<typeof getBrowserSupabase>["channel"]
  > | null>(null);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = React.useRef(0);

  const markRead = React.useCallback(() => {
    const at = new Date().toISOString();
    void markPortalReadAction({ portalId });
    channelRef.current?.send({
      type: "broadcast",
      event: "read",
      payload: { userId: currentUserId, at },
    });
  }, [portalId, currentUserId]);

  React.useEffect(() => {
    const supabase = getBrowserSupabase();
    const channel = supabase.channel(`portal-chat-${portalId}`, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "portal_messages",
          filter: `portal_id=eq.${portalId}`,
        },
        (payload) => {
          const row = payload.new as PortalMessageRow;
          if (row.deleted_at) return;
          setMessages((prev) => {
            // Already have this id?
            if (prev.some((m) => m.id === row.id)) return prev;
            // Reconcile an optimistic message (same author + body, still pending).
            const optimisticIdx = prev.findIndex(
              (m) => m.pending && m.author_id === row.author_id && m.body === row.body,
            );
            const next: PortalChatMessage = { ...row, author: null };
            if (optimisticIdx >= 0) {
              const copy = [...prev];
              copy[optimisticIdx] = next;
              return sortAsc(copy);
            }
            // Incoming message from the other party → mark read shortly after.
            if (row.author_id !== currentUserId) {
              setTimeout(() => markRead(), 400);
            }
            return sortAsc([...prev, next]);
          });
        },
      )
      .on("broadcast", { event: "message" }, (payload) => {
        // Primary live-delivery path: the sender broadcasts the row directly,
        // so it works regardless of the postgres_changes publication / RLS.
        const row = payload.payload as Partial<PortalMessageRow> | undefined;
        if (!row?.id || !row.author_id || row.author_id === currentUserId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          const next: PortalChatMessage = {
            id: row.id!,
            portal_id: portalId,
            parent_id: row.parent_id ?? null,
            author_id: row.author_id!,
            body: row.body ?? "",
            attachments: null,
            created_at: row.created_at ?? new Date().toISOString(),
            edited_at: null,
            deleted_at: null,
            author: null,
          };
          setTimeout(() => markRead(), 400);
          return sortAsc([...prev, next]);
        });
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        const userId = (payload.payload as { userId?: string })?.userId;
        if (!userId || userId === currentUserId) return;
        setPeerTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setPeerTyping(false), 3000);
      })
      .on("broadcast", { event: "read" }, (payload) => {
        const data = payload.payload as { userId?: string; at?: string };
        if (!data?.userId || data.userId === currentUserId || !data.at) return;
        setPeerReadAt((prev) =>
          !prev || Date.parse(data.at!) > Date.parse(prev) ? data.at! : prev,
        );
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUserIds(Object.keys(state));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ userId: currentUserId });
          markRead();
        }
      });

    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [portalId, currentUserId, markRead]);

  const notifyTyping = React.useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return; // throttle
    lastTypingSent.current = now;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });
  }, [currentUserId]);

  const send = React.useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!trimmed || pending) return;
      setPending(true);
      setError(null);
      const tempId = `temp-${Date.now()}`;
      const optimistic: PortalChatMessage = {
        id: tempId,
        portal_id: portalId,
        parent_id: null,
        author_id: currentUserId,
        body: trimmed,
        attachments: null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        author: null,
        pending: true,
      };
      setMessages((prev) => sortAsc([...prev, optimistic]));

      const res = await postPortalMessageAction({ portalId, body: trimmed });
      setPending(false);
      if (!res.ok || !res.data) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setError(res.ok ? "Could not send." : res.error);
        return;
      }
      // Reconcile: give the optimistic row its real id (realtime echo dedupes).
      const realId = res.data.messageId;
      const createdAt = optimistic.created_at;
      setMessages((prev) =>
        prev.some((m) => m.id === realId)
          ? prev.filter((m) => m.id !== tempId)
          : prev.map((m) =>
              m.id === tempId ? { ...m, id: realId, pending: false } : m,
            ),
      );
      // Broadcast the message so the other side gets it live without relying on
      // the postgres_changes publication / RLS.
      channelRef.current?.send({
        type: "broadcast",
        event: "message",
        payload: {
          id: realId,
          portal_id: portalId,
          author_id: currentUserId,
          body: trimmed,
          created_at: createdAt,
        },
      });
    },
    [portalId, currentUserId, pending],
  );

  const peerOnline = onlineUserIds.some((id) => id !== currentUserId);

  return {
    messages,
    peerOnline,
    onlineUserIds,
    peerTyping,
    peerReadAt,
    pending,
    error,
    send,
    notifyTyping,
    markRead,
  };
}
