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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-2 sm:flex sm:min-w-0 sm:items-center">
        <div className="relative w-full sm:w-80 sm:shrink-0">
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

        <div className="w-full sm:w-[160px] sm:shrink-0">
          <Select
            value={gst}
            onValueChange={(v) =>
              table
                .getColumn("gstRegistered")
                ?.setFilterValue(v === "all" ? undefined : v)
            }
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="GST status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              <SelectItem value="yes">GST registered</SelectItem>
              <SelectItem value="no">Unregistered</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

      <div className="flex shrink-0 items-center gap-2">
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
