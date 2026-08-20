"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  align?: "left" | "right";
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span
        className={cn(
          "text-micro font-semibold uppercase tracking-wider text-muted-foreground",
          align === "right" && "block text-right",
          className,
        )}
      >
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "-ml-2 h-7 px-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground",
        align === "right" && "ml-auto",
        className,
      )}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDown className="ml-1 h-3 w-3" />
      ) : sorted === "asc" ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}
