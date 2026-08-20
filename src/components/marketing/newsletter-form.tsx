"use client";

/**
 * Reusable newsletter / lead-capture form.
 *
 * Tiny single-input email form that POSTs through
 * `subscribeToNewsletterAction()`. Caller passes a `source` so leads
 * are attributed in Brevo, plus an optional `magnet` when the form
 * is the gate for a downloadable asset.
 *
 * Renders a success state inline (no toast) so it's safe to embed
 * inside cards / footers / modals where a popping toast would be
 * disruptive.
 */

import * as React from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { subscribeToNewsletterAction } from "@/features/leads/actions";
import { useTrack } from "@/lib/analytics/track";

interface Props {
  /** Attribution tag — "footer" / "exit_intent" / "banner" / "/help_modal". */
  source: string;
  /** Optional lead-magnet id — "gst_template" / "rate_calc" / null. */
  magnet?: string;
  /** Optional placeholder override. */
  placeholder?: string;
  /** Optional CTA label override. */
  ctaLabel?: string;
  /** Optional success message override. */
  successLabel?: string;
  /** When true, renders compact (single row) — used in the footer. */
  compact?: boolean;
}

export function NewsletterForm({
  source,
  magnet,
  placeholder = "you@example.com",
  ctaLabel = "Subscribe",
  successLabel = "You're in. Check your inbox.",
  compact = false,
}: Props) {
  const track = useTrack();
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState(""); // honeypot
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    setPending(true);
    const res = await subscribeToNewsletterAction({
      email: email.trim(),
      source,
      magnet,
      website,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Could not subscribe.");
      return;
    }
    setDone(true);
    setEmail("");
    track("marketing.lead.captured", {
      source,
      magnet: magnet ?? "",
      via: res.via ?? "email_fallback",
    });
  };

  if (done) {
    return (
      <div
        role="status"
        className="inline-flex items-center gap-2 rounded-lg border border-success-subtle bg-success-subtle px-3 py-2 text-xs font-medium text-success-strong"
      >
        <CheckCircle2 className="h-4 w-4" />
        {successLabel}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? "flex w-full max-w-sm gap-2"
          : "flex w-full max-w-sm flex-col gap-2 sm:flex-row"
      }
    >
      {/* Honeypot — visually hidden, hidden from screen readers. Bots
          fill it; real users don't. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg bg-foreground px-3 text-xs font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            {ctaLabel}
            <ArrowRight className="h-3 w-3" />
          </>
        )}
      </button>
      {error ? (
        <p className="basis-full text-xs text-destructive-strong">
          {error}
        </p>
      ) : null}
    </form>
  );
}
