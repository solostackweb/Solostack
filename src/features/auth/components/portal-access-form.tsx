"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPortalCodeAction,
  verifyPortalCodeAction,
  type ActionResult,
} from "../actions";
import { AuthFormError, AuthFormSuccess } from "./auth-form-shell";
import { Mail, KeyRound } from "lucide-react";

/**
 * Standalone client portal access form.
 * Lives at /portal-access — separated from the freelancer login flow
 * so the experience is clean and purpose-built for clients.
 *
 * Flow: enter email → receive OTP → enter code → enter portal.
 */
export function PortalAccessForm() {
  const [portalEmail, setPortalEmail] = React.useState("");
  const [codeSent, setCodeSent] = React.useState(false);

  const [requestState, requestCodeAction] = useActionState<
    ActionResult<{ email: string }> | undefined,
    FormData
  >(requestPortalCodeAction, undefined);

  const [verifyState, verifyCodeAction] = useActionState<
    ActionResult | undefined,
    FormData
  >(verifyPortalCodeAction, undefined);

  React.useEffect(() => {
    if (requestState?.ok && requestState.data?.email) {
      setPortalEmail(requestState.data.email);
      setCodeSent(true);
    }
  }, [requestState]);

  return (
    <div className="space-y-6">
      {/* Step 1: Email */}
      <form action={requestCodeAction} className="space-y-4">
        <AuthFormError
          message={requestState && !requestState.ok ? requestState.error : null}
        />
        {codeSent ? (
          <AuthFormSuccess
            message={`A one-time code was sent to ${portalEmail}. Check your inbox.`}
          />
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="portal-email" className="text-sm font-medium">
            Your email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="portal-email"
              name="portalEmail"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={portalEmail}
              onChange={(e) => setPortalEmail(e.target.value)}
              required
              className="h-11 pl-10"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Use the email address your freelancer used to invite you.
          </p>
        </div>

        <SendCodeButton codeSent={codeSent} />
      </form>

      {/* Step 2: OTP code — revealed after email is sent */}
      {codeSent ? (
        <form action={verifyCodeAction} className="space-y-4">
          <input type="hidden" name="portalEmail" value={portalEmail} />
          <AuthFormError
            message={verifyState && !verifyState.ok ? verifyState.error : null}
          />
          <div className="space-y-2">
            <Label htmlFor="portal-code" className="text-sm font-medium">
              One-time code
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="portal-code"
                name="portalCode"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                placeholder="8-digit code"
                required
                className="h-11 pl-10 tracking-[0.25em] font-mono"
              />
            </div>
          </div>
          <OpenPortalButton />
        </form>
      ) : null}
    </div>
  );
}

function SendCodeButton({ codeSent }: { codeSent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="h-11 w-full text-sm font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/25"
      disabled={pending}
    >
      {pending ? "Sending code…" : codeSent ? "Resend code" : "Send access code"}
    </Button>
  );
}

function OpenPortalButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="h-11 w-full text-sm font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/25"
      disabled={pending}
    >
      {pending ? "Opening portal…" : "Open my portal"}
    </Button>
  );
}
