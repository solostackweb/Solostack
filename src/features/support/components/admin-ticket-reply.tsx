"use client";

/**
 * Admin reply box for /admin/support/[id].
 * - Public reply (emails the customer) or internal note (private).
 * - Canned-response inserter.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, StickyNote, ChevronDown } from "lucide-react";

import { adminReplyAction } from "../ticket-actions";
import type { SupportCannedResponse } from "../ticket-types";
import { cn } from "@/lib/utils";

interface Props {
  ticketId: string;
  canned: SupportCannedResponse[];
}

export function AdminTicketReply({ ticketId, canned }: Props) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [showCanned, setShowCanned] = React.useState(false);

  const send = async () => {
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    const res = await adminReplyAction({ ticketId, body: text, internal });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't post.");
      return;
    }
    toast.success(internal ? "Note added" : "Reply sent");
    setBody("");
    router.refresh();
  };

  return (
    <div className={cn("rounded-lg border", internal ? "bg-warning-subtle" : "bg-card")}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="inline-flex rounded-lg border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setInternal(false)}
            className={cn("rounded px-2 py-1", !internal && "bg-foreground text-background")}
          >
            Reply to customer
          </button>
          <button
            type="button"
            onClick={() => setInternal(true)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              internal && "bg-warning text-white",
            )}
          >
            <StickyNote className="h-3 w-3" /> Internal note
          </button>
        </div>

        {canned.length > 0 && !internal ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCanned((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted"
            >
              Canned <ChevronDown className="h-3 w-3" />
            </button>
            {showCanned ? (
              <div className="absolute right-0 z-10 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                {canned.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setBody((b) => (b ? `${b}\n\n${c.body}` : c.body));
                      setShowCanned(false);
                    }}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span className="font-medium">{c.title}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={internal ? "Private note for your team..." : "Write a reply - the customer gets it by email and in-app..."}
        className="block w-full resize-y border-0 bg-transparent p-3 text-sm focus:outline-none"
      />

      <div className="flex items-center justify-between border-t px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {internal ? "Only visible to you." : "Sends an email + appears in the customer's chat."}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-background disabled:opacity-50",
            internal ? "bg-warning" : "bg-foreground",
          )}
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {internal ? "Add note" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
