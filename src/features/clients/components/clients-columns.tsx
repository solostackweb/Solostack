"use client";

import * as React from "react";
import Link from "next/link";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  FilePlus,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatRelativeTime } from "@/lib/format";
import { getStateName } from "@/features/gst/state-codes";

import type { ClientRecord } from "../server";
import { getClientDisplayName, getClientInitials } from "../utils";

interface ColumnActions {
  onEdit: (client: ClientRecord) => void;
  onDelete: (client: ClientRecord) => void;
}

export function buildClientColumns({
  onEdit,
  onDelete,
}: ColumnActions): ColumnDef<ClientRecord>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
          className="translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
          className="translate-y-[1px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "name",
      accessorFn: (c) => getClientDisplayName(c),
      meta: { label: "Name" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => {
        const c = row.original;
        const display = getClientDisplayName(c);
        return (
          <Link
            href={`/dashboard/clients/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-3 group/name"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-micro font-medium">
                {getClientInitials(display)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium group-hover/name:underline">
                {display}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {c.email ?? c.phone ?? "—"}
              </div>
            </div>
          </Link>
        );
      },
      filterFn: (row, _id, value) => {
        const q = String(value).toLowerCase();
        const c = row.original;
        return (
          c.fullName.toLowerCase().includes(q) ||
          (c.businessName ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
        );
      },
    },
    {
      id: "gstRegistered",
      accessorFn: (c) => (c.gstRegistered ? "yes" : "no"),
      meta: { label: "GST" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="GST" />
      ),
      cell: ({ row }) => {
        const c = row.original;
        if (c.isForeign) {
          return (
            <span className="inline-flex items-center rounded-full border border-info-subtle bg-info-subtle px-2 py-0.5 text-xs font-medium text-info-strong">
              International
            </span>
          );
        }
        if (!c.gstRegistered) {
          return <span className="text-xs text-muted-foreground">Unregistered</span>;
        }
        return (
          <span className="font-mono text-xs">
            {c.gstin ?? "—"}
          </span>
        );
      },
      filterFn: (row, id, value) => row.getValue(id) === value,
    },
    {
      accessorKey: "stateCode",
      meta: { label: "State" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="State" />
      ),
      cell: ({ row }) => {
        const code = row.original.stateCode;
        if (!code) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-sm text-muted-foreground">
            {getStateName(code) ?? code}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Added" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Added" />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(row.original.createdAt)}
        </span>
      ),
      sortingFn: (a, b) =>
        new Date(a.original.createdAt).getTime() -
        new Date(b.original.createdAt).getTime(),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const client = row.original;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/clients/${client.id}`}>
                    <ExternalLink /> View profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(client)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/invoices/new">
                    <FilePlus /> Create invoice
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(client)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
