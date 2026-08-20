"use client";

/**
 * Users bulk-action wrapper (Admin hardening A4).
 *
 * Wraps the server-rendered users table in a <form> so native row checkboxes
 * (name="ids") can drive bulk actions without porting the whole table to the
 * client. Provides select-all, a live count, and two actions:
 *   - Suppress selected  -> server action (audited)
 *   - Export selected    -> POST to the streaming CSV route (file download)
 */

import * as React from "react";
import { Download, MailX } from "lucide-react";

interface Props {
  children: React.ReactNode;
  /** Server action: reads repeated `ids` from FormData. */
  suppressAction: (formData: FormData) => Promise<unknown>;
  /** Streaming CSV route; receives the same form (selected ids) via POST. */
  exportUrl: string;
}

export function UsersBulk({ children, suppressAction, exportUrl }: Props) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [count, setCount] = React.useState(0);

  const recount = React.useCallback(() => {
    const f = formRef.current;
    if (!f) return;
    setCount(f.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length);
  }, []);

  const toggleAll = (checked: boolean) => {
    const f = formRef.current;
    if (!f) return;
    f.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((el) => {
      el.checked = checked;
    });
    recount();
  };

  const none = count === 0;

  return (
    <form ref={formRef} action={exportUrl} method="post" onChange={recount}>
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} />
          Select all on page
        </label>
        <span className="text-muted-foreground">
          {count > 0 ? `${count} selected` : "No rows selected"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="submit"
            formAction={exportUrl}
            formMethod="post"
            disabled={none}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 font-medium hover:bg-accent disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> Export selected
          </button>
          <button
            type="submit"
            formAction={suppressAction as unknown as (formData: FormData) => void}
            disabled={none}
            onClick={(e) => {
              if (!window.confirm(`Suppress ${count} email${count === 1 ? "" : "s"}? They will stop receiving mail.`)) {
                e.preventDefault();
              }
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-destructive-subtle px-2.5 font-medium text-destructive-strong hover:bg-destructive-subtle disabled:opacity-40"
          >
            <MailX className="h-3 w-3" /> Suppress selected
          </button>
        </div>
      
      </div>
      {children}
    </form>
  );
}
