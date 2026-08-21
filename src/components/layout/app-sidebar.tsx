"use client";

import * as React from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { primaryNav, secondaryNav, type NavItem } from "@/constants/navigation";
import { SidebarNav } from "./sidebar-nav";
import { useProfile } from "@/features/profile/context";

const SIDEBAR_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Workspace",
    items: primaryNav.filter((item) =>
      ["Dashboard", "Clients", "Projects", "Meetings"].includes(item.title),
    ),
  },
  {
    label: "Documents",
    items: primaryNav.filter((item) =>
      ["Documents", "Templates", "Invoices"].includes(item.title),
    ),
  },
  {
    label: "Growth",
    items: primaryNav.filter((item) => ["Portal", "Time", "Pulse"].includes(item.title)),
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const pref = localStorage.getItem("stackivo:sidebar-behaviour");
    return pref === "collapsed";
  });

  const onToggle = React.useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem("stackivo:sidebar-behaviour", next ? "collapsed" : "expanded");
      return next;
    });
  }, []);

  const userCollapsedRef = React.useRef(collapsed);
  const aiForcedRef = React.useRef(false);

  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "stackivo:sidebar-behaviour") return;
      if (e.newValue === "collapsed") setCollapsed(true);
      else if (e.newValue === "expanded") setCollapsed(false);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const sync = () => {
      const aiOpen = root.classList.contains("stackivo-ai-open");
      if (aiOpen && !aiForcedRef.current) {
        userCollapsedRef.current = collapsed;
        aiForcedRef.current = true;
        setCollapsed(true);
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

  const { subscription } = useProfile();
  const plan = subscription?.plan ?? "free";

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[264px]",
      )}
    >
      <div
        className={cn(
          "relative flex h-14 items-center border-b border-sidebar-border/50 px-4",
          collapsed ? "justify-center px-0" : "justify-between",
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2.5 rounded-lg font-semibold transition-colors",
            !collapsed && "px-1 py-1 hover:bg-sidebar-accent/70",
            collapsed && "pr-6",
          )}
          aria-label="Stackivo home"
        >
          <StackivoMark className="h-7 w-7" />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">
              Stackivo
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "h-8 w-8 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "absolute right-1 top-3 h-7 w-7",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-5">
        <div className="space-y-5">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/55">
                  {group.label}
                </p>
              )}
              <SidebarNav
                items={group.items}
                collapsed={collapsed}
                isFreePlan={plan === "free"}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="px-2 pb-3">
        <Separator className="mb-2 bg-sidebar-border/60" />
        {!collapsed && (
          <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/55">
            Account
          </p>
        )}
        <SidebarNav items={secondaryNav} collapsed={collapsed} />
      </div>
    </aside>
  );
}
