import { cn } from "@/lib/utils";
import type { TicketStatus } from "../ticket-types";

const STATUS_STYLES: Record<TicketStatus, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  waiting_on_us: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  waiting_on_customer: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  resolved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

/** Customer-facing labels (admin uses raw status names). */
const STATUS_LABEL_CUSTOMER: Record<TicketStatus, string> = {
  new: "Received",
  open: "Open",
  waiting_on_us: "In progress",
  waiting_on_customer: "Awaiting your reply",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_LABEL_ADMIN: Record<TicketStatus, string> = {
  new: "New",
  open: "Open",
  waiting_on_us: "Waiting on us",
  waiting_on_customer: "Waiting on customer",
  resolved: "Resolved",
  closed: "Closed",
};

export function TicketStatusBadge({
  status,
  audience = "customer",
  className,
}: {
  status: TicketStatus;
  audience?: "customer" | "admin";
  className?: string;
}) {
  const label =
    audience === "admin" ? STATUS_LABEL_ADMIN[status] : STATUS_LABEL_CUSTOMER[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {label}
    </span>
  );
}
