"use client";

/**
 * Live comment thread for a single portal document (contract / invoice /
 * welcome doc). Collapsible, mobile-first. Loads on expand, then stays live
 * via Supabase Realtime (refetch on any change to this portal's comments).
 */

import * as React from "react";
import { MessageSquare, Check, Trash2, Loader2, CornerDownRight, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  getDocumentCommentsAction,
  postDocumentCommentAction,
  resolveDocumentCommentAction,
  deleteDocumentCommentAction,
  getPortalMembersAction,
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

  // Mentions autocomplete state
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [portalMembers, setPortalMembers] = React.useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const refetch = React.useCallback(async () => {
    const res = await getDocumentCommentsAction({ portalId, docType, docId });
    if (res.ok && res.data) {
      setComments(res.data.comments);
      setCount(res.data.comments.length);
      setLoaded(true);
    }
  }, [portalId, docType, docId]);

  // Load portal members for mentions autocomplete
  React.useEffect(() => {
    if (portalMembers.length === 0) {
      getPortalMembersAction({ portalId }).then((res) => {
        if (res.ok && res.data) {
          setPortalMembers(res.data.members.map((m) => ({
            id: m.user_id,
            name: m.profile?.full_name ?? m.profile?.email ?? "Member",
            email: m.profile?.email ?? null,
          })).filter((m) => m.id !== currentUserId));
        }
      });
    }
  }, [portalId, currentUserId, portalMembers.length]);

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

  // Handle @mention trigger
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setBody(value);

    // Check if we just typed @ at the end of the text
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ");
    const lastNewlineIndex = textBeforeCursor.lastIndexOf("\n");
    const lastDelimiter = Math.max(lastSpaceIndex, lastNewlineIndex);

    if (lastAtIndex > lastDelimiter && lastAtIndex === textBeforeCursor.length - 1 - (textBeforeCursor.length - cursorPos)) {
      // @ is at the end of the word being typed
      const mentionText = textBeforeCursor.slice(lastAtIndex + 1);
      setMentionQuery(mentionText);
      setShowMentions(true);
    } else if (showMentions) {
      // Check if we're still in a mention
      const mentionText = textBeforeCursor.slice(lastAtIndex + 1);
      if (lastAtIndex > lastDelimiter && !mentionText.includes(" ") && !mentionText.includes("\n")) {
        setMentionQuery(mentionText);
      } else {
        setShowMentions(false);
      }
    }
  };

  const selectMention = (member: { id: string; name: string; email: string | null }) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = body;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    const lastDelimiter = Math.max(textBeforeCursor.lastIndexOf(" "), textBeforeCursor.lastIndexOf("\n"));

    if (lastAtIndex > lastDelimiter) {
      // Replace the @mention part with the selected member's name
      const newValue = value.slice(0, lastAtIndex) + `@${member.name} ` + value.slice(cursorPos);
      setBody(newValue);
      // Move cursor to after the inserted mention
      setTimeout(() => {
        textarea.value = newValue;
        const newPos = lastAtIndex + member.name.length + 2; // @name + space
        textarea.selectionStart = newPos;
        textarea.selectionEnd = newPos;
      }, 0);
    }
    setShowMentions(false);
    setMentionQuery("");
    textarea.focus();
  };

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

  // Filter mentions based on query
  const filteredMembers = portalMembers.filter((m) =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-micro font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {count > 0
          ? `${count} comment${count > 1 ? "s" : ""}${openCount > 0 && loaded ? ` · ${openCount} open` : ""}`
          : "Add comment"}
      </button>

      {open && (
        <div className="mt-2 space-y-2.5">
          {!loaded ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                      <div className="mb-1 flex items-center gap-2 text-micro text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {mine ? "You" : c.author?.full_name ?? c.author?.email ?? "Member"}
                        </span>
                        <span aria-hidden>·</span>
                        <time dateTime={c.created_at}>{relativeTime(c.created_at)}</time>
                        {resolved && (
                          <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-success-subtle px-1.5 text-micro font-medium text-success-strong">
                            <Check className="h-2.5 w-2.5" /> Resolved
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{c.body}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onResolve(c.id, !resolved)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {resolved ? "Reopen" : "Resolve"}
                        </button>
                        {(mine || isOwner) && (
                          <button
                            type="button"
                            onClick={() => onDelete(c.id)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
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
            <div className="flex items-start gap-2 relative">
              <CornerDownRight className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Textarea
                ref={textareaRef}
                placeholder="Ask a question or leave a note on this document… Type @ to mention someone."
                value={body}
                onChange={handleTextareaChange}
                rows={2}
                maxLength={4000}
                className="min-h-12 resize-none rounded-lg bg-background text-sm"
                aria-label="Comment with @mentions"
              />
              {/* Mentions dropdown */}
              {showMentions && filteredMembers.length > 0 && (
                <div className="absolute bottom-full left-8 right-0 mb-1 z-10">
                  <div className="max-h-40 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => selectMention(member)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted"
                      >
                        <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{member.name}</span>
                        {member.email && <span className="text-xs text-muted-foreground ml-auto">{member.email}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
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
