/**
 * /admin/support/[id] - first-party ticket conversation.
 *
 *   Left  - full thread (incl. internal notes) + reply box
 *   Right - controls (status/priority/category/tags) + customer context
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, User, ExternalLink } from "lucide-react";

import { requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, Panel } from "@/components/admin/kit";
import { adminGetTicketThread, listCannedResponses } from "@/features/support/ticket-server";
import { getTicketCustomerContext } from "@/features/support/admin-tickets";
import { AdminTicketReply } from "@/features/support/components/admin-ticket-reply";
import { AdminTicketControls } from "@/features/support/components/admin-ticket-controls";
import { TicketStatusBadge } from "@/features/support/components/ticket-status-badge";
import { formatIstStamp } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const thread = await adminGetTicketThread(id);
  if (!thread) notFound();
  const { ticket, messages } = thread;

  const [context, canned] = await Promise.all([
    getTicketCustomerContext(ticket),
    listCannedResponses(),
  ]);

  return (
    <AdminSection className="space-y-4">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> Back to inbox
      </Link>

      <AdminPageHeader
        title={ticket.subject}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} audience="admin" />
            <span className="text-xs text-muted-foreground">
              {ticket.email} - opened {formatIstStamp(ticket.created_at)}
            </span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* Conversation */}
        <div className="space-y-3">
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm shadow-black/[0.03]">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages.</p>
            ) : (
              messages.map((m) => {
                if (m.is_internal_note) {
                  return (
                    <div key={m.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Internal note - {formatIstStamp(m.created_at)}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                    </div>
                  );
                }
                const fromCustomer = m.author_type === "customer";
                return (
                  <div key={m.id} className={cn("flex", fromCustomer ? "justify-start" : "justify-end")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                      fromCustomer ? "bg-muted text-foreground" : "bg-primary/10 text-foreground",
                    )}>
                      <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {fromCustomer ? "Customer" : m.author_type === "agent" ? "You" : m.author_type} - {formatIstStamp(m.created_at)}
                      </div>
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <AdminTicketReply ticketId={ticket.id} canned={canned} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Panel title="Ticket" className="p-4">
            <AdminTicketControls ticket={ticket} />
          </Panel>

          <Panel title="Customer" className="p-4">
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium capitalize">{context.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total tickets</dt>
                <dd className="font-medium">{context.totalTickets}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Open tickets</dt>
                <dd className="font-medium">{context.openTickets}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate font-medium">{ticket.email}</dd>
              </div>
              {ticket.source_page ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">From page</dt>
                  <dd className="truncate font-mono">{ticket.source_page}</dd>
                </div>
              ) : null}
            </dl>
            {context.userId ? (
              <Link
                href={`/admin/users/${context.userId}`}
                className="mt-3 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <User className="h-3 w-3" /> View user <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">Guest (no account)</p>
            )}
          </Panel>
        </aside>
      </div>
    </AdminSection>
  );
}
