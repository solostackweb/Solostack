"use client";

/**
 * One-click suppression remove + add actions for /admin/emails.
 *
 * Suppression removal is "routine" tier - single click, no
 * confirmation, but audited via runAdminAction.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

import {
  adminRemoveSuppressionAction,
  adminAddSuppressionAction,
  type AdminActionResult,
} from "@/features/admin/actions";

export function SuppressionRemoveButton({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const res = await adminRemoveSuppressionAction(email);
        announce(res, router);
        setPending(false);
      }}
      className="inline-flex h-6 items-center gap-1 rounded border border-red-500/30 px-2 text-[11px] text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
    >
      <Trash2 className="h-3 w-3" />
      Remove
    </button>
  );
}

export function SuppressionAddForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <form
      action={async () => {
        if (!email.trim()) return;
        setPending(true);
        const res = await adminAddSuppressionAction(email.trim(), "manual");
        announce(res, router);
        if (res.ok) setEmail("");
        setPending(false);
      }}
      className="flex gap-1.5"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@example.com"
        className="h-7 w-56 rounded border bg-background px-2 text-xs"
      />
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="inline-flex h-7 items-center gap-1 rounded border px-2 text-xs hover:bg-accent disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
        Suppress
      </button>
    </form>
  );
}

function announce(
  res: AdminActionResult<unknown>,
  router: ReturnType<typeof useRouter>,
) {
  if (res.ok) {
    toast.success(res.message ?? "Done");
    router.refresh();
  } else {
    toast.error(res.error);
  }
}
