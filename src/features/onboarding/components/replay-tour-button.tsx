"use client";

import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Re-launches the first-run product tour. Navigates to the dashboard with a
 * ?tour=1 flag that OnboardingTour honours regardless of the saved completion
 * state, then cleans the URL when the tour finishes.
 */
export function ReplayTourButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={className}
      onClick={() => router.push("/dashboard?tour=1")}
    >
      <PlayCircle className="h-4 w-4" />
      Replay product tour
    </Button>
  );
}
