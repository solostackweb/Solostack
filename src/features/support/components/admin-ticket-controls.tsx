"use client";

/**
 * Admin ticket controls - status / priority / category selects + tag editor.
 * Each control calls its server action and refreshes.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Plus } from "lucide-react";

import {
  adminSetStatusAction,
  adminSetPriorityAction,
  adminSetCategoryAction,
  adminAddTagAction,
  adminRemoveTagAction,
} from "../ticket-actions";
import type {
  SupportTicket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from "../ticket-types";

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "waiting_on_us", label: "Waiting on us" },
  { value: "waiting_on_customer", label: "Waiting on customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];
const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"];
const CATEGORIES: TicketCategory[] = [
  "billing",
  "bug",
  "how-to",
  "feature-request",
  "account",
  "onboarding",
];

const selectCls =
  "h-8 w-full rounded-md border bg-background px-2 text-xs capitalize focus:outline-none";

export function AdminTicketControls({ ticket }: { ticket: SupportTicket }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [newTag, setNewTag] = React.useState("");

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) toast.error(res.error ?? "Failed.");
    else {
      toast.success(ok);
      router.refresh();
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <label className="block space-y-1">
        <span className="font-medium text-muted-foreground">Status</span>
        <select
          className={selectCls}
          value={ticket.status}
          disabled={busy}
          onChange={(e) => run(() => adminSetStatusAction(ticket.id, e.target.value as TicketStatus), "Status updated")}
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="font-medium text-muted-foreground">Priority</span>
        <select
          className={selectCls}
          value={ticket.priority}
          disabled={busy}
          onChange={(e) => run(() => adminSetPriorityAction(ticket.id, e.target.value as TicketPriority), "Priority updated")}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="font-medium text-muted-foreground">Category</span>
        <select
          className={selectCls}
          value={ticket.category ?? ""}
          disabled={busy}
          onChange={(e) => run(() => adminSetCategoryAction(ticket.id, e.target.value as TicketCategory), "Category updated")}
        >
          {ticket.category ? null : <option value="">-</option>}
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1">
        <span className="font-medium text-muted-foreground">Tags</span>
        <div className="flex flex-wrap gap-1">
          {ticket.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              {t}
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => adminRemoveTagAction(ticket.id, t), "Tag removed")}
                aria-label={`Remove ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTag.trim();
            if (!t) return;
            setNewTag("");
            void run(() => adminAddTagAction(ticket.id, t), "Tag added");
          }}
        >
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add tag"
            className="h-7 flex-1 rounded-md border bg-background px-2 text-xs"
          />
          <button type="submit" disabled={busy} className="rounded-md border p-1 hover:bg-muted">
            <Plus className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
