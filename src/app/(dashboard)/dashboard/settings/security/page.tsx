"use client";

import * as React from "react";
import { Monitor, Smartphone, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  SettingsSection,
  SettingsField,
  SettingsPageHeader,
  SettingsToggleRow,
} from "@/features/settings/components/settings-section";
import {
  changePasswordAction,
  signOutOtherSessionsAction,
} from "@/features/settings/actions";

export default function SecuritySettingsPage() {
  // ── Password change ────────────────────────────────────────────────────────
  const [pwPending, setPwPending] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const pwFormRef = React.useRef<HTMLFormElement>(null);

  async function handlePasswordSave() {
    if (!pwFormRef.current) return;
    const fd = new FormData(pwFormRef.current);

    const newPw = fd.get("newPassword") as string;
    const confirmPw = fd.get("confirmPassword") as string;
    if (!newPw || newPw.length < 12) {
      setPwError("New password must be at least 12 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("Passwords don't match.");
      return;
    }

    setPwError(null);
    setPwPending(true);
    try {
      const res = await changePasswordAction(fd);
      if (res.ok) {
        toast.success("Password updated.");
        pwFormRef.current.reset();
      } else {
        setPwError(res.error ?? "Something went wrong.");
      }
    } finally {
      setPwPending(false);
    }
  }

  // ── Sign out other sessions ────────────────────────────────────────────────
  const [signOutPending, setSignOutPending] = React.useState(false);

  async function handleSignOutEverywhere() {
    setSignOutPending(true);
    try {
      const res = await signOutOtherSessionsAction();
      if (res.ok) {
        toast.success("Signed out of all other sessions.");
      } else {
        toast.error(res.error ?? "Couldn't sign out other sessions.");
      }
    } finally {
      setSignOutPending(false);
    }
  }

  return (
    <>
      <SettingsPageHeader
        title="Security"
        description="Protect your account and manage active sessions."
      />

      {/* ── Password change ──────────────────────────────────────────────── */}
      <form ref={pwFormRef}>
        <SettingsSection
          title="Change password"
          description="Use a unique password you don't use anywhere else. Minimum 12 characters."
          onSave={handlePasswordSave}
          saveLabel="Save password"
          isSubmitting={pwPending}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <SettingsField
              label="New password"
              hint="At least 12 characters"
            >
              <Input
                type="password"
                name="newPassword"
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
            </SettingsField>
            <SettingsField label="Confirm new password">
              <Input
                type="password"
                name="confirmPassword"
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
            </SettingsField>
          </div>
          {pwError && (
            <p className="mt-1 text-sm text-destructive">{pwError}</p>
          )}
        </SettingsSection>
      </form>

      {/* ── 2FA — disabled until TOTP enrollment flow is built ──────────── */}
      <SettingsSection
        title="Two-factor authentication"
        description="Additional verification when signing in from a new device."
        badge="Coming soon"
      >
        <SettingsToggleRow
          label="Authenticator app"
          description="Use Authy, 1Password, or Google Authenticator to generate codes."
        >
          <Switch disabled aria-disabled />
        </SettingsToggleRow>
        <SettingsToggleRow
          label="SMS backup"
          description="Receive a one-time code via text message as a fallback."
        >
          <Switch disabled aria-disabled />
        </SettingsToggleRow>
      </SettingsSection>

      {/* ── Active sessions ──────────────────────────────────────────────── */}
      <SettingsSection
        title="Active sessions"
        description="This device's current session. Use the button to revoke all other active sessions."
        headerAction={
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutEverywhere}
            disabled={signOutPending}
          >
            {signOutPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Monitor className="mr-2 h-3.5 w-3.5" />
            )}
            Sign out everywhere
          </Button>
        }
      >
        <CurrentSessionRow />
      </SettingsSection>
    </>
  );
}

/**
 * Derives the current device/browser from the UA string and renders it
 * as a single truthful session row. Supabase's client SDK doesn't expose
 * a session list — full multi-session management requires the admin API.
 * For now we show the current session and let "Sign out everywhere"
 * revoke all others via signOut({ scope: "others" }).
 */
function CurrentSessionRow() {
  const [ua, setUa] = React.useState<{
    device: string;
    icon: "monitor" | "phone";
  }>({ device: "This device", icon: "monitor" });

  React.useEffect(() => {
    const u = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(u);
    const browser = /Edg/i.test(u)
      ? "Edge"
      : /Chrome/i.test(u)
        ? "Chrome"
        : /Safari/i.test(u)
          ? "Safari"
          : /Firefox/i.test(u)
            ? "Firefox"
            : "Browser";
    const os = /Windows/i.test(u)
      ? "Windows"
      : /Mac OS/i.test(u)
        ? "Mac"
        : /Android/i.test(u)
          ? "Android"
          : /iPhone|iPad/i.test(u)
            ? "iOS"
            : /Linux/i.test(u)
              ? "Linux"
              : "Device";
    setUa({ device: `${os} · ${browser}`, icon: isMobile ? "phone" : "monitor" });
  }, []);

  const Icon = ua.icon === "phone" ? Smartphone : Monitor;

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{ua.device}</p>
          <Badge variant="secondary" className="h-5 px-1.5 text-micro">
            This device
          </Badge>
        </div>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Active now
        </p>
      </div>
    </div>
  );
}
