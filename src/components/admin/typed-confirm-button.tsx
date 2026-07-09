"use client";

/**
 * Single-element guard for sensitive / destructive admin actions.
 *
 * Renders a button that, on click, opens an inline confirmation strip
 * inside the same form. The admin must type the expected `confirmText`
 * exactly before the actual `<button type="submit">` becomes clickable.
 *
 * Destructive tier additionally enforces a `cooldownMs` so the
 * "submit" button can only be clicked after N seconds of the strip
 * being open.
 *
 *   <form action={action}>
 *     <TypedConfirmButton
 *       label="Suspend user"
 *       confirmText={email}
 *       tier="sensitive"
 *     />
 *     ...hidden inputs...
 *   </form>
 *
 * The component intentionally keeps everything inside the parent
 * <form> so progressive enhancement works - no JS, no submission.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TypedConfirmButtonProps {
  /** Visible label of the primary trigger button. */
  label: string;
  /** Exact text the admin must type to enable submission. */
  confirmText: string;
  /** "sensitive" -> typed only. "destructive" -> typed + cooldown. */
  tier: "sensitive" | "destructive";
  /** Cooldown in ms; only used when tier='destructive'. Default 10s. */
  cooldownMs?: number;
  /** Optional helper text shown above the typing field. */
  helper?: React.ReactNode;
  /** Variant for the trigger button. */
  variant?: "default" | "destructive";
  /** Disable the whole button (e.g. while in view-as). */
  disabled?: boolean;
  /** Optional class for the outer container. */
  className?: string;
}

export function TypedConfirmButton({
  label,
  confirmText,
  tier,
  cooldownMs = 10_000,
  helper,
  variant = "default",
  disabled = false,
  className,
}: TypedConfirmButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || tier !== "destructive") return;
    setSecondsLeft(Math.ceil(cooldownMs / 1000));
    const start = Date.now();
    const handle = window.setInterval(() => {
      const left = Math.ceil((cooldownMs - (Date.now() - start)) / 1000);
      if (left <= 0) {
        window.clearInterval(handle);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(left);
      }
    }, 250);
    return () => window.clearInterval(handle);
  }, [open, tier, cooldownMs]);

  const matches = typed === confirmText;
  const cooldownDone = tier === "destructive" ? secondsLeft === 0 : true;
  const canSubmit = matches && cooldownDone && !disabled && !submitting;

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setTyped("");
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          variant === "destructive"
            ? "border-red-600/40 text-red-700 hover:bg-red-500/10 dark:text-red-300"
            : "border-border hover:bg-accent",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 text-xs",
        variant === "destructive"
          ? "border-red-600/40 bg-red-500/5"
          : "border-amber-500/40 bg-amber-500/5",
        className,
      )}
    >
      {helper ? <div className="text-muted-foreground">{helper}</div> : null}
      <div className="text-foreground">
        Type{" "}
        <code className="rounded bg-background/80 px-1 py-0.5 font-mono">
          {confirmText}
        </code>{" "}
        to confirm.
      </div>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        className="h-8 w-full rounded border bg-background px-2 font-mono"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          onClick={() => setSubmitting(true)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
            variant === "destructive"
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-foreground text-background hover:bg-foreground/90",
            !canSubmit && "cursor-not-allowed opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {tier === "destructive" && secondsLeft > 0
            ? `Wait ${secondsLeft}s`
            : matches
              ? label
              : "Confirm to continue"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
