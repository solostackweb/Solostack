import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBusinessProfile } from "@/features/onboarding/server";
import { OnboardingShell } from "@/features/onboarding/components/onboarding-shell";
import { OnboardingCelebration } from "@/features/onboarding/components/onboarding-celebration";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";

export const metadata = { title: "You're all set" };

export default async function OnboardingDonePage() {
  const profile = await getBusinessProfile();
  if (!profile) redirect(AUTH_LOGIN_ROUTE);
  // If the user reaches /done before actually completing, send them back.
  if (!profile.onboardingCompleted) {
    redirect("/onboarding");
  }

  return (
    <OnboardingShell
      currentStep="done"
      title="You're ready to roll"
      description="Your Stackivo workspace is fully set up."
    >
      <div className="flex flex-col items-center gap-7 py-6 text-center">
        {/* Success icon */}
        <div className="relative">
          <span
            aria-hidden
            className="absolute inset-0 -m-2 rounded-full bg-success-subtle blur-2xl"
          />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle2 className="h-8 w-8" />
          </span>
        </div>

        {/* Business summary */}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Workspace ready
          </p>
          <p className="text-xl font-bold tracking-tight">
            {profile.businessName ?? profile.legalName ?? profile.fullName}
          </p>
          <p className="text-sm text-muted-foreground">
            {profile.gstRegistered
              ? `GST-ready · ${profile.gstin}`
              : "Standard invoicing (non-GST)"}
          </p>
        </div>

        {/* Primary CTA */}
        <Button
          asChild
          size="lg"
          className="h-11 px-6 text-sm font-semibold shadow-lg shadow-primary/20 transition-shadow hover:shadow-xl hover:shadow-primary/25"
        >
          <Link href="/dashboard/invoices/new">
            Send your first invoice <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>

        <p className="text-xs text-muted-foreground">
          or{" "}
          <Link
            href="/dashboard"
            className="font-medium text-foreground underline underline-offset-4 hover:opacity-75"
          >
            explore your dashboard
          </Link>
        </p>
      </div>

      {/* Confetti burst + quick-action cards (client component) */}
      <OnboardingCelebration />
    </OnboardingShell>
  );
}
