/**
 * Founder Console chrome.
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │ topbar  Now · Users · Audit · ...        avatar     │
 *   ├──────────┬──────────────────────────────────────────┤
 *   │ sidebar  │ page content                             │
 *   │ (md+)    │                                          │
 *   └──────────┴──────────────────────────────────────────┘
 *
 * Mobile: sidebar collapses to a sheet behind a top-bar hamburger.
 *
 * Density is the differentiating principle — smaller font, tighter
 * spacing, monospace timestamps. This is not the customer surface.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Bug,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Files,
  Flag,
  Gauge,
  LineChart,
  LifeBuoy,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Terminal,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  CommandPalette,
  useCommandPaletteShortcut,
} from "./command-palette";

interface AdminShellProps {
  children: React.ReactNode;
  /** Email of the currently-authenticated admin (right-side label). */
  adminEmail: string;
  /** When set, renders the persistent view-as banner across all routes. */
  viewingAs?: { id: string; name: string; email: string } | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Operate",
    items: [
      { href: "/admin", label: "Now", icon: Gauge },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/emails", label: "Emails", icon: Mail },
      { href: "/admin/razorpay", label: "Payments", icon: DollarSign },
      { href: "/admin/support", label: "Support", icon: LifeBuoy },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    heading: "Inspect",
    items: [
      { href: "/admin/invoices", label: "Invoices", icon: FileText },
      { href: "/admin/contracts", label: "Contracts", icon: ShieldCheck },
      { href: "/admin/files", label: "Files", icon: Files },
      { href: "/admin/sentry", label: "Sentry", icon: Bug },
      { href: "/admin/jobs", label: "Jobs", icon: Clock },
      { href: "/admin/security", label: "Security", icon: Shield },
      { href: "/admin/audit", label: "Audit", icon: ClipboardList },
      { href: "/admin/query", label: "SQL", icon: Terminal },
    ],
  },
  {
    heading: "Meta",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: LineChart },
      { href: "/admin/flags", label: "Flags", icon: Flag },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function AdminShell({ children, adminEmail, viewingAs }: AdminShellProps) {
  const pathname = usePathname() ?? "";
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  useCommandPaletteShortcut(setPaletteOpen);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("stackivo:admin-sidebar");
    if (stored === "collapsed") setSidebarCollapsed(true);
  }, []);

  const toggleSidebarCollapsed = React.useCallback(() => {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(
        "stackivo:admin-sidebar",
        next ? "collapsed" : "expanded",
      );
      return next;
    });
  }, []);

  // Close the mobile sidebar + palette on navigation.
  React.useEffect(() => {
    setSidebarOpen(false);
    setPaletteOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-[14px]">
      {viewingAs ? <ViewAsBanner viewingAs={viewingAs} /> : null}

      <TopBar
        adminEmail={adminEmail}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onToggleCollapsed={toggleSidebarCollapsed}
        sidebarOpen={sidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="flex flex-1 bg-muted/20 dark:bg-background">
        <Sidebar
          pathname={pathname}
          mobileOpen={sidebarOpen}
          collapsed={sidebarCollapsed}
        />

        {/* Mobile backdrop */}
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden"
          />
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8">
          <div className="mx-auto w-full max-w-[1520px]">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* Mobile palette FAB — desktop uses the top-bar search bar instead. */}
      <button
        type="button"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
        className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border bg-background shadow-lg hover:bg-accent md:hidden"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopBar({
  adminEmail,
  sidebarOpen,
  sidebarCollapsed,
  onToggleSidebar,
  onToggleCollapsed,
  onOpenPalette,
}: {
  adminEmail: string;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onToggleCollapsed: () => void;
  onOpenPalette: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 shadow-sm shadow-black/[0.02] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 md:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          aria-label="Toggle navigation"
          onClick={onToggleSidebar}
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 md:inline-flex"
          aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={onToggleCollapsed}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        <Link
          href="/admin"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
            <Shield className="h-4 w-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm">Stackivo Command</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
              founder console
            </span>
          </span>
        </Link>

        <button
          type="button"
          className="ml-2 hidden h-8 flex-1 max-w-xl items-center gap-2 rounded-md border bg-muted/45 px-2.5 text-xs text-muted-foreground shadow-inner shadow-black/[0.02] hover:bg-muted sm:flex"
          onClick={onOpenPalette}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search users · jump anywhere…</span>
          <span className="ml-auto rounded border bg-background/80 px-1 text-[10px] font-medium tracking-wider">
            ⌘K
          </span>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="h-3 w-3" />
            Customer app
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {adminEmail}
          </span>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------

function Sidebar({
  pathname,
  mobileOpen,
  collapsed,
}: {
  pathname: string;
  mobileOpen: boolean;
  collapsed: boolean;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 mt-14 shrink-0 transform border-r border-border/70 bg-sidebar/95 shadow-xl shadow-black/5 backdrop-blur transition-[width,transform] md:sticky md:top-14 md:z-20 md:mt-0 md:h-[calc(100vh-3.5rem)] md:translate-x-0 md:shadow-none",
        collapsed ? "w-[4.25rem]" : "w-72 md:w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
    >
      <nav className="flex h-full flex-col gap-3 overflow-y-auto p-3 scrollbar-thin">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="flex flex-col gap-0.5">
            <div
              className={cn(
                "px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60",
                collapsed && "sr-only",
              )}
            >
              {group.heading}
            </div>
            {group.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium ring-1 ring-primary/15"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className={cn(collapsed && "sr-only")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
        <div className="mt-auto" />
        <div
          className={cn(
            "rounded-md border border-border/70 bg-background/50 px-3 py-2 text-[11px] text-muted-foreground",
            collapsed && "hidden",
          )}
        >
          Command shell for support, billing, growth, and incidents.
        </div>
      </nav>
      <div
        className={cn(
          "border-t border-border/60 px-3 py-3 text-[11px] text-muted-foreground",
          collapsed && "hidden",
        )}
      >
        ⌘K to search
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function ViewAsBanner({
  viewingAs,
}: {
  viewingAs: { id: string; name: string; email: string };
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
      <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs sm:px-6 md:px-8 max-w-screen-xl mx-auto w-full">
        <span>
          Viewing as <strong>{viewingAs.name}</strong> ({viewingAs.email}).
          Writes are disabled.
        </span>
        <form
          action="/api/admin/view-as/stop"
          method="post"
          className="inline"
        >
          <button
            type="submit"
            className="rounded border border-amber-600/40 px-2 py-0.5 hover:bg-amber-500/20"
          >
            Exit
          </button>
        </form>
      </div>
    </div>
  );
}
