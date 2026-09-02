"use client";

import * as React from "react";
import Link from "next/link";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { primaryNav, secondaryNav, type NavItem } from "@/constants/navigation";
import { SidebarNav } from "./sidebar-nav";

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
    const onToggle = () => {
      setCollapsed((value) => {
        const next = !value;
        localStorage.setItem("stackivo:sidebar-behaviour", next ? "collapsed" : "expanded");
        window.dispatchEvent(new CustomEvent("stackivo:sidebar-state", { detail: { collapsed: next } }));
        return next;
      });
    };
    window.addEventListener("stackivo:toggle-sidebar", onToggle);
    return () => window.removeEventListener("stackivo:toggle-sidebar", onToggle);
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

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[264px]",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-sidebar-border/50 px-4", collapsed && "justify-center px-0")}>
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2.5 rounded-lg font-semibold transition-colors",
            !collapsed && "px-1 py-1 hover:bg-sidebar-accent/70",
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
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-3 [@media(max-height:720px)]:overflow-y-auto">
        <div className="space-y-3">
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
                isFreePlan={false}
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
