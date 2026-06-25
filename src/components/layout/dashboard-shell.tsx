import * as React from "react";
import { AppSidebar } from "./app-sidebar";
import { TopNav } from "./top-nav";
import { MobileNav } from "./mobile-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { PullToRefresh } from "./pull-to-refresh";
import { DashboardShellProviders } from "./dashboard-shell-providers";
import type { BusinessProfile } from "@/features/onboarding/types";
import type { CurrentSubscription } from "@/features/subscription/types";

/**
 * Dashboard shell — a Server Component.
 *
 * The outer flex layout, the `<main>` padding math, and the static grid
 * structure are all server-rendered. Interactive concerns are isolated to
 * small client islands:
 *
 *   - `DashboardShellProviders` — owns `ProfileProvider` + `MobileNavProvider`.
 *   - `AppSidebar` — self-manages its collapsed state.
 *   - `TopNav`, `MobileNav`, `MobileBottomNav` — independent client components.
 *
 * Keeping the shell itself as RSC means any future server-rendered chrome
 * (e.g. a server-side breadcrumb resolved against the request URL) can
 * slot in without first crossing a client boundary.
 */
export function DashboardShell({
  children,
  profile,
  subscription,
  aiClients = [],
  aiProjects = [],
}: {
  children: React.ReactNode;
  profile: BusinessProfile;
  subscription: CurrentSubscription | null;
  aiClients?: Array<{ id: string; name: string }>;
  aiProjects?: Array<{ id: string; name: string; clientId: string | null }>;
}) {
  return (
    <DashboardShellProviders profile={profile} subscription={subscription}>
      <div className="flex min-h-[100dvh] w-full bg-background">
        <AppSidebar />
        <MobileNav />
        <div
          data-dashboard-content
          className="flex min-w-0 flex-1 flex-col"
        >
          <TopNav aiClients={aiClients} aiProjects={aiProjects} />
          <main
            className="flex-1"
            style={{
              // Reserve room on mobile for the fixed bottom nav (h-14) +
              // device safe-area inset so iOS home indicator never clips content.
              paddingBottom:
                "calc(env(safe-area-inset-bottom, 0px) + var(--mobile-bottom-nav-h, 0px))",
            }}
          >
            {/* animate-page-enter: subtle lift+fade on every route render.
                GPU-only (transform + opacity). Collapsed to instant under
                prefers-reduced-motion via the global CSS rule. */}
            <div className="mx-auto w-full max-w-[92rem] p-4 md:p-6 lg:p-8 motion-safe:animate-page-enter">
              {children}
            </div>
          </main>
        </div>
        <div className="stackivo-ai-rail hidden min-w-0 md:flex h-[100dvh] justify-end">
          <div id="stackivo-ai-panel-slot" className="flex h-full w-full" />
        </div>
        <PullToRefresh />
        <MobileBottomNav />
      </div>
    </DashboardShellProviders>
  );
}
