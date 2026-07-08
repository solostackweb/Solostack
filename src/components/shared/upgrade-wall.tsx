import * as React from "react";
import Link from "next/link";
import { ArrowRight, type LucideIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradeWallProps {
  /**
   * Icon representing the locked feature — same icon used in the nav.
   * Defaults to Sparkles.
   */
  icon?: LucideIcon;
  /** Short, human-readable name of the gated feature. E.g. "Contracts". */
  feature: string;
  /** One-line headline. E.g. "Contracts are a Pro feature". */
  title: string;
  /** 1–2 sentence description of what they unlock. */
  description: string;
  /**
   * 3–4 specific benefit bullets. Keep these concrete and outcome-focused.
   * Good: "Sign contracts without leaving Stackivo"
   * Bad:  "e-signature capability"
   */
  benefits: string[];
  /** Which plan badge to show. Defaults to "Pro". */
  requiredPlan?: "Pro" | "Business";
  /** Optional visual preview rendered behind a blur — keep it lightweight. */
  preview?: React.ReactNode;
  className?: string;
}

/**
 * Full-page upgrade gate for hard-gated features.
 *
 * Drop this in place of the page's real content when `canUseFeature()`
 * returns false. It keeps the page header so the user knows where they are,
 * and surfaces an actionable CTA without being alarming.
 *
 * Usage:
 *   const allowed = await canUseFeature("contracts.e_signature");
 *   if (!allowed) return <UpgradeWall feature="Contracts" ... />;
 */
export function UpgradeWall({
  icon: Icon = Sparkles,
  title,
  description,
  benefits,
  requiredPlan = "Pro",
  preview,
  className,
}: UpgradeWallProps) {
  return (
    <div className={cn("relative flex min-h-[480px] flex-col", className)}>
      {/* Blurred preview layer — purely decorative */}
      {preview && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none overflow-hidden rounded-xl opacity-40 blur-sm"
        >
          {preview}
        </div>
      )}

      {/* Gate card — centred vertically in the available space */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Plan badge */}
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-gradient-to-r from-primary/10 to-violet-500/8 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" />
              {requiredPlan} feature
            </span>
          </div>

          {/* Icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/10 ring-1 ring-primary/20">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>

          {/* Copy */}
          <div className="mb-6 text-center">
            <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Benefits */}
          <ul className="mb-8 space-y-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              asChild
              className="btn-gradient h-11 min-w-[160px] rounded-xl border-0"
            >
              <Link href="/dashboard/settings/billing">
                Upgrade to {requiredPlan}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>

          {/* Social proof micro-copy */}
          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            No long-term commitment · Cancel anytime · Instant access
          </p>
        </div>
      </div>
    </div>
  );
}
