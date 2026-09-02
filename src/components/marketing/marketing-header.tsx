"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { StackivoLogo } from "@/components/brand/stackivo-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MarketingAuthState } from "@/features/marketing/types";

/**
 * Full-width sticky header: logo left, nav truly centered, CTAs right.
 * One product — so no dropdown, just clear flat links with an animated
 * brand-blue underline on hover.
 */
const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#workflow", label: "How it works" },
  { href: "/#ai", label: "Ivo AI" },
  { href: "/community", label: "Community" },
  { href: "/tools", label: "Free tools" },
  { href: "/docs", label: "Docs" },
];

export function MarketingHeader({ authState }: { authState: MarketingAuthState }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="sticky top-3 z-40 w-full px-3 sm:px-5"
    >
      <div
        className={cn(
          "relative mx-auto flex h-16 w-full max-w-[1280px] items-center rounded-2xl border bg-card/90 px-4 backdrop-blur-xl transition-shadow duration-200 sm:px-5",
          scrolled
            ? "border-border shadow-[0_12px_38px_-24px_hsl(224_45%_28%/0.45)]"
            : "border-border/70 shadow-[0_8px_24px_-22px_hsl(224_45%_28%/0.35)]",
        )}
      >
        <Link href="/" aria-label="Stackivo home" className="flex shrink-0 items-center gap-2">
          <StackivoLogo />
        </Link>

        {/* Nav — truly centered, independent of logo/CTA widths */}
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex"
          aria-label="Main"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={cn(
                "relative px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                "after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100",
                pathname === l.href && "text-foreground after:scale-x-100",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right: CTAs */}
        <div className="ml-auto flex items-center gap-2">
          <HeaderCtas authState={authState} />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-lg lg:hidden" aria-label="Open navigation">
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Navigate Stackivo marketing pages or access your account.
              </SheetDescription>
              <div className="flex h-16 items-center border-b px-5">
                <Link href="/" onClick={() => setOpen(false)} aria-label="Stackivo home" className="flex items-center gap-2">
                  <StackivoLogo />
                </Link>
              </div>
              <div className="flex flex-col gap-0.5 overflow-y-auto p-3">
                {NAV_LINKS.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="my-2 border-t" />
                <MobileCtas authState={authState} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function HeaderCtas({ authState }: { authState: MarketingAuthState }) {
  if (authState.isAuthenticated) {
    return (
      <div className="hidden items-center gap-3 lg:flex">
        <Button asChild size="sm" className="h-10 rounded-lg px-4 text-sm font-semibold shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.8)]">
          <Link href="/dashboard" data-cta="header_dashboard">
            Open dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-1.5 lg:flex">
      <Button asChild variant="ghost" size="sm" className="rounded-lg px-4 text-sm font-medium text-muted-foreground hover:text-foreground">
        <Link href="/login" data-cta="header_login">Log in</Link>
      </Button>
      <Button asChild size="sm" className="h-10 rounded-lg px-4 text-sm font-semibold shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.8)]">
        <Link href="/community" data-cta="header_primary">
          Join early access <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function MobileCtas({ authState, onNavigate }: { authState: MarketingAuthState; onNavigate: () => void }) {
  if (authState.isAuthenticated) {
    return (
      <div className="space-y-2">
        <Button asChild className="h-11 w-full justify-center rounded-lg font-semibold">
          <Link href="/dashboard" onClick={onNavigate}>Open dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Button asChild className="h-11 w-full justify-center rounded-lg font-semibold">
        <Link href="/community" onClick={onNavigate} data-cta="mobile_menu_primary">Join early access</Link>
      </Button>
      <Button asChild variant="outline" className="h-11 w-full justify-center rounded-lg">
        <Link href="/login" onClick={onNavigate} data-cta="mobile_menu_login">Log in</Link>
      </Button>
      <Link
        href="/portal-access"
        onClick={onNavigate}
        className="px-3 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Client? Access your portal &rarr;
      </Link>
    </div>
  );
}
