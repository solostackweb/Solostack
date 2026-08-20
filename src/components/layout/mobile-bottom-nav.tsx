"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  FilePlus2,
  Users,
  ClipboardList,
  FolderKanban,
  MoreHorizontal,
  Plus,
  ChevronRight,
  Clock,
  Activity,
  Workflow,
  BookOpen,
  BookTemplate,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Bottom bar slots (2 left + 2 right of FAB) ──────────────────────── */
interface NavSlot {
  title: string;
  href?: string;
  icon: LucideIcon;
  isMore?: boolean;
}

const LEFT_SLOTS: NavSlot[] = [
  { title: "Home",     href: "/dashboard",          icon: LayoutDashboard },
  { title: "Invoices", href: "/dashboard/invoices",  icon: FileText },
];

const RIGHT_SLOTS: NavSlot[] = [
  { title: "Clients",  href: "/dashboard/clients",   icon: Users },
  { title: "More",     icon: MoreHorizontal,          isMore: true },
];

/* ── Quick-create actions (FAB sheet) ────────────────────────────────── */
interface CreateAction {
  title: string;
  href: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const CREATE_ACTIONS: CreateAction[] = [
  {
    title:     "New Invoice",
    href:      "/dashboard/invoices/new",
    icon:      FileText,
    iconBg:    "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    title:     "New Proposal",
    href:      "/dashboard/proposals?create=1",
    icon:      FilePlus2,
    iconBg:    "bg-indigo-500/10",
    iconColor: "text-indigo-500",
  },
  {
    title:     "New Contract",
    href:      "/dashboard/contracts/new",
    icon:      FileSignature,
    iconBg:    "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    title:     "New Client",
    href:      "/dashboard/clients?create=1",
    icon:      Users,
    iconBg:    "bg-success-subtle",
    iconColor: "text-success-strong",
  },
  {
    title:     "New Project",
    href:      "/dashboard/projects?create=1",
    icon:      FolderKanban,
    iconBg:    "bg-warning-subtle",
    iconColor: "text-warning-strong",
  },
];

/* ── More sheet nav items ────────────────────────────────────────────── */
interface MoreItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const MORE_ITEMS: MoreItem[] = [
  { title: "Lead Forms",   href: "/dashboard/lead-forms", icon: ClipboardList },
  { title: "Projects",     href: "/dashboard/projects",   icon: FolderKanban },
  { title: "Proposals",    href: "/dashboard/proposals",  icon: FilePlus2 },
  { title: "Templates",    href: "/dashboard/templates",  icon: BookTemplate },
  { title: "Contracts",    href: "/dashboard/contracts",  icon: FileSignature },
  { title: "Time",         href: "/dashboard/time",       icon: Clock },
  { title: "Pulse",        href: "/dashboard/pulse",      icon: Activity },
  { title: "Portal",       href: "/dashboard/portal",     icon: Workflow },
  { title: "Welcome Docs", href: "/dashboard/welcome",    icon: BookOpen },
  { title: "Settings",     href: "/dashboard/settings",   icon: Settings },
  { title: "Help & support", href: "/help",               icon: LifeBuoy },
];

/* ── Component ───────────────────────────────────────────────────────── */

/**
 * Mobile bottom navigation — only visible below the md breakpoint.
 *
 * Layout: [Home] [Invoices] [+FAB] [Clients] [More]
 *
 * • FAB opens a quick-create sheet: Invoice / Contract / Client / Project.
 * • More opens an inline bottom sheet with all remaining pages
 *   (Projects, Contracts, Time, Pulse, Portal, Settings, Help).
 *   No full sidebar drawer — everything visible right there.
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const [createOpen, setCreateOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Close both sheets on any navigation
  React.useEffect(() => {
    setCreateOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Only one sheet open at a time
  const openCreate = () => { setMoreOpen(false);  setCreateOpen(true);  };
  const openMore   = () => { setCreateOpen(false); setMoreOpen(true);   };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  const anyOpen = createOpen || moreOpen;

  return (
    <>
      {/* Shared backdrop */}
      {anyOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm"
          aria-hidden
          onClick={() => { setCreateOpen(false); setMoreOpen(false); }}
        />
      )}

      {/* ── Quick-create sheet ─────────────────────────────────────────── */}
      <div
        aria-hidden={!createOpen}
        className={cn(
          "fixed inset-x-0 z-50 mx-auto max-w-sm px-3 transition-all duration-300 ease-out",
          createOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
          {CREATE_ACTIONS.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setCreateOpen(false)}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-accent active:bg-accent",
                  i > 0 && "border-t",
                )}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", action.iconBg, action.iconColor)}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 text-sm font-semibold">{action.title}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── More sheet ─────────────────────────────────────────────────── */}
      <div
        aria-hidden={!moreOpen}
        className={cn(
          "fixed inset-x-0 z-50 mx-auto max-w-sm px-3 transition-all duration-300 ease-out",
          moreOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0",
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
      >
        <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
          <div className="border-b px-4 py-2.5">
            <p className="text-micro font-bold uppercase tracking-widest text-muted-foreground">
              More pages
            </p>
          </div>
          <div className="grid grid-cols-2">
            {MORE_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const isOdd = i % 2 === 0;
              const isLastRow = i >= MORE_ITEMS.length - 2;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-3.5 transition-colors hover:bg-accent active:bg-accent",
                    !isOdd && "border-l",
                    !isLastRow && "border-b",
                    active && "text-primary",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-medium truncate", active && "font-semibold")}>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom nav bar ─────────────────────────────────────────────── */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 overflow-visible">
          {/* Left slots */}
          {LEFT_SLOTS.map((slot) => (
            <NavTabItem
              key={slot.title}
              slot={slot}
              active={!!slot.href && isActive(slot.href)}
            />
          ))}

          {/* Center FAB */}
          <li className="relative flex items-center justify-center overflow-visible">
            <button
              type="button"
              aria-label={createOpen ? "Close quick-create menu" : "Create new"}
              aria-expanded={createOpen}
              onClick={() => (createOpen ? setCreateOpen(false) : openCreate())}
              className={cn(
                "-mt-5 flex h-14 w-14 items-center justify-center rounded-full",
                "bg-gradient-to-br from-primary to-blue-700 text-white",
                "shadow-lg shadow-primary/30 transition-all duration-200 ease-out",
                "hover:scale-105 hover:shadow-xl hover:shadow-primary/40",
                "active:scale-95",
                createOpen && "rotate-45 scale-105",
              )}
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </li>

          {/* Right slots */}
          {RIGHT_SLOTS.map((slot) => (
            <NavTabItem
              key={slot.title}
              slot={slot}
              active={
                slot.isMore
                  ? moreOpen
                  : !!slot.href && isActive(slot.href)
              }
              onMoreClick={slot.isMore ? () => (moreOpen ? setMoreOpen(false) : openMore()) : undefined}
            />
          ))}
        </ul>
      </nav>
    </>
  );
}

/* ── NavTabItem ──────────────────────────────────────────────────────── */

function NavTabItem({
  slot,
  active,
  onMoreClick,
}: {
  slot: NavSlot;
  active: boolean;
  onMoreClick?: () => void;
}) {
  const Icon = slot.icon;

  const inner = (
    <span
      className={cn(
        "relative flex h-16 flex-col items-center justify-center gap-[3px]",
        "text-[10.5px] font-medium tracking-tight transition-colors duration-150",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute -top-px h-[2px] rounded-b-full bg-primary transition-all duration-200",
          active ? "w-8 opacity-100" : "w-0 opacity-0",
        )}
      />
      <Icon
        aria-hidden
        className={cn(
          "transition-all duration-150",
          active ? "h-5 w-5 scale-110" : "h-[18px] w-[18px]",
        )}
      />
      <span>{slot.title}</span>
    </span>
  );

  if (slot.isMore) {
    return (
      <li>
        <button
          type="button"
          onClick={onMoreClick}
          className="w-full"
          aria-label="More pages"
          aria-expanded={active}
        >
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={slot.href!}
        aria-current={active ? "page" : undefined}
        className="block w-full"
      >
        {inner}
      </Link>
    </li>
  );
}
