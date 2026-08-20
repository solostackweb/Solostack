"use client";

/**
 * One row in /admin/settings.
 *
 * Renders a key + current value (JSON) + an inline edit form. The
 * value is parsed as JSON, so booleans / numbers / strings / objects
 * all work. The action is sensitive-tier - typed confirm = the key.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { adminSetPlatformSettingAction } from "@/features/admin/actions";
import { TypedConfirmButton } from "./typed-confirm-button";
import { formatRelative } from "@/features/admin/format";

interface SettingRowProps {
  settingKey: string;
  value: unknown;
  updatedAt?: string;
  hint?: string;
}

export function SettingRow({
  settingKey,
  value,
  updatedAt,
  hint,
}: SettingRowProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(JSON.stringify(value ?? null, null, 2));
  const [open, setOpen] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  return (
    <li className="rounded-lg border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="font-mono text-sm font-medium">{settingKey}</div>
          {hint ? (
            <div className="text-micro text-muted-foreground">{hint}</div>
          ) : null}
          {updatedAt ? (
            <div className="text-xs text-muted-foreground tabular-nums">
              updated {formatRelative(updatedAt)}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded border bg-background px-2 py-1 hover:bg-accent"
        >
          {open ? "Cancel" : "Edit"}
        </button>
      </div>
      {!open ? (
        <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-muted/40 px-2 py-1.5 font-mono text-xs">
          {JSON.stringify(value ?? null, null, 2)}
        </pre>
      ) : (
        <form
          action={async () => {
            try {
              const parsed = JSON.parse(draft);
              setParseError(null);
              const res = await adminSetPlatformSettingAction({
                key: settingKey,
                value: parsed,
              });
              if (res.ok) {
                toast.success(res.message ?? "Saved");
                setOpen(false);
                router.refresh();
              } else {
                toast.error(res.error);
              }
            } catch (err) {
              setParseError(
                err instanceof Error ? err.message : "Invalid JSON",
              );
            }
          }}
          className="mt-2 space-y-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={4}
            className="w-full rounded border bg-background px-2 py-1.5 font-mono text-xs"
          />
          {parseError ? (
            <div className="text-xs text-destructive-strong">
              {parseError}
            </div>
          ) : null}
          <TypedConfirmButton
            label="Save"
            confirmText={settingKey}
            tier="sensitive"
          />
        </form>
      )}
    </li>
  );
}
