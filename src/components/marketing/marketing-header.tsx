"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FileSignature,
  FolderKanban,
  Globe,
  Menu,
  Receipt,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { StackivoLogo } from "@/components/brand/stackivo-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MarketingAuthState } from "@/features/marketing/types";

/**
 * Floating-island header: a rounded, blurred pill inset from the viewport
 * edge (Linear / Raycast style) that condenses on scroll. Falls back to a
 * full-width sheet menu on mobile.
 */
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
    <header className="sticky top-0 z-40 w-full px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-2xl border px-3 pl-4 transition-all duration-300 sm:px-4 sm:pl-5",
          scrolled
            ? "border-border/70 bg-background/80 shadow-lg shadow-primary/[0.04] backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" aria-label="Stackivo home" className="flex items-center gap-2 font-bold tracking-tight">
          <StackivoLogo />
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
          <ProductDropdown />
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground",
                pathname === l.href && "text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <HeaderCtas authState={authState} />

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl md:hidden" aria-label="Open navigation">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-background p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-16 items-center border-b px-5 font-semibold">
              <Link href="/" onClick={() => setOpen(false)} aria-label="Stackivo home" className="flex items-center gap-2">
                <StackivoLogo />
              </Link>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto p-3">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Product
              </p>
              {PRODUCT_LINKS.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <l.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{l.label}</span>
                    <span className="block text-xs text-muted-foreground">{l.description}</span>
                  </span>
                </Link>
              ))}
              <div className="my-2 border-t" />
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-accent"
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
    </header>
  );
}

const PRODUCT_LINKS = [
  { href: "/#features", label: "Invoices & GST", description: "Simple or GST, paid faster", icon: Receipt },
  { href: "/#features", label: "Contracts & e-sign", description: "Signed in the browser", icon: FileSignature },
  { href: "/#features", label: "Client portal", description: "A branded home per client", icon: Globe },
  { href: "/#features", label: "Projects & time", description: "Hours that bill themselves", icon: FolderKanban },
  { href: "/#features", label: "Payments", description: "UPI & cards via Razorpay", icon: Wallet },
  { href: "/#ai", label: "Stackivo AI", description: "Your in-app assistant", icon: Sparkles },
];

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/tools", label: "Free tools" },
  { href: "/docs", label: "Docs" },
];

function ProductDropdown() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground"
        aria-expanded={open}
      >
        Product
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-3">
          <div className="grid w-[460px] grid-cols-2 gap-1 rounded-2xl border border-border/80 bg-popover p-2 shadow-xl shadow-primary/[0.06]">
            {PRODUCT_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-primary/5"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <l.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="block text-xs text-muted-foreground">{l.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderCtas({ authState }: { authState: MarketingAuthState }) {
  if (authState.isAuthenticated) {
    return (
      <div className="hidden items-center gap-3 md:flex">
        {authState.showUpgradeNudge ? (
          <Link
            href="/dashboard/settings/billing?upgrade=clients"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Upgrade to Pro
          </Link>
        ) : null}
        <Button asChild size="sm" className="rounded-full">
          <Link href="/dashboard" data-cta="header_dashboard">Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <Button asChild variant="ghost" size="sm" className="rounded-full text-sm font-medium text-muted-foreground hover:text-foreground">
        <Link href="/login" data-cta="header_login">Log in</Link>
      </Button>
      <Button asChild size="sm" className="btn-gradient h-9 rounded-full border-0 px-4 text-sm font-semibold">
        <Link href="/signup" data-cta="header_primary">Start free</Link>
      </Button>
    </div>
  );
}

function MobileCtas({ authState, onNavigate }: { authState: MarketingAuthState; onNavigate: () => void }) {
  if (authState.isAuthenticated) {
    return (
      <div className="space-y-2">
        {authState.showUpgradeNudge ? (
          <Link
            href="/dashboard/settings/billing?upgrade=clients"
            onClick={onNavigate}
            className="block rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Upgrade to Pro
          </Link>
        ) : null}
        <Button asChild className="h-11 w-full justify-center rounded-full">
          <Link href="/dashboard" onClick={onNavigate}>Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Button asChild className="btn-gradient h-11 w-full justify-center rounded-full border-0 font-semibold">
        <Link href="/signup" onClick={onNavigate} data-cta="mobile_menu_primary">Start free</Link>
      </Button>
      <Button asChild variant="outline" className="h-11 w-full justify-center rounded-full">
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
