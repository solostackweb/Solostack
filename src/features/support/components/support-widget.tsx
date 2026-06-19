"use client";

/**
 * SupportWidget — first-party live chat launcher + panel (replaces Crisp).
 *
 * - Floating launcher bottom-right. On MOBILE it sits ABOVE the fixed bottom
 *   nav (z-40, h-16 + safe-area) so it never overlaps it; on desktop it sits
 *   in the corner. When the panel is open on mobile it is a full-screen sheet
 *   (covers the nav cleanly) — no overlap is ever possible.
 * - Conversation is a first-party ticket. New agent replies arrive live via
 *   Supabase Realtime (postgres_changes on support_messages, RLS-scoped to the
 *   signed-in user, internal notes excluded).
 *
 * Tier behaviour: Pro/Business see "Online"; Free sees "Leave a message" — but
 * delivery is real-time for everyone.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { LifeBuoy, X, Send, Loader2, ExternalLink } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  createTicketAction,
  addCustomerMessageAction,
  getWidgetThreadAction,
} from "../ticket-actions";
import { TIER_SUPPORT_POLICY, type SupportMessage, type SupportPlan, type SupportTicket } from "../ticket-types";

interface Props {
  plan: SupportPlan;
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportWidget({ plan }: Props) {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const [messages, setMessages] = React.useState<SupportMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [unread, setUnread] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  // Track latest "open" without forcing the realtime effect to re-subscribe.
  const openRef = React.useRef(open);
  openRef.current = open;

  const policy = TIER_SUPPORT_POLICY[plan];

  // Lazy-load the active conversation the first time the widget opens.
  React.useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    void (async () => {
      const res = await getWidgetThreadAction();
      if (cancelled) return;
      if (res.ok && res.thread) {
        setTicket(res.thread.ticket);
        setMessages(res.thread.messages);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  // Realtime: subscribe once we have a ticket id. Stays alive for the session
  // so the unread dot works even when the panel is closed.
  React.useEffect(() => {
    const id = ticket?.id;
    if (!id) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`support-chat-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `ticket_id=eq.${id}`,
        },
        (payload) => {
          const row = payload.new as SupportMessage;
          if (row.is_internal_note) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          if (row.author_type !== "customer") {
            setUnread((u) => (document.hidden || !openRef.current ? true : u));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket?.id]);

  React.useEffect(() => {
    if (open) {
      setUnread(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    setPending(true);

    if (!ticket) {
      // First message starts the conversation. Subject is derived from the
      // text but must be ≥2 chars, so short greetings ("hi") fall back.
      const derived = text.length > 60 ? `${text.slice(0, 57)}…` : text;
      const subject = derived.length >= 2 ? derived : "Live chat";
      const res = await createTicketAction({
        category: "how-to",
        subject,
        message: text,
        channel: "chat",
        page: typeof window !== "undefined" ? window.location.pathname : undefined,
      });
      if (res.ok) {
        setInput("");
        // Reload the freshly-created thread (gets ids + enables realtime).
        const thread = await getWidgetThreadAction();
        if (thread.ok && thread.thread) {
          setTicket(thread.thread.ticket);
          setMessages(thread.thread.messages);
        }
      } else {
        toast.error(res.error ?? "Couldn't send. Please try again.");
      }
      setPending(false);
      return;
    }

    // Optimistic append.
    const optimistic: SupportMessage = {
      id: `temp-${Date.now()}`,
      ticket_id: ticket.id,
      author_type: "customer",
      author_user_id: null,
      body: text,
      attachments: [],
      via: "chat",
      external_message_id: null,
      is_internal_note: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    const res = await addCustomerMessageAction({ ticketId: ticket.id, body: text });
    setPending(false);
    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    }
  };

  const tree = (
    <>
      {/* Launcher — hidden while panel open. Mobile: above the bottom nav. */}
      {!open ? (
        <button
          type="button"
          aria-label="Open support chat"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full",
            "bg-foreground text-background shadow-lg transition hover:scale-105 active:scale-95",
            "bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] md:bottom-6 md:right-6",
          )}
        >
          <LifeBuoy className="h-5 w-5" />
          {unread ? (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-red-500" />
          ) : null}
        </button>
      ) : null}

      {open ? (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-[70] bg-black/40 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Support chat"
            className={cn(
              "fixed z-[71] flex flex-col overflow-hidden border bg-card shadow-2xl",
              // Mobile: full-screen sheet (covers the bottom nav → no overlap).
              "inset-0 rounded-none",
              // Desktop: floating card anchored bottom-right.
              "md:inset-auto md:bottom-6 md:right-6 md:h-[600px] md:max-h-[78svh] md:w-96 md:rounded-2xl",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Stackivo Support</p>
                <p className="text-[11px] text-muted-foreground">
                  {policy.liveChat ? (
                    <span className="text-emerald-600 dark:text-emerald-400">● Online</span>
                  ) : (
                    "Leave a message"
                  )}
                  {" · "}
                  {policy.slaLabel}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {!loaded ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  Hi! 👋 Ask us anything — billing, a bug, or how to do something.
                  We&rsquo;ll reply here and email you too.
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.author_type === "customer";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-foreground text-background"
                            : m.author_type === "agent"
                              ? "bg-primary/10 text-foreground"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div
                          className={cn(
                            "mt-0.5 text-[10px]",
                            mine ? "text-background/60" : "text-muted-foreground",
                          )}
                        >
                          {stamp(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="border-t p-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message…"
                  className="max-h-28 min-h-[38px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={pending || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-50"
                  aria-label="Send"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1.5 flex justify-end">
                <Link
                  href="/help"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Help center & all tickets <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(tree, document.body);
}
