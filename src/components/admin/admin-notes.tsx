"use client";

/**
 * Inline admin notes panel.
 *
 * Renders the existing notes for a given (target_type, target_id),
 * a compose box, and inline pin/edit/delete controls. Markdown is NOT
 * rendered - these are operational scratchpad notes, plain text only.
 *
 * The panel is intentionally narrow and dense; pin to the right rail
 * on detail pages.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Pin, PinOff, Trash2, Plus, Save, X } from "lucide-react";

import {
  adminCreateNoteAction,
  adminUpdateNoteAction,
  adminDeleteNoteAction,
  type AdminActionResult,
} from "@/features/admin/actions";
import { formatRelative, shortenId } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export interface AdminNotesPanelProps {
  targetType: "user" | "subscription" | "invoice" | "contract" | "file" | "email";
  targetId: string;
  notes: Array<{
    id: string;
    actor_id: string | null;
    body: string;
    pinned: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export function AdminNotesPanel({
  targetType,
  targetId,
  notes,
}: AdminNotesPanelProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [composing, setComposing] = React.useState(false);

  const announce = React.useCallback(
    (res: AdminActionResult<unknown>) => {
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    },
    [router],
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Admin notes
          {notes.length > 0 ? (
            <span className="ml-2 rounded bg-muted px-1.5 text-micro tabular-nums">
              {notes.length}
            </span>
          ) : null}
        </h2>
        {!composing ? (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex h-7 items-center gap-1 rounded border bg-background px-2 text-xs hover:bg-accent"
          >
            <Plus className="h-3 w-3" />
            New note
          </button>
        ) : null}
      </div>

      {composing ? (
        <form
          action={async () => {
            if (!draft.trim()) return;
            const res = await adminCreateNoteAction({
              targetType,
              targetId,
              body: draft.trim(),
              pinned: false,
            });
            announce(res);
            if (res.ok) {
              setDraft("");
              setComposing(false);
            }
          }}
          className="space-y-2 rounded-lg border bg-card shadow-sm shadow-black/[0.03] p-2 text-xs"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Quick context for future-you (or your next admin)..."
            autoFocus
            className="w-full rounded border bg-background px-2 py-1.5 leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-foreground px-3 text-xs text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setComposing(false);
                setDraft("");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border bg-background px-3 text-xs hover:bg-accent"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {draft.length}/4000
            </span>
          </div>
        </form>
      ) : null}

      {notes.length === 0 && !composing ? (
        <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
          No notes yet. Add one for context that doesn&apos;t belong in the
          customer-visible record.
        </div>
      ) : null}

      <ul className="space-y-1.5">
        {notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            targetType={targetType}
            targetId={targetId}
            announce={announce}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function NoteCard({
  note,
  targetType,
  targetId,
  announce,
}: {
  note: AdminNotesPanelProps["notes"][number];
  targetType: AdminNotesPanelProps["targetType"];
  targetId: string;
  announce: (r: AdminActionResult<unknown>) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(note.body);
  const confirm = useConfirm();

  return (
    <li
      className={cn(
        "rounded-lg border bg-card shadow-sm shadow-black/[0.03] p-2.5 text-xs",
        note.pinned && "border-warning-subtle bg-warning-subtle",
      )}
    >
      {editing ? (
        <form
          action={async () => {
            const res = await adminUpdateNoteAction({
              id: note.id,
              targetType,
              targetId,
              body: draft.trim(),
            });
            announce(res);
            if (res.ok) setEditing(false);
          }}
          className="space-y-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            className="w-full rounded border bg-background px-2 py-1.5 leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!draft.trim() || draft.trim() === note.body}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-foreground px-3 text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(note.body);
              }}
              className="inline-flex h-7 items-center gap-1 rounded-lg border bg-background px-3 hover:bg-accent"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap break-words text-foreground">
            {note.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span title={note.created_at}>{formatRelative(note.created_at)}</span>
            <span className="font-mono">
              actor {note.actor_id ? shortenId(note.actor_id) : "deleted user"}
            </span>
            {note.updated_at !== note.created_at ? (
              <span className="italic">edited</span>
            ) : null}

            <span className="ml-auto flex items-center gap-1.5">
              <form
                action={async () => {
                  const res = await adminUpdateNoteAction({
                    id: note.id,
                    targetType,
                    targetId,
                    pinned: !note.pinned,
                  });
                  announce(res);
                }}
                className="inline"
              >
                <button
                  type="submit"
                  className="inline-flex h-6 items-center gap-1 rounded border px-1.5 hover:bg-accent"
                  title={note.pinned ? "Unpin" : "Pin to top"}
                >
                  {note.pinned ? (
                    <PinOff className="h-3 w-3" />
                  ) : (
                    <Pin className="h-3 w-3" />
                  )}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex h-6 items-center gap-1 rounded border px-1.5 hover:bg-accent"
              >
                Edit
              </button>
              <form
                action={async () => {
                  const ok = await confirm({
                    title: "Delete this note?",
                    confirmLabel: "Delete",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  const res = await adminDeleteNoteAction({
                    id: note.id,
                    targetType,
                    targetId,
                  });
                  announce(res);
                }}
                className="inline"
              >
                <button
                  type="submit"
                  className="inline-flex h-6 items-center gap-1 rounded border border-destructive-subtle px-1.5 text-destructive-strong hover:bg-destructive-subtle"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </form>
            </span>
          </div>
        </>
      )}
    </li>
  );
}
