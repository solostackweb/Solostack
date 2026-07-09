"use client";

/**
 * Cmd+K v1 - Founder Console command palette.
 *
 * Hotkeys: Cmd+K / Ctrl+K toggle. `/` opens too (mobile-friendly).
 *
 * Hierarchy:
 *   1. Navigation       - static "Go to <page>" commands.
 *   2. Recipes          - saved query lenses (e.g. "Open alerts (24h)").
 *   3. Entity search    - debounced server call returning users /
 *                          subscriptions / request-ids matching the query.
 *
 * Result selection routes via `router.push()`. The palette closes on
 * route change.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Gauge,
  Users,
  CreditCard,
  Mail,
  Shield,
  Bell,
  ClipboardList,
  ExternalLink,
  Hash,
  FileText,
  ShieldCheck,
  Files,
  LifeBuoy,
  LineChart,
  Flag,
  Settings,
  Terminal,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { adminGlobalSearch, type SearchHit } from "@/features/admin/search";

const ICONS: Record<SearchHit["kind"], React.ComponentType<{ className?: string }>> = {
  user: Users,
  subscription: CreditCard,
  security_event: Shield,
  request_id: Hash,
  invoice: ClipboardList,
  contract: ClipboardList,
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "/admin", label: "Now page", icon: Gauge },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/emails", label: "Emails", icon: Mail },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/contracts", label: "Contracts", icon: ShieldCheck },
  { href: "/admin/files", label: "Files", icon: Files },
  { href: "/admin/security", label: "Security", icon: Shield },
  { href: "/admin/audit", label: "Audit", icon: ClipboardList },
  { href: "/admin/query", label: "SQL", icon: Terminal },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart },
  { href: "/admin/flags", label: "Feature flags", icon: Flag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const RECIPES: Array<{ href: string; label: string }> = [
  {
    href: "/admin/security?severity=alert",
    label: "Open security alerts",
  },
  {
    href: "/admin/emails?status=failed",
    label: "Open failed deliveries",
  },
  {
    href: "/admin/emails?status=bounced",
    label: "Open bounced deliveries",
  },
  {
    href: "/admin/subscriptions?status=past_due",
    label: "Open past-due subscriptions",
  },
  {
    href: "/admin/invoices?status=overdue",
    label: "Open overdue invoices",
  },
  {
    href: "/admin/audit",
    label: "Open recent admin activity",
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Debounced server search.
  React.useEffect(() => {
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      const results = await adminGlobalSearch(query);
      if (!cancelled) {
        setHits(results);
        setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      setLoading(false);
    };
  }, [open, query]);

  // Reset on close so re-opening starts blank.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  function navigate(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Founder Console"
      description="Search users, subscriptions, request ids, or jump to a page."
    >
      <CommandInput
        placeholder="Search users - paste request id - jump to page..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading
            ? "Searching..."
            : query.length >= 2
              ? "No matches."
              : "Type to search."}
        </CommandEmpty>

        {hits.length > 0 ? (
          <>
            <CommandGroup heading="Results">
              {hits.map((hit) => {
                const Icon = ICONS[hit.kind];
                return (
                  <CommandItem
                    key={`${hit.kind}:${hit.id}`}
                    value={`${hit.label} ${hit.hint} ${hit.id}`}
                    onSelect={() => navigate(hit.href)}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{hit.label}</span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      {hit.hint}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`go to ${item.label}`}
                onSelect={() => navigate(item.href)}
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Recipes">
          {RECIPES.map((r) => (
            <CommandItem
              key={r.href}
              value={`recipe ${r.label}`}
              onSelect={() => navigate(r.href)}
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              {r.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Global Cmd+K / Ctrl+K / `/` hotkey listener. Renders nothing on its
 * own - pair with `CommandPalette` controlled by the same state.
 */
export function useCommandPaletteShortcut(
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
) {
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      const inField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable === true;

      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
