"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  connectRazorpayPaymentsAction,
  disconnectRazorpayPaymentsAction,
  reverifyRazorpayPaymentsAction,
  type ActionResult,
} from "../actions-payments";
import type { UserRazorpayAccount } from "../razorpay/user-account";

export function PaymentsConnectForm({
  account,
}: {
  account: UserRazorpayAccount | null;
}) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(
    connectRazorpayPaymentsAction,
    undefined,
  );

  const isConnected = account?.status === "connected";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Razorpay account</p>
            <p className="text-xs text-muted-foreground">
              Status:{" "}
              <StatusPill
                status={account?.status ?? "unverified"}
                testMode={account?.testMode ?? true}
              />
            </p>
            {account?.keyId ? (
              <p className="font-mono text-xs text-muted-foreground">
                {account.keyId}
              </p>
            ) : null}
          </div>
          {isConnected ? (
            <div className="flex gap-2">
              <ReverifyButton />
              <DisconnectButton />
            </div>
          ) : null}
        </div>
      </div>

      <form action={action} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold">
            {isConnected ? "Update credentials" : "Connect Razorpay"}
          </p>
          <p className="text-xs text-muted-foreground">
            Paste the Key Id + Secret from your Razorpay dashboard. We
            verify the keys with Razorpay before saving.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="keyId">Key Id</Label>
            <Input
              id="keyId"
              name="keyId"
              placeholder="rzp_test_XXXXXXXXXXXX"
              required
              autoComplete="off"
              defaultValue={account?.keyId ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="keySecret">Key Secret</Label>
            <Input
              id="keySecret"
              name="keySecret"
              placeholder="••••••••••••••••"
              type="password"
              required
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Stored encrypted. Never shown to clients or the browser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
          <Switch
            id="testMode"
            name="testMode"
            defaultChecked={account?.testMode ?? true}
            value="on"
          />
          <Label
            htmlFor="testMode"
            className="text-xs font-medium text-muted-foreground"
          >
            Test mode — only `rzp_test_*` keys; no real money moves.
          </Label>
        </div>

        {state && !state.ok ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
        {state && state.ok ? (
          <p className="rounded-lg bg-success-subtle p-3 text-xs text-success-strong">
            {state.message ?? "Saved."}
          </p>
        ) : null}

        <SubmitButton isConnected={isConnected} />
      </form>
    </div>
  );
}

function SubmitButton({ isConnected }: { isConnected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex justify-end">
      <Button type="submit" disabled={pending}>
        {pending
          ? "Verifying…"
          : isConnected
            ? "Update credentials"
            : "Connect & verify"}
      </Button>
    </div>
  );
}

function ReverifyButton() {
  const [pending, start] = React.useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        start(async () => {
          const r = await reverifyRazorpayPaymentsAction();
          setMsg(r.ok ? r.message ?? "Verified." : r.error);
        });
      }}
      disabled={pending}
    >
      {pending ? "Checking…" : msg ?? "Re-verify"}
    </Button>
  );
}

function DisconnectButton() {
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const ok = await confirm({
          title: "Disconnect Razorpay?",
          description: "Clients won't be able to pay until you reconnect.",
          confirmLabel: "Disconnect",
          variant: "destructive",
        });
        if (!ok) return;
        start(async () => {
          await disconnectRazorpayPaymentsAction();
        });
      }}
      disabled={pending}
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}

function StatusPill({
  status,
  testMode,
}: {
  status: UserRazorpayAccount["status"];
  testMode: boolean;
}) {
  const map: Record<UserRazorpayAccount["status"], { label: string; cls: string }> = {
    unverified: {
      label: "Not connected",
      cls: "bg-muted text-muted-foreground",
    },
    connected: {
      label: testMode ? "Connected (test)" : "Connected (live)",
      cls: testMode
        ? "bg-warning-subtle text-warning-strong"
        : "bg-success-subtle text-success-strong",
    },
    invalid: {
      label: "Invalid keys",
      cls: "bg-destructive/15 text-destructive",
    },
    revoked: {
      label: "Revoked",
      cls: "bg-muted text-muted-foreground",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
