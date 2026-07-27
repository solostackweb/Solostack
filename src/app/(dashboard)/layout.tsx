import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireOnboarded } from "@/features/onboarding/server";
import { getCurrentSubscription } from "@/features/subscription/server";
import { DashboardSupportLayer } from "@/features/support/dashboard-support";
import { OnboardingTour } from "@/features/onboarding/components/onboarding-tour";

/**
 * Dashboard group layout.
 *
 * Runs `requireOnboarded()` on every dashboard request:
 *   - Unauthenticated → redirected to /login by middleware before we hit RSC.
 *   - Authenticated but mid-onboarding → redirected to the persisted step.
 *   - Authenticated + onboarded → rendered through the dashboard shell.
 *
 * Mounts the first-party live chat widget once for the whole authenticated
 * surface (see DashboardSupportLayer).
 */
export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, subscription] = await Promise.all([
    requireOnboarded(),
    getCurrentSubscription(),
  ]);

  return (
    <DashboardShell profile={profile} subscription={subscription}>
      {children}
      <DashboardSupportLayer identity={{ plan: subscription?.plan ?? "free" }} />
      <OnboardingTour done={profile.tourCompleted} />
    </DashboardShell>
  );
}
