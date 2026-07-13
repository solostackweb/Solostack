"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Download, Share, Plus, X } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { Button } from "@/components/ui/button";
import {
  useDismissible,
  useInstallPrompt,
  useIsIos,
  useIsStandalone,
} from "./hooks";

/**
 * Paths where the install banner would compete with a primary CTA.
 *
 * Auth + marketing surfaces are conversion-critical — surfacing a
 * "Install Stackivo" prompt while the visitor is mid-decision is
 * pure friction. We only let the banner appear inside the authed
 * app (`/dashboard`, `/onboarding`, `/admin`) and the in-app help
 * surfaces.
 */
const HIDE_ON_PREFIXES = [
  "/", // exact match handled below
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/about",
  "/contact",
  "/talk",
  "/demo",
  "/security",
  "/changelog",
  "/terms",
  "/privacy",
  "/pricing",
  "/blog",
  "/tools",
  "/i/", // public tokenised invoice
  "/c/", // public tokenised contract
  "/p/", // public tokenised proposal
];

function shouldHide(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === "/") return true;
  return HIDE_ON_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

const DISMISS_KEY_ANDROID = "stackivo:pwa:install-banner:dismissed";
const DISMISS_KEY_IOS = "stackivo:pwa:install-banner:ios:dismissed";
const PORTAL_DISMISS_KEY_ANDROID = "stackivo:portal-pwa:install-banner:dismissed";
const PORTAL_DISMISS_KEY_IOS = "stackivo:portal-pwa:install-banner:ios:dismissed";
// Re-show after 30 days if dismissed.
const DISMISS_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * Mobile-first installable PWA banner.
 *
 *   - Android Chrome / Edge / Samsung: uses the captured `beforeinstallprompt`
 *     event to trigger the native install dialog.
 *   - iOS Safari: cannot programmatically install — surfaces a brief
 *     "Share → Add to Home Screen" instruction sheet.
 *   - Hides automatically when the app is already running standalone, when
 *     the user dismisses it (persisted ~30 days), or when the browser
 *     reports the install completed.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const standalone = useIsStandalone();
  const ios = useIsIos();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const isPortal = pathname === "/portal" || pathname?.startsWith("/portal/");
  const android = useDismissible(
    isPortal ? PORTAL_DISMISS_KEY_ANDROID : DISMISS_KEY_ANDROID,
    DISMISS_TTL,
  );
  const iosBanner = useDismissible(
    isPortal ? PORTAL_DISMISS_KEY_IOS : DISMISS_KEY_IOS,
    DISMISS_TTL,
  );
  const [pending, setPending] = React.useState(false);
  const title = isPortal ? "Install Stackivo Portal" : "Install Stackivo";
  const installBody = isPortal
    ? "Open this client workspace from your home screen without hunting for the invite link."
    : "Get the full-screen, app-like experience on your home screen.";
  const iosTitle = isPortal
    ? "Add this portal to your home screen"
    : "Add Stackivo to your home screen";

  if (standalone || installed) return null;
  if (shouldHide(pathname)) return null;

  // Android / desktop Chrome path — shown when the browser hands us
  // a deferred prompt.
  if (canInstall && !android.dismissed) {
    return (
      <Banner
        onDismiss={android.dismiss}
        title={title}
        body={installBody}
        action={
          <Button
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const choice = await promptInstall();
                if (choice.outcome === "dismissed") android.dismiss();
              } finally {
                setPending(false);
              }
            }}
            className="h-8 gap-1.5 bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-md shadow-primary/25 hover:shadow-primary/40"
          >
            <Download className="h-3.5 w-3.5" />
            Install
          </Button>
        }
      />
    );
  }

  // Fallback for Android/desktop when the deferred prompt is not available.
  if (!ios && !android.dismissed) {
    return (
      <Banner
        onDismiss={android.dismiss}
        title={title}
        body={
          <span className="inline-flex flex-wrap items-center gap-1">
            Open your browser menu and choose
            <span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium">
              <Download className="h-3 w-3" />
              Install app
            </span>
          </span>
        }
      />
    );
  }

  // iOS Safari path — manual instructions.
  if (ios && !iosBanner.dismissed) {
    return (
      <Banner
        onDismiss={iosBanner.dismiss}
        title={iosTitle}
        body={
          <span className="inline-flex flex-wrap items-center gap-1">
            Tap
            <Share className="mx-0.5 inline h-3.5 w-3.5" aria-label="Share" />
            then
            <span className="inline-flex items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium">
              <Plus className="h-3 w-3" />
              Add to Home Screen
            </span>
          </span>
        }
      />
    );
  }

  return null;
}

interface BannerProps {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  onDismiss: () => void;
}

function Banner({ title, body, action, onDismiss }: BannerProps) {
  return (
    <div
      className="animate-toast-up pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3"
      style={{
        bottom:
          "calc(env(safe-area-inset-bottom, 0px) + var(--mobile-bottom-nav-h, 0px) + 1rem)",
      }}
      role="dialog"
      aria-label={title}
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border bg-background/90 p-3 shadow-xl backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-md shadow-primary/25">
          <StackivoMark variant="white" className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {title}
          </p>
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {body}
          </div>
        </div>
        {action}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
