/**
 * /help/tickets/[id] — in-app support conversation for the signed-in user.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMyTicketThread } from "@/features/support/ticket-server";
import { TicketThread } from "@/features/support/components/ticket-thread";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const thread = await getMyTicketThread(id);
  return {
    title: thread ? `${thread.ticket.subject} — Support` : "Support ticket",
  };
}

export default async function TicketDetailPage({ params }: Props) {
  const { id } = await params;
  const thread = await getMyTicketThread(id);
  if (!thread) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Back to Help
      </Link>
      <TicketThread ticket={thread.ticket} messages={thread.messages} mode="user" />
    </div>
  );
}
