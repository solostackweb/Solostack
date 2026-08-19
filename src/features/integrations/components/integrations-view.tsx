"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, Info, Link2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IntegrationLogoTile } from "@/components/integrations/integration-logo";
import {
  SettingsPageHeader,
  SettingsSection,
} from "@/features/settings/components/settings-section";
import { disconnectCalendarAction } from "@/features/scheduling/actions";
import { setGmailSendAsAction } from "../actions";
import { cn } from "@/lib/utils";

const HUB_PATH = "/dashboard/settings/integrations";

export interface IntegrationsViewState {
  google: {
    configured: boolean;
    tokenStorageReady: boolean;
    connected: boolean;
    email: string | null;
  };
  gmail: {
    connected: boolean;
    scopeGranted: boolean;
    enabled: boolean;
    email: string | null;
  };
  daily: { configured: boolean };
  zoom: { configured: boolean };
}

/**
 * Every state a card can be in. `unavailable` and `planned` are deliberately
 * distinct: one means "your deployment is missing credentials", the other
 * means "Stackivo hasn't built this yet". Collapsing them is how the old
 * hardcoded page ended up claiming Google Calendar was ready when there was
 * no connect action on the page at all.
 */
type CardStatus =
  | "connected"
  | "not_connected"
  | "unavailable"
  | "active"
  | "planned";

const STATUS_LABEL: Record<CardStatus, string> = {
  connected: "Connected",
  not_connected: "Not connected",
  unavailable: "Not set up on this deployment",
  active: "Active",
  planned: "Coming soon",
};

const STATUS_STYLE: Record<CardStatus, string> = {
  connected: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  not_connected: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  unavailable: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  planned: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: CardStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function CapabilityRow({
  label,
  live,
  note,
}: {
  label: string;
  live: boolean;
  note: string;
}) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
          live ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className={cn("font-medium", !live && "text-muted-foreground")}>
          {label}
        </span>
        <span className="text-muted-foreground"> — {note}</span>
      </span>
    </li>
  );
}

function IntegrationCard({
  logoId,
  title,
  status,
  description,
  children,
  actions,
}: {
  logoId: string;
  title: string;
  status: CardStatus;
  description: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border bg-background p-4">
      <div className="flex items-start gap-3">
        <IntegrationLogoTile id={logoId} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
      {actions ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-4">{actions}</div>
      ) : null}
    </article>
  );
}

/**
 * Gmail send-as, as an actual switch rather than a claim.
 *
 * Three states matter and each reads differently: not connected, connected on
 * an older grant that predates the gmail.send scope (needs a reconnect), and
 * ready. When it's on, the card states plainly which address clients will see
 * — this silently changes something client-facing, so it shouldn't be
 * discoverable only by sending an invoice and noticing.
 */
function GmailSendAsRow({
  gmail,
}: {
  gmail: {
    connected: boolean;
    scopeGranted: boolean;
    enabled: boolean;
    email: string | null;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [enabled, setEnabled] = React.useState(gmail.enabled);

  React.useEffect(() => {
    setEnabled(gmail.enabled);
  }, [gmail.enabled]);

  const needsReconnect = gmail.connected && !gmail.scopeGranted;
  const canToggle = gmail.connected && gmail.scopeGranted && !pending;

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

  const note = !gmail.connected
    ? "needs a Google connection"
    : needsReconnect
      ? "reconnect Google to allow sending — your connection predates it"
      : enabled
        ? `invoices, contracts, and proposals send from ${gmail.email ?? "your Gmail address"}`
        : "off — client documents send from Stackivo's address";

  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
          enabled && canToggle ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "font-medium",
            !(enabled && canToggle) && "text-muted-foreground",
          )}
        >
          Send email as you
        </span>
        <span className="text-muted-foreground"> — {note}</span>
      </span>
      <Switch
        checked={enabled}
        disabled={!canToggle}
        onCheckedChange={(next) => void toggle(next)}
        aria-label="Send client documents from my Gmail address"
      />
    </li>
  );
}

/**
 * The honest caveat that belongs beside the switch, not in a support article.
 *
 * Sending as a personal Gmail is authenticated correctly (SPF/DKIM/DMARC all
 * pass), but a personal address carries no domain reputation, and a branded
 * document email with an attachment from one — to a client who has never
 * replied — is shaped like the phishing filters are built to catch. Telling
 * people up front costs one paragraph; letting them discover it via an
 * invoice a client never saw costs a lot more.
 */
function GmailSendAsNotice({
  enabled,
  email,
}: {
  enabled: boolean;
  email: string | null;
}) {
  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-dashed bg-muted/20 p-3">
      <Info
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        {enabled ? (
          <p>
            <span className="font-medium text-foreground">
              Every invoice, contract, proposal, and welcome document now sends
              from {email ?? "your Gmail address"}.
            </span>{" "}
            Clients see that address instead of Stackivo&apos;s.
          </p>
        ) : (
          <p>
            <span className="font-medium text-foreground">
              Before you turn this on:
            </span>{" "}
            your documents would send from your own Gmail address instead of
            Stackivo&apos;s.
          </p>
        )}
        <p>
          A personal Gmail address has no sending reputation of its own, so a
          first email to a new client can land in their spam folder — more
          often than mail sent through Stackivo. It usually settles once
          they&apos;ve replied to you at least once.
        </p>
        <p>
          Worth doing either way: tell a new client to check spam for your
          first document and mark it{" "}
          <span className="font-medium text-foreground">Not spam</span>. If you
          have your own domain, sending from that is more reliable than a
          personal Gmail.
        </p>
      </div>
    </div>
  );
}

export function IntegrationsView({ state }: { state: IntegrationsViewState }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const { google, gmail, daily, zoom } = state;

  // Surface the outcome of the OAuth round trip. The connect/callback routes
  // return here with ?connected=1 or ?error=<reason>.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("connected") && !params.has("error")) return;

    if (params.get("connected")) {
      toast.success("Google connected.");
    } else {
      const error = params.get("error");
      if (error === "not_configured") {
        toast.error("Google isn't set up on this deployment yet.");
      } else if (error === "storage") {
        toast.error(
          "Can't store the connection securely — TOKEN_ENCRYPTION_KEY is missing.",
        );
      } else if (error === "state") {
        toast.error("That connection attempt expired. Try again.");
      } else {
        toast.error("Couldn't finish connecting. Try again.");
      }
    }
    // Clear the query so a refresh doesn't re-fire the toast.
    window.history.replaceState({}, "", HUB_PATH);
  }, []);

  const disconnectGoogle = async () => {
    setDisconnecting(true);
    const res = await disconnectCalendarAction();
    setDisconnecting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "Disconnected.");
    router.refresh();
  };

  const googleBlocked = !google.configured || !google.tokenStorageReady;
  const googleStatus: CardStatus = googleBlocked
    ? "unavailable"
    : google.connected
      ? "connected"
      : "not_connected";

  const googleDescription = googleBlocked
    ? google.configured
      ? "Google OAuth credentials are set, but TOKEN_ENCRYPTION_KEY is missing so the connection can't be stored securely. Add it to your environment to enable this."
      : "Live availability and Meet links need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT in your environment. Until then, meetings use manual time slots."
    : google.connected
      ? `Connected${google.email ? ` as ${google.email}` : ""}. Clients book against your real open times and busy blocks stay private.`
      : "Connect once to unlock live availability, automatic calendar events, and Google Meet links on booked calls.";

  return (
    <>
      <SettingsPageHeader
        title="Integrations"
        description="Everything Stackivo can connect to, with its real status. Connect once here — no hunting through other settings pages."
      />

      <div className="space-y-5">
        <SettingsSection
          title="Your connections"
          description="Live state, read from your account — not a checklist."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            <IntegrationCard
              logoId="google_calendar"
              title="Google — Calendar, Meet & Gmail"
              status={googleStatus}
              description={googleDescription}
              actions={
                googleBlocked ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/meetings/availability">
                      Use manual time slots
                    </Link>
                  </Button>
                ) : google.connected ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={disconnectGoogle}
                      disabled={disconnecting}
                    >
                      {disconnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unlink className="h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </Button>
                    {gmail.connected && !gmail.scopeGranted ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/google/connect?next=${HUB_PATH}`}>
                          <Link2 className="h-3.5 w-3.5" /> Reconnect for email
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/dashboard/meetings/availability">
                        <CalendarCheck className="h-3.5 w-3.5" /> Working hours
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild size="sm">
                    <a href={`/api/google/connect?next=${HUB_PATH}`}>
                      <Link2 className="h-3.5 w-3.5" /> Connect Google
                    </a>
                  </Button>
                )
              }
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                One connection, three capabilities
              </p>
              <ul className="space-y-2">
                <CapabilityRow
                  label="Calendar availability"
                  live={google.connected}
                  note={
                    google.connected
                      ? "clients see only your genuinely free slots"
                      : "clients pick from time slots you type in by hand"
                  }
                />
                <CapabilityRow
                  label="Google Meet links"
                  live={google.connected}
                  note={
                    google.connected
                      ? "pick Meet on any call and the link is generated on booking"
                      : "needs a Google connection"
                  }
                />
                <GmailSendAsRow gmail={gmail} />
              </ul>
              {gmail.connected && gmail.scopeGranted ? (
                <GmailSendAsNotice
                  enabled={gmail.enabled}
                  email={gmail.email}
                />
              ) : null}
            </IntegrationCard>

            <IntegrationCard
              logoId="daily"
              title="Daily.co — in-app video"
              status={daily.configured ? "active" : "unavailable"}
              description={
                daily.configured
                  ? "Meetings get an embedded video room inside Stackivo. This is the default — clients join in the browser, no downloads."
                  : "Set DAILY_API_KEY to give every meeting an embedded video room. Without it, meetings fall back to a link you paste in yourself."
              }
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/meetings">Open meetings</Link>
                </Button>
              }
            />

            <IntegrationCard
              logoId="zoom"
              title="Zoom"
              status={zoom.configured ? "active" : "unavailable"}
              description={
                zoom.configured
                  ? "Pick Zoom when scheduling a call and a real Zoom meeting is created the moment your client confirms a time. Runs on Stackivo's Zoom account — nothing for you to connect."
                  : "Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to offer Zoom as a meeting option. Until then it's hidden when scheduling."
              }
              actions={
                zoom.configured ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/meetings/new">Schedule a call</Link>
                  </Button>
                ) : undefined
              }
            />

            <IntegrationCard
              logoId="razorpay"
              title="Payments"
              status="active"
              description="Razorpay handles UPI, cards, and netbanking for domestic invoices. Add Wise, PayPal, or bank instructions for export invoices."
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/settings/payments">
                    Payment settings
                  </Link>
                </Button>
              }
            />

            <IntegrationCard
              logoId="email"
              title="Email delivery"
              status="active"
              description="Invoices, contracts, portal invites, and reminders send through Stackivo's transactional email. Always on, nothing to connect."
              actions={
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/settings/notifications">
                    Notification settings
                  </Link>
                </Button>
              }
            />
          </div>
        </SettingsSection>

        <SettingsSection
          title="On the roadmap"
          description="Named here so you know what isn't available yet, rather than finding out mid-task."
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              {
                title: "Outlook Calendar",
                note: "Same availability sync for freelancers who don't use Google.",
              },
            ].map((item) => (
              <li key={item.title} className="rounded-xl border bg-background p-3">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>
    </>
  );
}
