"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV_GROUPS, ALL_SETTINGS_ITEMS } from "../constants";
import { useRouter } from "next/navigation";

/**
 * Left-rail Settings navigation. Shown on `lg+` only; paired with
 * `SettingsNavMobile` which renders a native-feeling dropdown on smaller screens.
 */
export function SettingsNavDesktop() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings"
      className="sticky top-20 hidden w-60 shrink-0 space-y-8 lg:block"
    >
      {SETTINGS_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-micro font-bold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
                    active
                      ? "bg-accent font-semibold text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-gradient-to-b from-primary to-indigo-500"
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * Mobile settings nav — a native-feeling Select that routes on change.
 * Hidden on `lg+` where the desktop rail takes over.
 */
export function SettingsNavMobile() {
  const pathname = usePathname();
  const router = useRouter();
  const current =
    ALL_SETTINGS_ITEMS.find((i) => i.href === pathname)?.href ??
    ALL_SETTINGS_ITEMS[0].href;

  return (
    <div className="lg:hidden">
      <Select value={current} onValueChange={(v) => router.push(v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SETTINGS_NAV_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              <div className="px-2 py-1.5 text-micro font-bold uppercase tracking-widest text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((item) => (
                <SelectItem key={item.href} value={item.href}>
                  {item.label}
                </SelectItem>
              ))}
            </React.Fragment>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
