"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/constants/navigation";

interface SidebarNavProps {
  items: NavItem[];
  collapsed?: boolean;
  onNavigate?: () => void;
  /** When true, Pro badges are shown next to pro-required nav items. */
  isFreePlan?: boolean;
}

export function SidebarNav({ items, collapsed, onNavigate, isFreePlan = false }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-1", collapsed ? "px-1" : "px-2")}>
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;
        const showProBadge = isFreePlan && item.proRequired && !collapsed;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tour={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium",
              "transition-colors duration-150 ease-out",
              "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
              isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? item.title : undefined}
          >
            {/* Active indicator — glowing indigo-violet pill */}
            {isActive && !collapsed && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary"
              />
            )}
            {/* Active collapsed dot */}
            {isActive && collapsed && (
              <span
                aria-hidden
                className="absolute right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
              />
            )}
            <Icon
              className={cn(
                "h-5 w-5 shrink-0 transition-all duration-150",
                isActive
                  ? "text-primary"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/90",
              )}
            />
            {!collapsed && <span className="truncate">{item.title}</span>}
            {!collapsed && item.badge && !showProBadge ? (
              <span className="ml-auto rounded-lg bg-primary/15 px-1.5 py-0.5 text-micro font-semibold text-primary">
                {item.badge}
              </span>
            ) : null}
            {showProBadge && (
              <span className="ml-auto text-micro font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/35">
                Pro
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
