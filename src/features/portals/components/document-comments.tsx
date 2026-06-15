"use client";

/**
 * Live comment thread for a single portal document (contract / invoice /
 * welcome doc). Collapsible, mobile-first. Loads on expand, then stays live
 * via Supabase Realtime (refetch on any change to this portal's comments).
 */

import * as React from "react";
import { MessageSquare, Check, Trash2, Loader2, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  getDocumentCommentsAction,
  postDocumentCommentAction,
  resolveDocumentCommentAction,
  deleteDocumentCommentAction,
  type DocumentCommentWithAuthor,
} from "../actions-comments";
import type { PortalDocumentType } from "@/lib/supabase/types";

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function DocumentCommentsThread({
  portalId,
  docType,
  docId,
  currentUserId,
  isOwner,
  initialCount = 0,
}: {
  portalId: string;
  docType: PortalDocumentType;
  docId: string;
  currentUserId: string;
  isOwner: boolean;
  initialCount?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [comments, setComments] = React.useState<DocumentCommentWithAuthor[]>([]);
  const [count, setCount] = React.useState(initialCount);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    const res = await getDocumentCommentsAction({ portalId, docType, docId });
    if (res.ok && res.data) {
      setComments(res.data.comments);
      setCount(res.data.comments.length);
      setLoaded(true);
    }
  }, [portalId, docType, docId]);

  // Load on first expand.
  React.useEffect(() => {
    if (open && !loaded) void refetch();
  }, [open, loaded, refetch]);

  // Live updates while expanded.
  React.useEffect(() => {
    if (!open) return;
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(`doc-comments-${portalId}-${docId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portal_document_comments",
          filter: `portal_id=eq.${portalId}`,
        },
        (payload) => {
          const rec = (payload.new ?? payload.old) as { doc_id?: string } | null;
          if (rec?.doc_id === docId) void refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, portalId, docId, refetch]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    const res = await postDocumentCommentAction({ portalId, docType, docId, body: text });
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    setBody("");
    void refetch();
  }

  async function onResolve(commentId: string, resolved: boolean) {
    await resolveDocumentCommentAction({ portalId, commentId, resolved });
    void refetch();
  }

  async function onDelete(commentId: string) {
    await deleteDocumentCommentAction({ portalId, commentId });
    void refetch();
  }

  const openCount = comments.filter((c) => !c.resolved_at).length;

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {count > 0
          ? `${count} comment${count > 1 ? "s" : ""}${openCount > 0 && loaded ? ` · ${openCount} open` : ""}`
          : "Add comment"}
      </button>

      {open && (
        <div className="mt-2 space-y-2.5">
          {!loaded ? (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </p>
          ) : (
            comments.length > 0 && (
              <ul className="space-y-2">
                {comments.map((c) => {
                  const mine = c.author_id === currentUserId;
                  const resolved = Boolean(c.resolved_at);
                  return (
                    <li
                      key={c.id}
                      className={`rounded-lg border p-2.5 text-sm ${resolved ? "opacity-60" : ""} ${mine ? "border-primary/30 bg-primary/5" : "bg-background"}`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {mine ? "You" : c.author?.full_name ?? c.author?.email ?? "Member"}
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={c.created_at}>{relativeTime(c.created_at)}</time>
                        {resolved && (
                          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="h-2.5 w-2.5" /> Resolved
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onResolve(c.id, !resolved)}
                          className="text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {resolved ? "Reopen" : "Resolve"}
                        </button>
                        {(mine || isOwner) && (
                          <button
                            type="button"
                            onClick={() => onDelete(c.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          <form onSubmit={onSubmit} className="space-y-2">
            <div className="flex items-start gap-2">
              <CornerDownRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Textarea
                placeholder="Ask a question or leave a note on this document…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={4000}
                className="min-h-12 resize-none rounded-xl bg-background text-sm"
              />
            </div>
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" size="sm" className="h-8 rounded-full px-3" disabled={pending || !body.trim()}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Comment"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
