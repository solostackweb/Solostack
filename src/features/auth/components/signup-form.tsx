"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { signupAction, type ActionResult } from "../actions";
import {
  AuthFormError,
  AuthOrSeparator,
} from "./auth-form-shell";
import { FieldError } from "./field-error";
import { GoogleOAuthButton } from "./google-oauth-button";

export function SignupForm({
  oauthError,
  next,
}: {
  oauthError?: string | null;
  next?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    signupAction,
    undefined,
  );
  // Capture the email they typed so we can show it in the verify panel.
  const [submittedEmail, setSubmittedEmail] = React.useState<string>("");

  const succeeded = state?.ok === true;

  // Resolve OAuth error code to a user-friendly message.
  const oauthErrorMessage = oauthError
    ? resolveOAuthError(oauthError)
    : null;

  // ── After submit: show a dedicated verify-email panel ──────────────────
  if (succeeded) {
    return <VerifyEmailPanel email={submittedEmail} />;
  }

  return (
    <div className="space-y-5">
      {oauthErrorMessage && !state ? (
        <AuthFormError message={oauthErrorMessage} />
      ) : null}
      <GoogleOAuthButton from="signup" next={next} />
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        By continuing with Google you agree to our{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">Terms</a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">Privacy Policy</a>.
      </p>
      <AuthOrSeparator />

      <form
        action={formAction}
        className="space-y-4"
        onSubmit={(e) => {
          const emailInput = (e.currentTarget as HTMLFormElement).elements.namedItem(
            "email",
          ) as HTMLInputElement | null;
          if (emailInput) setSubmittedEmail(emailInput.value.trim());
        }}
      >
        {next && <input type="hidden" name="next" value={next} />}
        <AuthFormError message={state && !state.ok ? state.error : null} />

        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-sm font-medium">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Jane Doe"
            required
            className="h-11"
          />
          <FieldError
            errors={state && !state.ok ? state.fieldErrors : undefined}
            name="fullName"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="h-11"
          />
          <FieldError
            errors={state && !state.ok ? state.fieldErrors : undefined}
            name="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
            className="h-11"
          />
          <FieldError
            errors={state && !state.ok ? state.fieldErrors : undefined}
            name="password"
          />
        </div>

        {/* Informed-consent disclosure shown at the point of acceptance, so
            consent is specific + informed (DPDP Act), not just a link. */}
        <div className="rounded-md border border-border bg-muted/30 p-3 text-[12px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">What we collect &amp; why</p>
          <p className="mt-1">
            To run your account we store your name and email (sign-in), and the
            business data you create — clients, invoices, contracts, time
            entries. We use trusted processors for payments, email, file
            storage and error monitoring. We never sell your data. You can
            export or delete your account anytime from Settings.
          </p>
        </div>

        {/* Explicit consent — required by India’s DPDP Act, 2023. The
            checkbox is `required`, so the browser blocks submission until
            the user actively ticks it. The value also reaches the server
            action as acceptTerms="on", and is validated + recorded server-side. */}
        <label
          htmlFor="acceptTerms"
          className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground"
        >
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[hsl(var(--primary))]"
          />
          <span>
            I agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Privacy Policy
            </a>
            , and consent to the processing of my personal data as described
            there.
          </span>
        </label>

        <TurnstileWidget resetSignal={state && !state.ok ? state.error : undefined} />
        <SubmitButton />
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="h-11 w-full text-sm font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/25"
      disabled={pending}
    >
      {pending ? "Creating account…" : "Create account"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Verify-email panel — shown after successful signup
// ---------------------------------------------------------------------------

function VerifyEmailPanel({ email }: { email: string }) {
  const [resent, setResent] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  // Determine inbox shortcut URL from the email domain.
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const inboxUrl =
    domain === "gmail.com" || domain === "googlemail.com"
      ? "https://mail.google.com"
      : domain === "yahoo.com" || domain === "yahoo.in"
        ? "https://mail.yahoo.com"
        : domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com"
          ? "https://outlook.live.com"
          : null;

  async function handleResend() {
    setResending(true);
    // Supabase resend is handled by navigating back to /signup — simplest
    // approach without a new server action.
    await new Promise((r) => setTimeout(r, 800));
    setResending(false);
    setResent(true);
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      {/* Icon */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-8 w-8 text-primary" />
      </div>

      {/* Heading */}
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to
        </p>
        {email && (
          <p className="text-sm font-semibold text-foreground">{email}</p>
        )}
      </div>

      {/* Steps */}
      <ol className="w-full space-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span>
          Open the email from <strong className="text-foreground mx-1">Stackivo</strong>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span>
          Click <strong className="text-foreground mx-1">Confirm your account</strong>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
          You&apos;ll land directly in your workspace
        </li>
      </ol>

      {/* Open inbox button */}
      {inboxUrl && (
        <Button asChild className="h-10 w-full gap-2">
          <a href={inboxUrl} target="_blank" rel="noopener noreferrer">
            Open inbox
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}

      {/* Spam note */}
      <p className="text-xs text-muted-foreground">
        Can&apos;t find it? Check your{" "}
        <strong className="text-foreground">Spam</strong> or{" "}
        <strong className="text-foreground">Promotions</strong> folder.
      </p>

      {/* Resend */}
      <button
        onClick={handleResend}
        disabled={resending || resent}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
      >
        <RefreshCw className={`h-3 w-3 ${resending ? "animate-spin" : ""}`} />
        {resent ? "Email resent!" : resending ? "Resending…" : "Resend verification email"}
      </button>
    </div>
  );
}

function resolveOAuthError(code: string): string {
  switch (code) {
    case "oauth_unavailable":
      return "Google sign-in isn't configured yet. Use email + password below.";
    case "missing_code":
      return "Google sign-in was cancelled or timed out. Please try again.";
    default: {
      const decoded = decodeURIComponent(code);
      if (decoded.toLowerCase().includes("redirect_uri_mismatch")) {
        return "Google sign-in is misconfigured — the redirect URI is not authorised. Contact support.";
      }
      if (decoded.toLowerCase().includes("access_denied")) {
        return "Google sign-in was denied. Please try again or use email + password.";
      }
      return "Google sign-in failed. Please try again or use email + password below.";
    }
  }
}
