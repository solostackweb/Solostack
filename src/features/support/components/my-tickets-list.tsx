import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import type { SupportTicket } from "../ticket-types";
import { TicketStatusBadge } from "./ticket-status-badge";

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Read-only list of the signed-in user's support tickets. */
export function MyTicketsList({ tickets }: { tickets: SupportTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-card p-3 text-xs text-muted-foreground">
        <Inbox className="h-4 w-4" />
        You haven&rsquo;t opened any tickets yet.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link
            href={`/help/tickets/${t.id}`}
            className="flex items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.subject}</p>
              <p className="text-[11px] text-muted-foreground">
                Updated {formatStamp(t.last_message_at)}
              </p>
            </div>
            <TicketStatusBadge status={t.status} />
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
