"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { cn } from "@/lib/utils";

import type { ClientRecord } from "../server";

interface ClientsToolbarProps {
  table: Table<ClientRecord>;
}

/**
 * Toolbar for the clients table. Wires the client-side TanStack table
 * filters; backed by the column ids declared in `clients-columns.tsx`.
 */
export function ClientsToolbar({ table }: ClientsToolbarProps) {
  const search =
    (table.getColumn("name")?.getFilterValue() as string | undefined) ?? "";
  const gst =
    (table.getColumn("gstRegistered")?.getFilterValue() as string | undefined) ??
    "all";

  const isFiltered = !!search || (gst && gst !== "all");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-1 sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) =>
              table.getColumn("name")?.setFilterValue(e.target.value)
            }
            placeholder="Search clients…"
            className="h-9 pl-8"
          />
        </div>

        <Select
          value={gst}
          onValueChange={(v) =>
            table
              .getColumn("gstRegistered")
              ?.setFilterValue(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="h-9 w-full text-xs sm:w-[160px]">
            <SelectValue placeholder="GST status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            <SelectItem value="yes">GST registered</SelectItem>
            <SelectItem value="no">Unregistered</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 w-[74px] px-2 text-xs transition-opacity",
            !isFiltered && "pointer-events-none invisible opacity-0",
          )}
          aria-hidden={!isFiltered}
          tabIndex={isFiltered ? 0 : -1}
          onClick={() => {
            table.getColumn("name")?.setFilterValue("");
            table.getColumn("gstRegistered")?.setFilterValue(undefined);
          }}
        >
          Reset <X className="ml-1 h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
