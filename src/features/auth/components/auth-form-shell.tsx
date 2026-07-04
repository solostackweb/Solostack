import * as React from "react";
import Link from "next/link";
import { Briefcase, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared layout shell for auth form pages.
 *
 * Keeps titles, descriptions, and secondary CTAs visually consistent across
 * login / signup / forgot-password / reset-password.
 */
export function AuthFormShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-7", className)}>
      <div className="space-y-2 text-left">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
      {footer ? (
        <div className="text-left text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function AuthFormFooterLink({
  prefix,
  href,
  label,
}: {
  prefix: string;
  href: string;
  label: string;
}) {
  return (
    <>
      {prefix}{" "}
      <Link
        href={href}
        className="font-medium text-foreground hover:underline"
      >
        {label}
      </Link>
    </>
  );
}

/**
 * Freelancer / client portal switcher — sits above the auth card title so
 * the "I'm actually a client" path reads as a first-class choice in the
 * login flow instead of a bolted-on link buried under the form. Both tabs
 * are always real links (not a client-side toggle) since the two flows are
 * genuinely separate pages (password/OAuth login vs. one-time portal code).
 */
export function AuthModeSwitch({ active }: { active: "login" | "portal" }) {
  return (
    <div
      role="tablist"
      aria-label="Choose how you want to sign in"
      className="mb-6 flex gap-1 rounded-full border border-border bg-muted/50 p-1"
    >
      <Link
        href="/login"
        role="tab"
        aria-selected={active === "login"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
          active === "login"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Briefcase className="h-3.5 w-3.5" />
        Freelancer
      </Link>
      <Link
        href="/portal-access"
        role="tab"
        aria-selected={active === "portal"}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
          active === "portal"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        Client portal
      </Link>
    </div>
  );
}

/**
 * Inline form-level error — renders nothing when `message` is falsy so
 * callers can pass the server-action error directly.
 */
export function AuthFormError({ message }: { message?: string | null }) {
  const safeMessage =
    typeof message === "string" && message.trim() !== "{}" && message.trim() !== "[]"
      ? message
      : null;
  if (!safeMessage) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {safeMessage}
    </div>
  );
}

/**
 * Inline form-level success message.
 */
export function AuthFormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
    >
      {message}
    </div>
  );
}

/**
 * Visual "or" separator between OAuth and email/password flows.
 */
export function AuthOrSeparator() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
        <span className="bg-card px-2 text-muted-foreground">
          or continue with email
        </span>
      </div>
    </div>
  );
}
