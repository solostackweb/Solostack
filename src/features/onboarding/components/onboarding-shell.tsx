import * as React from "react";
import { OnboardingProgress } from "./onboarding-progress";
import type { OnboardingStep } from "@/lib/supabase/types";

/**
 * Shared layout for every onboarding step page.
 *
 * Two-step flow (business → gst) designed to feel like a premium welcome
 * experience, not a feature-list form. Clean, calm, focused.
 */
export function OnboardingShell({
  currentStep,
  title,
  description,
  children,
}: {
  currentStep: OnboardingStep;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-7 sm:space-y-9">
      <OnboardingProgress currentStep={currentStep} />

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border bg-card/80 p-5 shadow-2xl shadow-primary/[0.04] backdrop-blur-sm sm:p-8">
        {children}
      </div>
    </div>
  );
}
