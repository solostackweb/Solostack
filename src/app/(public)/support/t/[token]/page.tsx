/**
 * /support/t/[token] — public guest view of a support conversation.
 *
 * Served to logged-out visitors who created a ticket via the marketing
 * contact form (or whose email reply created one). The token IS the
 * authorisation — no account required.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { getGuestTicketThread } from "@/features/support/ticket-server";
import { TicketThread } from "@/features/support/components/ticket-thread";
import { StackivoWordmark } from "@/components/brand/stackivo-logo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export function generateMetadata() {
  return { title: "Support conversation", robots: { index: false, follow: false } };
}

export default async function GuestSupportPage({ params }: Props) {
  const { token } = await params;
  const thread = await getGuestTicketThread(token);
  if (!thread) notFound();

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center">
          <StackivoWordmark className="h-6 w-auto" />
        </Link>
        <span className="text-xs text-muted-foreground">Support</span>
      </div>
      <div className="rounded-xl border bg-card p-4 sm:p-6">
        <TicketThread ticket={thread.ticket} messages={thread.messages} mode="guest" />
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Keep this link to return to your conversation. You can also reply to our emails directly.
      </p>
    </div>
  );
}
