"use client";

/**
 * Sticky bottom CTA bar — mobile only.
 *
 * Industry standard for mobile SaaS marketing: once the visitor has
 * scrolled past the hero, give them a persistent action surface so
 * they don't have to scroll back to a CTA. Hidden:
 *   - on desktop (`md:hidden`)
 *   - on auth + dashboard + onboarding routes (mounted only by the
 *     marketing layout)
 *   - until scrollY > ~600px (i.e. they're past the hero)
 *   - on the signup / login pages (would be redundant)
 *
 * The bar sits ABOVE the floating <SupportButton/> on the same edge by
 * leaving a 64px right-margin slot for the buoy.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { MarketingAuthState } from "@/features/marketing/types";

interface Props {
  authState: MarketingAuthState;
}

const SHOW_AFTER_PX = 600;

export function StickyMobileCta({ authState }: Props) {
  const pathname = usePathname();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Don't render on the contact / talk / demo / signup paths — those
  // pages have their own primary action. The bar would just compete.
  const HIDE_ON = ["/signup", "/login", "/talk", "/demo"];
  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null;

  const isAuthed = authState.isAuthenticated;

  return (
    <div
      data-sticky-cta
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-start pl-4 pr-[68px] pb-3 transition-all duration-300 md:hidden ${
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      {/* `pr-[68px]` reserves a 68px gap on the right so the floating
          SupportButton (44px buoy at right-4) stays visible above the
          sticky CTA bar. Without this they would overlap on phones. */}
      <div className="pointer-events-auto flex w-full items-center gap-2 rounded-full border bg-background/95 p-1.5 pl-4 shadow-2xl backdrop-blur-md">
        <p className="flex-1 truncate text-xs font-medium">
          {isAuthed
            ? "Pick up where you left off."
            : "Free forever for 5 clients. No card."}
        </p>
        {/* Right padding leaves clear space for the floating support
            buoy on the same edge. */}
        <Link
          href={isAuthed ? "/dashboard" : "/signup"}
          data-cta={isAuthed ? "sticky_mobile_dashboard" : "sticky_mobile_primary"}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90"
        >
          {isAuthed ? "Dashboard" : "Start free"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
