"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { primaryNav, secondaryNav } from "@/constants/navigation";
import { SidebarNav } from "./sidebar-nav";
import { useProfile } from "@/features/profile/context";
import { getDisplayName, getInitials } from "@/features/profile/utils";

export function AppSidebar() {
  // Collapsed state self-managed; survives navigations because the sidebar
  // is rendered by the persistent dashboard layout, not by any page.
  // Seed from the workspace preference stored in localStorage.
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const pref = localStorage.getItem("stackivo:sidebar-behaviour");
    return pref === "collapsed";
  });
  const onToggle = React.useCallback(() => setCollapsed((v) => !v), []);
  // When the AI panel is open we auto-collapse the sidebar to its icon rail so
  // the screen isn't split three ways. We remember the user's own collapsed
  // choice and restore it when the panel closes — and never override a manual
  // toggle the user makes while the panel is open.
  const userCollapsedRef = React.useRef(collapsed);
  const aiForcedRef = React.useRef(false);

  // Live-react to preference changes made from the Appearance settings page.
  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "stackivo:sidebar-behaviour") return;
      if (e.newValue === "collapsed") setCollapsed(true);
      else if (e.newValue === "expanded") setCollapsed(false);
      // "auto" → leave user's current toggle state untouched
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Auto-collapse while the AI panel is open (tracks the `stackivo-ai-open`
  // class the panel sets on <html>). Restores the previous state on close.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const sync = () => {
      const aiOpen = root.classList.contains("stackivo-ai-open");
      if (aiOpen && !aiForcedRef.current) {
        userCollapsedRef.current = collapsed;
        aiForcedRef.current = true;
        setCollapsed(true);
        // The collapsed rail still shows nav icons + the expand button, so the
        // menu stays discoverable without an intrusive popup.
      } else if (!aiOpen && aiForcedRef.current) {
        aiForcedRef.current = false;
        setCollapsed(userCollapsedRef.current);
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [collapsed]);

  const { profile, subscription } = useProfile();
  const workspaceName =
    profile?.businessName?.trim() ||
    profile?.legalName?.trim() ||
    getDisplayName(profile) ||
    "Your workspace";
  const workspaceInitials = getInitials(workspaceName);
  const plan = subscription?.plan ?? "free";

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[278px]",
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 items-center px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 font-semibold"
          aria-label="Stackivo home"
        >
          <StackivoMark className="h-7 w-7" />
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight">
              Stackivo
            </span>
          )}
        </Link>
      </div>

      {/* Primary nav */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2 pt-1">
        {!collapsed && (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Workspace
          </p>
        )}
        <SidebarNav items={primaryNav} collapsed={collapsed} isFreePlan={plan === "free"} />
      </div>

      {/* Secondary nav */}
      <div className="px-2 pb-2">
        <Separator className="mb-2 bg-sidebar-border/60" />
        {!collapsed && (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Account
          </p>
        )}
        <SidebarNav items={secondaryNav} collapsed={collapsed} />
      </div>

      {/* Workspace identity */}
      <div className="border-t border-sidebar-border/60 p-2">
        {!collapsed ? (
          <Link
            href="/dashboard/settings/company"
            className="group flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-sidebar-accent"
          >
            <div
              aria-hidden
              className="avatar-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
            >
              {workspaceInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">
                {workspaceName}
              </p>
              <p className="truncate text-[11px] capitalize leading-tight text-muted-foreground">
                {plan} plan
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/settings/company"
            aria-label={`${workspaceName} · ${plan} plan`}
            className="avatar-gradient mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold transition-opacity hover:opacity-80"
          >
            {workspaceInitials}
          </Link>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border/60 p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-full text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
