"use client";

/**
 * /admin/mfa client.
 *
 * Three states the page can be in:
 *   1. No factors    → show "Enroll" button → on click, start enrollment
 *                       and render QR + secret + 6-digit verify form.
 *   2. Unverified    → "Pending verification" + verify form.
 *   3. Verified      → green status + list of factors.
 *
 * Supabase's MFA challenge re-uses the same factor id across page
 * reloads as long as it isn't deleted, so the QR is safe to re-render.
 */

import * as React from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";

import {
  startTotpEnrollmentAction,
  verifyTotpEnrollmentAction,
  unenrollFactorAction,
  type MfaStatus,
} from "@/features/admin/mfa";

interface Props {
  status: MfaStatus;
}

export function MfaEnrollFlow({ status }: Props) {
  const router = useRouter();
  const verified = status.factors.filter((f) => f.status === "verified");
  const pending = status.factors.filter((f) => f.status === "unverified");

  if (status.currentAal === "aal2") {
    return (
      <AalSatisfied
        verified={verified}
        onChange={() => router.refresh()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4" />
          Multi-factor authentication required
        </div>
        <p className="mt-1 text-muted-foreground">
          Admin sessions in production must be stepped up to AAL2. Enroll a
          TOTP authenticator (1Password, Authy, Google Authenticator, etc.)
          and verify a 6-digit code below.
        </p>
      </div>

      {pending.length > 0 ? (
        <ResumeEnrollment factorId={pending[0]!.id} router={router} />
      ) : (
        <NewEnrollment router={router} />
      )}

      {verified.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Existing verified factors
          </h2>
          <FactorList factors={verified} onChange={() => router.refresh()} />
          <p className="text-[11px] text-muted-foreground">
            You already have a verified factor but the current session is
            still AAL1. Sign out and back in — Supabase will prompt for the
            6-digit code at login.
          </p>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AalSatisfied({
  verified,
  onChange,
}: {
  verified: MfaStatus["factors"];
  onChange: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
          AAL2 satisfied for this session
        </div>
        <p className="mt-1 text-muted-foreground">
          You can access the full console. Each new login will re-prompt for
          the TOTP code.
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Verified factors
        </h2>
        <FactorList factors={verified} onChange={onChange} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewEnrollment({ router }: { router: ReturnType<typeof useRouter> }) {
  const [pending, setPending] = React.useState(false);
  const [factor, setFactor] = React.useState<
    | {
        factorId: string;
        uri: string;
        secret: string;
      }
    | null
  >(null);

  if (!factor) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const res = await startTotpEnrollmentAction();
          setPending(false);
          if (!res.ok || !res.factorId || !res.uri || !res.secret) {
            toast.error(res.error ?? "Could not start enrollment");
            return;
          }
          setFactor({
            factorId: res.factorId,
            uri: res.uri,
            secret: res.secret,
          });
        }}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Start TOTP enrollment
      </button>
    );
  }

  return <VerifyStep factor={factor} router={router} />;
}

function ResumeEnrollment({
  factorId,
  router,
}: {
  factorId: string;
  router: ReturnType<typeof useRouter>;
}) {
  // We can't display the original QR for an existing pending factor —
  // Supabase only returns the otpauth URI at enrollment time. So we
  // show a 6-digit-code-entry form directly and let the admin paste
  // the code from whatever app they were setting up.
  return (
    <div className="space-y-3 rounded-xl border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs">
      <div className="font-medium">Resume pending enrollment</div>
      <p className="text-muted-foreground">
        A TOTP enrollment was started but not verified. Open the
        authenticator app you scanned during the previous attempt and enter
        the current 6-digit code below to complete enrollment.
      </p>
      <VerifyCodeForm factorId={factorId} router={router} />
      <p className="text-[11px] text-muted-foreground">
        Lost access?{" "}
        <button
          type="button"
          onClick={async () => {
            const res = await unenrollFactorAction(factorId);
            if (res.ok) router.refresh();
            else toast.error(res.error ?? "Could not remove factor");
          }}
          className="text-foreground underline hover:opacity-80"
        >
          Discard this enrollment
        </button>{" "}
        and start fresh.
      </p>
    </div>
  );
}

function VerifyStep({
  factor,
  router,
}: {
  factor: { factorId: string; uri: string; secret: string };
  router: ReturnType<typeof useRouter>;
}) {
  // Build a Google Charts QR URL via the otpauth URI. We deliberately
  // avoid adding a qrcode npm package — the chart URL works in every
  // production-quality authenticator.
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    factor.uri,
  )}`;
  return (
    <div className="space-y-3 rounded-xl border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs">
      <div className="font-medium">Scan with your authenticator</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qr}
          alt="TOTP QR code"
          width={200}
          height={200}
          className="rounded border bg-white"
        />
        <div className="space-y-2">
          <p className="text-muted-foreground">
            Or paste this secret manually into your app:
          </p>
          <code className="block break-all rounded bg-muted/40 px-2 py-1.5 font-mono">
            {factor.secret}
          </code>
          <p className="text-[11px] text-muted-foreground">
            Once added, enter the current 6-digit code to verify and lock
            this factor in.
          </p>
        </div>
      </div>
      <VerifyCodeForm factorId={factor.factorId} router={router} />
    </div>
  );
}

function VerifyCodeForm({
  factorId,
  router,
}: {
  factorId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  return (
    <form
      action={async () => {
        if (!/^\d{6}$/.test(code)) {
          toast.error("Enter the 6-digit code.");
          return;
        }
        setPending(true);
        const res = await verifyTotpEnrollmentAction({ factorId, code });
        setPending(false);
        if (res.ok) {
          toast.success("Factor verified — refreshing…");
          setCode("");
          router.refresh();
        } else {
          toast.error(res.error ?? "Verification failed");
        }
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        pattern="\d{6}"
        placeholder="123456"
        className="h-8 w-28 rounded border bg-background px-2 text-center font-mono tabular-nums"
      />
      <button
        type="submit"
        disabled={pending || code.length !== 6}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Verify
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function FactorList({
  factors,
  onChange,
}: {
  factors: MfaStatus["factors"];
  onChange: () => void;
}) {
  const confirm = useConfirm();
  if (factors.length === 0) return null;
  return (
    <ul className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03] text-xs">
      {factors.map((f) => (
        <li
          key={f.id}
          className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">
              {f.friendly_name ?? "TOTP factor"}
            </span>
            <span className="font-mono text-muted-foreground">
              {f.id.slice(0, 8)}…
            </span>
            <span className="text-muted-foreground">
              added {new Date(f.created_at).toLocaleDateString()}
            </span>
          </div>
          <form
            action={async () => {
              if (factors.length === 1) {
                toast.error(
                  "Can't remove the last verified factor — admins would be locked out.",
                );
                return;
              }
              const ok = await confirm({
                title: "Remove this factor?",
                description:
                  "You'll need another verified factor to keep admin access.",
                confirmLabel: "Remove",
                variant: "destructive",
              });
              if (!ok) return;
              const res = await unenrollFactorAction(f.id);
              if (res.ok) {
                toast.success("Factor removed");
                onChange();
              } else {
                toast.error(res.error ?? "Could not remove factor");
              }
            }}
          >
            <button
              type="submit"
              className="inline-flex h-6 items-center gap-1 rounded border border-red-500/30 px-2 text-red-700 hover:bg-red-500/10 dark:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
