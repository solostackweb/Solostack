"use client";

import * as React from "react";
import { ThemeProvider } from "./theme-provider";
import { MotionProvider } from "./motion-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import { OfflineIndicator } from "@/features/pwa/offline-indicator";
import { InstallPrompt } from "@/features/pwa/install-prompt";
import { UpdatePrompt } from "@/features/pwa/update-prompt";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import { ClarityProvider } from "@/lib/analytics/clarity-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { RouteProgressBar } from "@/components/loading";
import { PwaSplash } from "@/components/loading";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MotionProvider>
        <PostHogProvider>
          <TooltipProvider delayDuration={200}>
            <ConfirmDialogProvider>
              {/* Premium route transition progress bar — fires on every navigation */}
              <RouteProgressBar />
              {/* PWA cold-start splash screen — standalone mode only */}
              <PwaSplash />
              {children}
              <Toaster />
              <OfflineIndicator />
              <InstallPrompt />
              <UpdatePrompt />
              <ServiceWorkerRegister />
              {/* Microsoft Clarity heatmaps + replay. No-ops when the env var
                  isn't set, so safe to leave mounted globally. */}
              <ClarityProvider />
            </ConfirmDialogProvider>
          </TooltipProvider>
        </PostHogProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
