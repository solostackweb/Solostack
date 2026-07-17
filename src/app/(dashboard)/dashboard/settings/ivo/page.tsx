"use client";

import * as React from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SettingsPageHeader,
  SettingsSection,
} from "@/features/settings/components/settings-section";
import {
  deleteIvoMemoryAction,
  listIvoMemoriesAction,
  type IvoMemoryItem,
} from "@/features/ai-workflows/memory-actions";

export default function IvoSettingsPage() {
  const [memories, setMemories] = React.useState<IvoMemoryItem[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listIvoMemoriesAction();
      if (cancelled) return;
      if (res.ok) setMemories(res.data);
      else {
        setMemories([]);
        toast.error(res.error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = React.useCallback(async (id: string) => {
    setBusyId(id);
    const res = await deleteIvoMemoryAction({ id });
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMemories((current) => (current ?? []).filter((memory) => memory.id !== id));
    toast.success("Forgotten.");
  }, []);

  return (
    <>
      <SettingsPageHeader
        title="Ivo"
        description="Review and manage what your assistant remembers between conversations."
      />

      <SettingsSection
        title="Remembered preferences"
        description="Ivo saves small, lasting preferences you state in chat — like your standard rate or payment terms — and applies them automatically. Delete anything here and Ivo forgets it immediately."
      >
        {memories === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : memories.length === 0 ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Nothing remembered yet</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Tell Ivo things like “remember my standard rate is ₹2,500/hr” or
                “always use Net-15 for Kumar Associates” and they will show up
                here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed">{memory.content}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Saved {formatDate(memory.createdAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={busyId === memory.id}
                  onClick={() => handleDelete(memory.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Forget this</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Memory is capped at 40 entries and only ever visible to you. Chat
          history is separate: Ivo reads just the recent messages of the
          current conversation, and archived chats are pruned automatically
          after 90 days.
        </p>
      </SettingsSection>
    </>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
