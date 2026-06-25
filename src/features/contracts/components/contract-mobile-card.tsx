"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Eye,
  FileSignature,
  MoreVertical,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { ContractRecord } from "../server";
import { CONTRACT_KIND_LABEL } from "../status";
import { ContractStatusBadge } from "./contract-status-badge";
import { SwipeRow, type SwipeAction } from "@/components/ui/swipe-row";

interface ContractMobileCardProps {
  contract: ContractRecord;
  clientName: string | null;
  onDelete: () => void;
  onResend: () => void;
}

/**
 * App-native mobile card for a single contract. Mirrors the visual language
 * of `InvoiceMobileCard` and `ClientMobileCard`: title row with status
 * badge, secondary meta line, footer with date + value + overflow menu.
 *
 * Whole card is tappable → routes to the contract detail page. The overflow
 * menu offers View / Send-or-Resend / Delete with proper status gating.
 */
export function ContractMobileCard({
  contract,
  clientName,
  onDelete,
  onResend,
}: ContractMobileCardProps) {
  const created = new Date(contract.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const canSend =
    contract.status === "draft" ||
    contract.status === "sent" ||
    contract.status === "viewed";
  const sendLabel =
    contract.status === "draft" ? "Send for signature" : "Resend";

  const swipeActions: SwipeAction[] = [
    ...(canSend
      ? [{ label: contract.status === "draft" ? "Send" : "Resend", icon: Send, onClick: onResend }]
      : []),
    { label: "Delete", icon: Trash2, onClick: onDelete, destructive: true },
  ];

  return (
    <SwipeRow actions={swipeActions} className="rounded-xl">
    <Link
      href={`/dashboard/contracts/${contract.id}`}
      className={cn(
        "tap-scale group relative flex w-full flex-col gap-2 rounded-xl border bg-card p-3.5 text-left shadow-sm transition-colors active:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileSignature className="h-4 w-4" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold leading-tight">
              {contract.title}
            </p>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {CONTRACT_KIND_LABEL[contract.kind]}
            {clientName ? <> · {clientName}</> : null}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-2 text-[11px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">Created {created}</span>
          {contract.valueAmount != null && contract.valueAmount > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium tabular-nums text-foreground/80">
                {formatMoney(contract.valueAmount, contract.currency)}
              </span>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label="Contract actions"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
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
                <Link href={`/dashboard/contracts/${contract.id}`}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Link>
              </DropdownMenuItem>
              {canSend ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onResend();
                  }}
                >
                  <Send className="h-3.5 w-3.5" /> {sendLabel}
                </DropdownMenuItem>
              ) : null}
              {contract.status !== "signed" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      onDelete();
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ChevronRight
            className="h-4 w-4 text-muted-foreground/60"
            aria-hidden
          />
        </div>
      </div>
    </Link>
    </SwipeRow>
  );
}
