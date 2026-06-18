/**
 * Stackivo — Cloudflare Email Worker (inbound support email → ticket).
 *
 * Cloudflare Email Routing delivers messages addressed to support@stackivo.me
 * (and plus-addressed variants like support+<token>@stackivo.me) to this
 * worker. It parses the sender, subject, plain-text body, Message-ID, and the
 * plus-address token, then POSTs a small JSON payload to the Stackivo app.
 *
 * Idempotency is handled server-side via the RFC Message-ID, so Cloudflare
 * retries are safe.
 *
 * Required secrets/vars (set with `wrangler secret put` / in the dashboard):
 *   STACKIVO_INBOUND_URL     e.g. https://stackivo.me/api/support/inbound
 *   SUPPORT_INBOUND_SECRET   must match the app's SUPPORT_INBOUND_SECRET
 *   FORWARD_TO               (optional) human mailbox to also receive a copy,
 *                            e.g. founder@yourworkspace.com
 *
 * Deploy: see README.md in this folder.
 */

export default {
  /**
   * @param {ForwardableEmailMessage} message
   * @param {{ STACKIVO_INBOUND_URL: string, SUPPORT_INBOUND_SECRET: string, FORWARD_TO?: string }} env
   */
  async email(message, env) {
    try {
      const to = String(message.to || "");
      const from = String(message.from || "");
      const headers = message.headers;
      const subject = headers.get("subject") || "";
      const messageId = headers.get("message-id") || "";

      // Extract the plus-address token: support+<token>@domain
      let token = null;
      const plus = to.match(/\+([^@]+)@/);
      if (plus) token = plus[1];

      // Read the raw message and pull a plain-text body.
      const raw = await streamToString(message.raw);
      const text = extractTextBody(raw);

      const fromName = parseFromName(headers.get("from") || from);

      const res = await fetch(env.STACKIVO_INBOUND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.SUPPORT_INBOUND_SECRET}`,
        },
        body: JSON.stringify({
          token,
          messageId,
          from,
          fromName,
          subject,
          text,
        }),
      });

      if (!res.ok) {
        // Non-2xx → let Cloudflare retry (server signalled a transient error).
        console.error("inbound POST failed", res.status, await safeText(res));
      }
    } catch (err) {
      console.error("worker error", err && err.message ? err.message : String(err));
    }

    // Optionally also forward a copy to a human mailbox (Google Workspace).
    if (env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (err) {
        console.error("forward failed", err && err.message ? err.message : String(err));
      }
    }
  },
};

async function streamToString(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  // Cap at ~1MB to stay well within worker limits.
  const MAX = 1_000_000;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total > MAX) break;
  }
  return new TextDecoder("utf-8").decode(concat(chunks, total));
}

function concat(chunks, total) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/**
 * Very small MIME helper: returns the first text/plain part (or, failing that,
 * a tag-stripped text/html part). Good enough for support replies; the app
 * additionally strips quoted trailers.
 */
function extractTextBody(raw) {
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (boundaryMatch) {
    const boundary = "--" + boundaryMatch[1];
    const parts = raw.split(boundary);
    let htmlFallback = "";
    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const head = part.slice(0, headerEnd).toLowerCase();
      let bodyPart = part.slice(headerEnd + 4).trim();
      bodyPart = decodeMaybe(head, bodyPart);
      if (head.includes("text/plain")) return bodyPart.trim();
      if (head.includes("text/html") && !htmlFallback) htmlFallback = stripHtml(bodyPart);
    }
    if (htmlFallback) return htmlFallback.trim();
  }
  // Not multipart: body is everything after the first blank line.
  const idx = raw.indexOf("\r\n\r\n");
  const body = idx === -1 ? raw : raw.slice(idx + 4);
  return /<[a-z][\s\S]*>/i.test(body) ? stripHtml(body).trim() : body.trim();
}

function decodeMaybe(head, body) {
  if (head.includes("quoted-printable")) {
    return body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseFromName(fromHeader) {
  const m = fromHeader.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
