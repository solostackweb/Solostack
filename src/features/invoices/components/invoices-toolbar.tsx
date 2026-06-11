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

import type { InvoiceRecord } from "../server";
import { INVOICE_STATUS_LABEL, INVOICE_STATUSES } from "../status";

interface InvoicesToolbarProps {
  table: Table<InvoiceRecord>;
  /** Distinct client options as `{ value: clientName, label: clientName }`. */
  clientOptions: Array<{ value: string; label: string }>;
}

export function InvoicesToolbar({
  table,
  clientOptions,
}: InvoicesToolbarProps) {
  const search =
    (table.getColumn("invoiceNumber")?.getFilterValue() as string | undefined) ?? "";
  const status =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ??
    "all";
  const client =
    (table.getColumn("clientId")?.getFilterValue() as string | undefined) ??
    "all";

  const isFiltered =
    !!search ||
    (status && status !== "all") ||
    (client && client !== "all");

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) =>
              table.getColumn("invoiceNumber")?.setFilterValue(e.target.value)
            }
            placeholder="Search by number or client…"
            className="h-9 pl-8"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) =>
            table
              .getColumn("status")
              ?.setFilterValue(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-[150px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {INVOICE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={client}
          onValueChange={(v) =>
            table
              .getColumn("clientId")
              ?.setFilterValue(v === "all" ? undefined : v)
          }
        >
          <SelectTrigger className="h-9 w-full sm:w-[180px] text-xs">
            <SelectValue placeholder="Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clientOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
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
            table.getColumn("invoiceNumber")?.setFilterValue("");
            table.getColumn("status")?.setFilterValue(undefined);
            table.getColumn("clientId")?.setFilterValue(undefined);
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
