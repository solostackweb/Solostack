import * as React from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { LogOut, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { logoutAction } from "@/features/auth/actions";

function portalIdFromPath(path: string): string | null {
  const match = path.match(/^\/portal\/([^/?#]+)/);
  const id = match?.[1];
  return id && id !== "accept" ? decodeURIComponent(id) : null;
}

export const metadata: Metadata = {
  applicationName: "Stackivo Portal",
  manifest: "/portal.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Portal",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-title": "Portal",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/**
 * Layout for the client-facing Client Portal area at `/portal/*`.
 *
 * This is a stripped-down workspace shell: no app sidebar, no
 * Stackivo-internal navigation. Just a simple header so the recipient
 * client knows where they are and can sign out. Branding follows the
 * portal's `brand_color` per-page.
 *
 * Auth: every route under here requires a Supabase session. Unauthed
 * users get redirected to the login page with `?next=` so they bounce
 * back here AT THE SAME URL after signing in (so a deep link to a
 * specific portal or invitation token survives the auth round-trip).
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const reqHeaders = await headers();
  const fromHeader =
    reqHeaders.get("next-url") ??
    reqHeaders.get("x-invoke-path") ??
    "/portal";
  if (!user) {
    if (fromHeader === "/portal/accept" || fromHeader.startsWith("/portal/accept?")) {
      return (
        <div className="flex min-h-svh flex-col bg-muted/20 text-foreground">
          <main
            className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-10"
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 2rem)",
            }}
          >
            {children}
          </main>
        </div>
      );
    }
    // Preserve the exact requested URL so the user comes back here after
    // signing in. Previously we redirected everyone to /portal which
    // dropped the invitation token + specific portal ID, forcing the
    // client to find their way again.
    redirect(`${AUTH_LOGIN_ROUTE}?next=${encodeURIComponent(fromHeader)}`);
  }

  const activePortalId = portalIdFromPath(fromHeader);
  let topBarTitle = "Portal";
  if (activePortalId) {
    const { data: portalRow } = await supabase
      .from("portals")
      .select("name, clients(full_name, business_name)")
      .eq("id", activePortalId)
      .maybeSingle();
    const portal = portalRow as
      | {
          name: string;
          clients:
            | { full_name: string | null; business_name: string | null }
            | Array<{ full_name: string | null; business_name: string | null }>
            | null;
        }
      | null;
    const client = Array.isArray(portal?.clients)
      ? portal?.clients[0]
      : portal?.clients;
    topBarTitle =
      client?.full_name ??
      client?.business_name ??
      portal?.name ??
      topBarTitle;
  }

  return (
    <div
      className="flex min-h-svh flex-col text-foreground"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--background)), hsl(var(--muted) / 0.32))",
      }}
    >
      <header
        className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/portal"
            className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Workflow className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate leading-tight">{topBarTitle}</span>
              <span className="block text-micro font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Portal
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground md:inline">
              {user.email}
            </span>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="ghost">
                <LogOut />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 2rem)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
