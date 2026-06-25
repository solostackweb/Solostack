"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  FilePlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SwipeRow, type SwipeAction } from "@/components/ui/swipe-row";
import { getStateName } from "@/features/gst/state-codes";
import type { ClientRecord } from "../server";
import { getClientDisplayName, getClientInitials } from "../utils";

interface ClientMobileCardProps {
  client: ClientRecord;
  isSelected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /**
   * When true, the leading checkbox is shown. We hide it by default to keep
   * the card chrome quiet — selection mode can be entered with a long-press
   * or via the row's overflow menu in a future iteration.
   */
  showCheckbox?: boolean;
}

/**
 * App-native mobile card for a single client. Replaces a horizontally
 * scrolling table row on phone-sized viewports.
 */
export function ClientMobileCard({
  client,
  isSelected,
  onToggleSelected,
  onOpen,
  onEdit,
  onDelete,
  showCheckbox = false,
}: ClientMobileCardProps) {
  const display = getClientDisplayName(client);
  const stateName = client.stateCode ? getStateName(client.stateCode) : null;
  const contact = client.email ?? client.phone ?? null;

  const swipeActions: SwipeAction[] = [
    { label: "Edit", icon: Pencil, onClick: onEdit },
    { label: "Delete", icon: Trash2, onClick: onDelete, destructive: true },
  ];

  return (
    <SwipeRow actions={swipeActions} className="rounded-xl">
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "tap-scale group relative flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors active:bg-muted/40",
        isSelected && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      {showCheckbox && (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelected}
            aria-label={`Select ${display}`}
          />
        </div>
      )}

      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="text-[11px] font-semibold">
          {getClientInitials(display)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold leading-tight">
            {display}
          </p>
          {client.isForeign ? (
            <Badge
              variant="secondary"
              className="h-4 shrink-0 bg-sky-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300"
            >
              Intl
            </Badge>
          ) : client.gstRegistered ? (
            <Badge
              variant="secondary"
              className="h-4 shrink-0 px-1.5 text-[9px] font-semibold uppercase tracking-wider"
            >
              GST
            </Badge>
          ) : null}
        </div>
        {contact ? (
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {contact}
          </p>
        ) : null}
        {stateName ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
            {stateName}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              aria-label="Client actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/clients/${client.id}`}>
                <ExternalLink className="h-3.5 w-3.5" /> View profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/invoices/new">
                <FilePlus className="h-3.5 w-3.5" /> Create invoice
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChevronRight className="h-4 w-4 text-muted-foreground/60" aria-hidden />
      </div>
    </div>
    </SwipeRow>
  );
}
