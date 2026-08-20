"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
  type Table as TableType,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./data-table-pagination";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  /** Column definitions — use `DataTableColumnHeader` from this module for sortable headers. */
  columns: ColumnDef<TData, TValue>[];
  /** Row data. */
  data: TData[];
  /** Slot rendered above the table — typically a search input + filter selects. Receives the table instance. */
  toolbar?: (table: TableType<TData>) => React.ReactNode;
  /** Empty state slot rendered when the filtered set has no rows. */
  emptyState?: React.ReactNode;
  /** Optional row click handler (e.g., to navigate to a detail page). */
  onRowClick?: (row: TData) => void;
  /** Initial page size (default 10). */
  initialPageSize?: number;
  /** Hide the built-in pagination footer (default false). */
  hidePagination?: boolean;
  /** Slot rendered after the table (e.g. a bulk action bar). Receives the table instance. */
  bulkBar?: (table: TableType<TData>) => React.ReactNode;
  /**
   * Optional mobile renderer. When provided, the desktop table is hidden
   * under `md` and a card list is rendered instead. The same TanStack table
   * instance backs both views — sorting, filtering, selection, and
   * pagination all stay in sync.
   *
   * Receives the row data plus a small helpers object so callers can wire
   * row-selection checkboxes and click-to-open semantics consistently.
   */
  mobileCard?: (
    row: TData,
    helpers: {
      isSelected: boolean;
      toggleSelected: () => void;
      onOpen: () => void;
    },
  ) => React.ReactNode;
  className?: string;
}

/**
 * Generic, reusable TanStack-powered table.
 *
 * Owns its own state for sorting, filtering, column visibility, row selection,
 * and pagination — passes the `table` instance to `toolbar` so callers can
 * wire up search inputs and filter selects against the same instance.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  toolbar,
  emptyState,
  onRowClick,
  initialPageSize = 10,
  hidePagination,
  bulkBar,
  mobileCard,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    {},
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: initialPageSize } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("space-y-4", className)}>
      {toolbar?.(table)}

      {mobileCard && (
        <div className="space-y-2 md:hidden">
          {rows.length ? (
            rows.map((row) => (
              <React.Fragment key={row.id}>
                {mobileCard(row.original, {
                  isSelected: row.getIsSelected(),
                  toggleSelected: () => row.toggleSelected(!row.getIsSelected()),
                  onOpen: onRowClick ? () => onRowClick(row.original) : () => {},
                })}
              </React.Fragment>
            ))
          ) : (
            <div className="flex min-h-[12rem] items-center justify-center rounded-lg border bg-card p-6">
              {emptyState ?? (
                <span className="text-sm text-muted-foreground">No results.</span>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-card",
          mobileCard && "hidden md:block",
        )}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="bg-muted/30">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-48 text-center">
                  {emptyState ?? (
                    <span className="text-sm text-muted-foreground">
                      No results.
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!hidePagination && <DataTablePagination table={table} />}

      {bulkBar?.(table)}
    </div>
  );
}
