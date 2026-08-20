import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_LABELS,
  stepIndex,
} from "../routes";
import type { OnboardingStep } from "@/lib/supabase/types";

/**
 * Minimal 2-step progress indicator for the new-user onboarding flow.
 *
 * New users see: Business setup → GST setup → dashboard.
 * Legacy mid-flight users see the legacy rail until they complete.
 */
export function OnboardingProgress({
  currentStep,
}: {
  currentStep: OnboardingStep;
}) {
  const currentIdx = stepIndex(currentStep);
  const isShortFlow = currentStep === "business" || currentStep === "gst";
  const visible = isShortFlow
    ? (["business", "gst"] as readonly OnboardingStep[])
    : ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.length - 1);

  const totalSteps = visible.length;
  const completedSteps = Math.min(currentIdx, totalSteps);
  const progressPct = totalSteps > 1
    ? (completedSteps / (totalSteps - 1)) * 100
    : 0;

  return (
    <div className="space-y-3">
      {/* Step label + counter */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Setup
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {Math.min(currentIdx + 1, totalSteps)} of {totalSteps}
        </p>
      </div>

      {/* Node rail */}
      <ol className="flex w-full items-center" role="list">
        {visible.map((step, i) => {
          const isComplete = i < currentIdx || currentStep === "done";
          const isCurrent = i === currentIdx && currentStep !== "done";
          return (
            <React.Fragment key={step}>
              <li className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-bold transition-all duration-300",
                    isComplete &&
                      "bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                    isCurrent &&
                      "border-2 border-primary bg-primary/10 text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.10)]",
                    !isComplete && !isCurrent &&
                      "border border-border bg-background text-muted-foreground",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent && "text-foreground",
                    isComplete && "text-foreground/70",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}
                >
                  {ONBOARDING_STEP_LABELS[step]}
                </span>
              </li>
              {i < visible.length - 1 ? (
                <div className="mx-3 h-px flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-700"
                    style={{ width: `${i < currentIdx ? 100 : 0}%` }}
                  />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Thin overall progress bar */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
