"use client";

import { format } from "date-fns";
import Link from "next/link";
import { Pause, Play, Trash2, Edit, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { pauseRecurringInvoiceAction } from "@/features/invoices/recurring-actions";
import { resumeRecurringInvoiceAction } from "@/features/invoices/recurring-actions";
import { deleteRecurringInvoiceAction } from "@/features/invoices/recurring-actions";
import { toast } from "sonner";
import type { RecurringInvoiceListItem } from "@/features/invoices/recurring-actions";

function createFormData(id: string): FormData {
  const fd = new FormData();
  fd.append("id", id);
  return fd;
}

interface RecurringInvoicesViewProps {
  items: RecurringInvoiceListItem[];
}

function formatFrequency(freq: string, interval: number): string {
  const labels: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  };
  const base = labels[freq] ?? freq;
  return interval > 1 ? `Every ${interval} ${base.toLowerCase()}s` : base;
}

function getStatusBadge(isActive: boolean, pausedAt: string | null) {
  if (!isActive && pausedAt) {
    return <Badge variant="secondary">Paused</Badge>;
  }
  if (!isActive) {
    return <Badge variant="destructive">Ended</Badge>;
  }
  return <Badge variant="success">Active</Badge>;
}

export function RecurringInvoicesView({ items }: RecurringInvoicesViewProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">No recurring invoices yet</p>
          <Button asChild>
            <Link href="/dashboard/invoices/recurring/new">Create your first template</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="font-medium truncate">
                      {item.client_id ? `Client: ${item.client_id}` : "No client"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFrequency(item.frequency, item.interval)}
                      {item.day_of_month && ` · Day ${item.day_of_month}`}
                      {item.day_of_week !== null && item.day_of_week !== undefined && (
                        <>
                          {' '}·{' '}
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][item.day_of_week]}
                        </>
                      )}
                    </p>
                  </div>
                  {getStatusBadge(item.is_active, item.paused_at)}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>Next: {item.next_generation_at ? format(new Date(item.next_generation_at), "MMM d, yyyy") : "—"}</span>
                  <span>Generated: {item.generation_count}</span>
                  <span>Currency: {item.currency}</span>
                  {item.max_occurrences && <span>Max: {item.max_occurrences}</span>}
                  {item.end_date && <span>Ends: {format(new Date(item.end_date), "MMM d, yyyy")}</span>}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <a href={`/dashboard/invoices/recurring/${item.id}/edit`}>
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </a>
                  </DropdownMenuItem>
                  {item.is_active && !item.paused_at ? (
                    <>
                      <DropdownMenuItem
                        onClick={async () => {
                          const res = await pauseRecurringInvoiceAction(undefined, createFormData(item.id));
                          if (res.ok) {
                            toast.success("Recurring invoice paused");
                            window.location.reload();
                          } else {
                            toast.error(res.error);
                          }
                        }}
                      >
                        <Pause className="h-4 w-4 mr-2" /> Pause
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      onClick={async () => {
                        const res = await resumeRecurringInvoiceAction(undefined, createFormData(item.id));
                        if (res.ok) {
                          toast.success("Recurring invoice resumed");
                          window.location.reload();
                        } else {
                          toast.error(res.error);
                        }
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" /> Resume
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={async () => {
                      if (!confirm("Delete this recurring invoice template? Generated invoices will not be affected.")) return;
                      const res = await deleteRecurringInvoiceAction(undefined, createFormData(item.id));
                      if (res.ok) {
                        toast.success("Recurring invoice deleted");
                        window.location.reload();
                      } else {
                        toast.error(res.error);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}