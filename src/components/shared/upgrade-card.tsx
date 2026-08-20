import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UpgradeCardProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  /** 2–4 specific benefit bullets. Keep each under 8 words. */
  features?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  /** Which plan badge to show. Defaults to "Pro". */
  requiredPlan?: "Pro" | "Business";
  className?: string;
}

/**
 * Inline upgrade prompt — a horizontal card dropped where a feature section
 * would normally live. Use for soft gates where the page is still partially
 * accessible (e.g. branding settings, analytics teaser).
 *
 * For hard gates (entire page inaccessible), use <UpgradeWall /> instead.
 */
export function UpgradeCard({
  icon: Icon = Sparkles,
  title,
  description,
  features,
  ctaLabel = "Upgrade to Pro",
  ctaHref = "/dashboard/settings/billing",
  requiredPlan = "Pro",
  className,
}: UpgradeCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-violet-500/[0.02] p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-violet-500/10 ring-1 ring-primary/20 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-micro font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              {requiredPlan}
            </span>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            {features && features.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <svg className="h-2 w-2" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                        <path
                          d="M1.5 4l2 2L6.5 2"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button
          asChild
          size="sm"
          className="btn-gradient shrink-0 self-start rounded-lg border-0 sm:self-center"
        >
          <Link href={ctaHref}>
            {ctaLabel}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
