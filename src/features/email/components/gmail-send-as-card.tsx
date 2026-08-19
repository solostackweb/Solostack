"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Link2, Mail, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "@/features/settings/components/settings-section";
import { setGmailSendAsAction } from "../gmail-send-as-actions";

export interface GmailSendAsCardState {
  /** Deployment has Google OAuth credentials at all. */
  configured: boolean;
  /** This user has a stored Google connection. */
  connected: boolean;
  /** The grant carries gmail.send — false means the connection predates it. */
  scopeGranted: boolean;
  enabled: boolean;
  email: string | null;
}

const RETURN_TO = "/dashboard/settings/notifications";

/**
 * Opt-in: send client-facing documents from the freelancer's own Gmail rather
 * than Stackivo's address. Lives with the other email settings because that's
 * what it is — a sender-identity choice, not an integration to manage.
 */
export function GmailSendAsCard({ state }: { state: GmailSendAsCardState }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [enabled, setEnabled] = React.useState(state.enabled);

  React.useEffect(() => {
    setEnabled(state.enabled);
  }, [state.enabled]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("connected") && !params.has("error")) return;
    if (params.get("connected")) toast.success("Google connected.");
    else toast.error("Couldn't finish connecting. Try again.");
    window.history.replaceState({}, "", RETURN_TO);
  }, []);

  if (!state.configured) return null;

  const needsReconnect = state.connected && !state.scopeGranted;
  const canToggle = state.connected && state.scopeGranted && !pending;

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setPending(true);
    const res = await setGmailSendAsAction({ enabled: next });
    setPending(false);
    if (!res.ok) {
      setEnabled(!next);
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Saved.");
    router.refresh();
  };

  return (
    <SettingsSection
      title="Send from your own email"
      description="Route invoices, contracts, proposals, and welcome documents through your Gmail address instead of Stackivo's."
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Mail className="h-4 w-4 text-primary" />
            {state.connected
              ? (state.email ?? "Google connected")
              : "Not connected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {!state.connected
              ? "Connect Google to send as yourself."
              : needsReconnect
                ? "Your Google connection was made before email sending was supported."
                : enabled
                  ? "Client documents send from this address."
                  : "Client documents send from Stackivo's address."}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          {!state.connected || needsReconnect ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/google/connect?next=${RETURN_TO}`}>
                {needsReconnect ? (
                  <>
                    <Link2 className="h-3.5 w-3.5" /> Reconnect
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" /> Connect Google
                  </>
                )}
              </a>
            </Button>
          ) : (
            <Switch
              checked={enabled}
              disabled={!canToggle}
              onCheckedChange={(next) => void toggle(next)}
              aria-label="Send client documents from my Gmail address"
            />
          )}
        </div>
      </div>

      {state.connected && state.scopeGranted ? (
        <div className="flex gap-2 rounded-lg border border-dashed bg-muted/20 p-3">
          <Info
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              A personal Gmail address has no sending reputation of its own, so
              a first email to a new client can land in their spam folder — more
              often than mail sent through Stackivo. It usually settles once
              they&apos;ve replied to you at least once.
            </p>
            <p>
              Tell a new client to check spam for your first document and mark
              it{" "}
              <span className="font-medium text-foreground">Not spam</span>. If
              you have your own domain, sending from that is more reliable than
              a personal Gmail.
            </p>
          </div>
        </div>
      ) : null}

      {state.connected && !needsReconnect ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
            <a href={`/api/google/connect?next=${RETURN_TO}`}>
              <Unlink className="h-3.5 w-3.5" /> Re-authorise Google
            </a>
          </Button>
        </div>
      ) : null}
    </SettingsSection>
  );
}
