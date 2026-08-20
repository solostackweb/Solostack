import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeBadgeProps {
  /**
   * Which plan this feature requires.
   * Rendered as the badge label. Defaults to "Pro".
   */
  plan?: "Pro" | "Business";
  /**
   * When true, wraps the badge in a link to /dashboard/settings/billing.
   * Defaults to true.
   */
  linkable?: boolean;
  className?: string;
}

/**
 * Tiny inline "Pro" badge for locking individual form controls, toggle
 * switches, and sidebar nav items without interrupting page flow.
 *
 * Usage — next to a disabled form field:
 *   <div className="flex items-center gap-2">
 *     <Switch disabled />
 *     <UpgradeBadge />
 *   </div>
 *
 * Usage — inside a nav item:
 *   <span className="ml-auto"><UpgradeBadge linkable={false} /></span>
 */
export function UpgradeBadge({
  plan = "Pro",
  linkable = true,
  className,
}: UpgradeBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 to-violet-500/8 px-2 py-0.5 text-micro font-semibold uppercase tracking-wider text-primary",
        linkable && "transition-opacity hover:opacity-80",
        className,
      )}
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden />
      {plan}
    </span>
  );

  if (!linkable) return badge;
  return (
    <Link href="/dashboard/settings/billing" aria-label={`Upgrade to ${plan}`}>
      {badge}
    </Link>
  );
}
