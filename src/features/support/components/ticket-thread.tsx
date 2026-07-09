"use client";

/**
 * TicketThread - conversation view + reply box.
 *
 * Shared by the in-app ticket page (/help/tickets/[id], mode="user") and the
 * guest page (/support/t/[token], mode="guest"). Submitting a reply calls the
 * matching server action and refreshes. (Live realtime updates are layered on
 * in S3.)
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { addCustomerMessageAction, addGuestMessageAction } from "../ticket-actions";
import type { SupportMessage, SupportTicket } from "../ticket-types";
import { TicketStatusBadge } from "./ticket-status-badge";

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authorLabel(m: SupportMessage): string {
  switch (m.author_type) {
    case "customer":
      return "You";
    case "agent":
      return "Stackivo Support";
    case "ai":
      return "Stackivo AI";
    default:
      return "System";
  }
}

interface Props {
  ticket: SupportTicket;
  messages: SupportMessage[];
  mode: "user" | "guest";
}

export function TicketThread({ ticket, messages, mode }: Props) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const closed = ticket.status === "closed";

  const onSend = async () => {
    const text = body.trim();
    if (!text) return;
    setPending(true);
    const res =
      mode === "guest"
        ? await addGuestMessageAction({ token: ticket.public_token, body: text })
        : await addCustomerMessageAction({ ticketId: ticket.id, body: text });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't send your message.");
      return;
    }
    setBody("");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{ticket.subject}</h1>
          <p className="text-xs text-muted-foreground">
            Opened {formatStamp(ticket.created_at)}
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </header>

      <div className="space-y-3">
        {messages.map((m) => {
          const mine = m.author_type === "customer";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  mine
                    ? "bg-foreground text-background"
                    : m.author_type === "agent"
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <div
                  className={`mb-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    mine ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  {authorLabel(m)} - {formatStamp(m.created_at)}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <p className="rounded-md border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
          This ticket is closed. Need more help? Start a new request from the Help page.
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={8000}
            placeholder="Type your reply..."
            className="block w-full resize-none rounded-md border bg-background p-2.5 text-sm"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSend();
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">⌘/Ctrl + Enter to send</span>
            <button
              type="button"
              onClick={onSend}
              disabled={pending || !body.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
