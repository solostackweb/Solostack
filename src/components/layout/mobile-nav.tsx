"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { primaryNav, secondaryNav } from "@/constants/navigation";
import { SidebarNav } from "./sidebar-nav";
import { useMobileNav } from "./mobile-nav-context";
import { useProfile } from "@/features/profile/context";
import { getDisplayName, getInitials } from "@/features/profile/utils";

/** Top-nav hamburger trigger. Drives the shared mobile nav drawer state. */
export function MobileNavTrigger() {
  const { toggle } = useMobileNav();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={toggle}
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}

/**
 * Mobile navigation drawer. State lives in `MobileNavProvider` so both the
 * top-nav hamburger and the bottom-nav "More" tab can drive it.
 */
export function MobileNav() {
  const { open, setOpen } = useMobileNav();
  const { profile } = useProfile();
  const workspaceName =
    profile?.businessName?.trim() ||
    profile?.legalName?.trim() ||
    getDisplayName(profile) ||
    "Your workspace";
  const workspaceInitials = getInitials(workspaceName);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="flex w-[86vw] max-w-[320px] flex-col p-0"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Primary application navigation
        </SheetDescription>

        <div
          className="flex h-14 items-center border-b px-4"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 font-bold tracking-tight"
          >
            <StackivoMark className="h-8 w-8" />
            <span className="text-sm">Stackivo</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-1.5 px-3 text-micro font-bold uppercase tracking-widest text-muted-foreground/70">
            Workspace
          </p>
          <SidebarNav
            items={primaryNav}
            onNavigate={() => setOpen(false)}
            isFreePlan={false}
          />

          <Separator className="my-3" />

          <p className="mb-1.5 px-3 text-micro font-bold uppercase tracking-widest text-muted-foreground/70">
            Account
          </p>
          <SidebarNav items={secondaryNav} onNavigate={() => setOpen(false)} />
        </div>

        <Link
          href="/dashboard/settings/company"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 border-t p-3 transition-colors hover:bg-muted/60"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-blue-500/15 text-xs font-bold text-primary ring-1 ring-primary/15"
          >
            {workspaceInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight">
              {workspaceName}
            </p>
            <p className="truncate text-micro capitalize leading-tight text-muted-foreground">
              Early access workspace
            </p>
          </div>
        </Link>
      </SheetContent>
    </Sheet>
  );
}
