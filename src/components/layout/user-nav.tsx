"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/features/profile/context";
import { getDisplayName, getInitials } from "@/features/profile/utils";
import { logoutAction } from "@/features/auth/actions";

export function UserNav() {
  const { profile, subscription } = useProfile();
  const displayName = getDisplayName(profile);
  const initials = getInitials(displayName || profile?.fullName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account menu"
          className="rounded-full ring-2 ring-transparent transition-all hover:ring-primary/20"
        >
          <Avatar className="h-8 w-8 ring-1 ring-border">
            <AvatarImage src={profile?.avatarUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-gradient-to-br from-primary/15 to-blue-500/15 text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3 px-1 py-1">
            <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border">
              <AvatarImage src={profile?.avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-primary/15 to-blue-500/15 text-sm font-bold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-semibold leading-none">
                {displayName || "Your profile"}
              </p>
              <p className="truncate text-xs leading-tight text-muted-foreground">
                {profile?.email ?? ""}
              </p>
              <p className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-micro font-bold uppercase tracking-wider text-primary">
                {subscription?.plan ?? "free"} plan
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/profile">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logoutAction} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
