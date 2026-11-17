"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Plus, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listUserOrganizationsAction } from "../actions";

export function OrgSwitcher() {
  const pathname = usePathname();
  const [orgs, setOrgs] = React.useState<Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    is_owner: boolean;
  }>>([]);
  const [loading, setLoading] = React.useState(true);

  // Extract org ID from pathname like /dashboard/organizations/:orgId/...
  const currentOrgId = React.useMemo(() => {
    const match = pathname.match(/\/dashboard\/organizations\/([a-f0-9-]{36})/);
    return match?.[1] ?? null;
  }, [pathname]);

  React.useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    const result = await listUserOrganizationsAction();
    if (result.ok && result.data) {
      setOrgs(result.data.organizations);
    }
    setLoading(false);
  }

  if (orgs.length <= 1 && !loading) return null;

  const currentOrg = orgs.find((o) => o.id === currentOrgId);
  const otherOrgs = orgs.filter((o) => o.id !== currentOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-9 px-3 ring-2 ring-transparent transition-all hover:ring-primary/20"
          aria-label="Switch organization"
        >
          <Building2 className="h-4 w-4" />
          <span className="truncate max-w-[160px] font-medium">{currentOrg?.name || "Organization"}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2" sideOffset={5}>
        <DropdownMenuLabel className="font-normal px-1 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Your organizations</span>
            <Link
              href="/dashboard/organizations/new"
              className="text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3 inline mr-1" /> New
            </Link>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <>
            {currentOrg && (
              <DropdownMenuItem className="relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="truncate font-medium">{currentOrg.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{currentOrg.role}</span>
                <Check className="ml-auto h-4 w-4 text-primary" />
              </DropdownMenuItem>
            )}
            {otherOrgs.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {otherOrgs.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    asChild
                    className="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <Link
                      href={`/dashboard/organizations/${org.id}`}
                      className="flex w-full items-center gap-2"
                    >
                      <Building2 className="h-4 w-4" />
                      <span className="truncate font-medium">{org.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{org.role}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard/organizations"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Building2 className="h-4 w-4" />
            Manage organizations
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}