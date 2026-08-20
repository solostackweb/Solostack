/**
 * Per-user support history widget on the user detail page.
 * Renders the latest first-party tickets; each links to /admin/support/[id].
 */

import Link from "next/link";
import { MessageCircle, ChevronRight } from "lucide-react";
import { formatRelative } from "@/features/admin/format";
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge";
import type { SupportTicket } from "@/features/support/ticket-types";

interface Props {
  userId: string;
  threads: SupportTicket[];
}

export function UserSupportThreads({ userId, threads }: Props) {
  void userId;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" />
        Recent support history
      </h2>

      {threads.length === 0 ? (
        <div className="rounded border border-dashed bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">
          No support tickets on file. New tickets will appear here.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border bg-card shadow-sm shadow-black/[0.03] text-xs">
          {threads.map((t) => (
            <li key={t.id} className="border-b border-border/40 last:border-b-0">
              <Link
                href={`/admin/support/${t.id}`}
                className="flex items-center gap-2 p-2.5 transition hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketStatusBadge status={t.status} audience="admin" />
                    <span className="truncate font-medium">{t.subject}</span>
                  </div>
                  <p className="mt-0.5 text-micro text-muted-foreground">
                    {t.category ? `${t.category} - ` : ""}
                    {formatRelative(t.last_message_at)}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
