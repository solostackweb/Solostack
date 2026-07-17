import { NextRequest } from "next/server";

import { processIvoMessageAction } from "@/features/ai-workflows/conversation-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streaming front door for Ivo messages.
 *
 * The assistant UI POSTs the same payload it would pass to
 * `processIvoMessageAction` and receives Server-Sent Events:
 *
 *   event: status  data: {"text":"Reading your invoices…"}   (0..n times)
 *   event: result  data: <processIvoMessageAction return value>  (exactly once)
 *
 * Auth, quota, rate limiting, persistence, and the run ledger all live inside
 * the action (cookie-scoped Supabase session works identically here). The UI
 * falls back to invoking the server action directly if this route fails, so
 * streaming is purely progressive enhancement.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, reason: "validation", error: "Tell me what you'd like to do." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      try {
        const result = await processIvoMessageAction(
          body as Parameters<typeof processIvoMessageAction>[0],
          {
            onStatus: (text) => send("status", { text }),
            onDelta: (text) => send("delta", { text }),
          },
        );
        send("result", result);
      } catch {
        send("result", {
          ok: false,
          reason: "runtime",
          error: "Ivo couldn't process that message.",
          usageConsumed: false,
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
