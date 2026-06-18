"use client";

/**
 * SupportTicketForm — unified "contact support" form.
 *
 * Creates a first-party ticket via `createTicketAction`. Works for both
 * authenticated users (in-app) and logged-out visitors (marketing contact
 * form / guest). On success it links the user to the conversation:
 *   - authenticated → /help/tickets/<id>
 *   - guest         → /support/t/<token>
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";

import { createTicketAction } from "../ticket-actions";
import type { TicketCategory, TicketChannel } from "../ticket-types";

const CATEGORY_OPTIONS: Array<{ value: TicketCategory; label: string; hint: string }> = [
  { value: "bug", label: "Bug / something is broken", hint: "Crashes, errors, broken behaviour" },
  { value: "billing", label: "Billing / payments", hint: "Refunds, double charges, invoices" },
  { value: "account", label: "Account / login", hint: "Can't sign in, MFA, account access" },
  { value: "how-to", label: "How do I…?", hint: "I can't figure out how to do X" },
  { value: "feature-request", label: "Feature request", hint: "I wish Stackivo could…" },
  { value: "onboarding", label: "Getting started", hint: "Stuck on first-day setup" },
];

interface Props {
  /** Default email for logged-out visitors. */
  initialEmail?: string;
  /** Show the email + name inputs (logged-out flow). */
  showContactFields?: boolean;
  /** Channel tag stored on the ticket. */
  channel?: TicketChannel;
}

export function SupportTicketForm({ initialEmail, showContactFields, channel }: Props) {
  const pathname = usePathname();
  const [category, setCategory] = React.useState<TicketCategory>("bug");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [email, setEmail] = React.useState(initialEmail ?? "");
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [success, setSuccess] = React.useState<{ href: string } | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (subject.trim().length < 3) {
      toast.error("Please add a short subject (3+ characters).");
      return;
    }
    if (message.trim().length < 5) {
      toast.error("Please add a little more detail (5+ characters).");
      return;
    }
    setPending(true);
    const res = await createTicketAction({
      category,
      subject: subject.trim(),
      message: message.trim(),
      channel: channel ?? (showContactFields ? "contact_form" : "in_app"),
      page: pathname ?? undefined,
      ...(showContactFields ? { email: email.trim(), name: name.trim() || undefined } : {}),
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not submit. Please email support@stackivo.me.");
      return;
    }
    const href = res.publicToken && showContactFields
      ? `/support/t/${res.publicToken}`
      : res.ticketId
        ? `/help/tickets/${res.ticketId}`
        : "/help";
    setSubject("");
    setMessage("");
    setSuccess({ href });
  };

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
        <h3 className="font-semibold text-emerald-700 dark:text-emerald-300">
          Got it — your ticket is in
        </h3>
        <p className="mt-1 text-muted-foreground">
          We&rsquo;ve sent a confirmation to your email. You can track the conversation
          and add anything you missed here.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link
            href={success.href}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/90"
          >
            View your ticket <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-xs font-medium text-emerald-700 underline hover:opacity-80 dark:text-emerald-300"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What&apos;s this about?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-xs transition hover:border-foreground/30 ${
                category === opt.value ? "border-foreground bg-muted/30" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={opt.value}
                checked={category === opt.value}
                onChange={() => setCategory(opt.value)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{opt.label}</span>
                <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {showContactFields ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="sup-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your name
            </label>
            <input
              id="sup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sup-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your email
            </label>
            <input
              id="sup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="sup-subject" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Subject
        </label>
        <input
          id="sup-subject"
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Razorpay checkout shows a blank page"
          className="block h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="sup-message" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tell us what&apos;s going on
        </label>
        <textarea
          id="sup-message"
          required
          maxLength={8000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder="Steps to reproduce, what went wrong, what you expected…"
          className="block w-full rounded-md border bg-background p-3 text-sm"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Plain text — you can attach screenshots by replying to the email.</span>
          <span>{message.length} / 8000</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {pending ? "Sending…" : "Send to support"}
      </button>
    </form>
  );
}
