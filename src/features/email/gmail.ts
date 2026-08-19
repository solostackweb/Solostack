import "server-only";

import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import type { BrevoAttachment } from "./client";

/**
 * Gmail API transport — used only when a freelancer has connected Google and
 * explicitly opted into sending client-facing document email from their own
 * address. Brevo remains the default and the fallback for everything else.
 *
 * Gmail's send endpoint takes a raw RFC 5322 message, so this module's real
 * job is building correct MIME rather than talking to an SDK.
 */

const GMAIL_SEND =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export interface GmailAddress {
  email: string;
  name?: string;
}

export interface GmailSendInput {
  accessToken: string;
  /**
   * Optional. Omitted, Gmail stamps the authenticated account's own name and
   * address — which is exactly what send-as is for, so callers rarely set it.
   */
  from?: GmailAddress;
  to: GmailAddress;
  cc?: GmailAddress[];
  replyTo?: GmailAddress;
  subject: string;
  html: string;
  text?: string;
  attachments?: BrevoAttachment[];
  headers?: Record<string, string>;
}

/** RFC 2047 encoded-word — keeps non-ASCII display names and subjects intact. */
function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress(address: GmailAddress): string {
  if (!address.name) return address.email;
  return `${encodeHeaderValue(address.name)} <${address.email}>`;
}

/** Header values must never carry CR/LF — that's how header injection works. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function chunkBase64(input: string): string {
  return input.replace(/(.{76})/g, "$1\r\n");
}

function buildMimeMessage(input: GmailSendInput): string {
  const altBoundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
  const mixedBoundary = `mix_${crypto.randomUUID().replace(/-/g, "")}`;
  const hasAttachments = Boolean(input.attachments?.length);

  const headers: string[] = [];
  if (input.from) {
    headers.push(`From: ${sanitizeHeaderValue(formatAddress(input.from))}`);
  }
  headers.push(`To: ${sanitizeHeaderValue(formatAddress(input.to))}`);
  if (input.cc?.length) {
    headers.push(
      `Cc: ${sanitizeHeaderValue(input.cc.map(formatAddress).join(", "))}`,
    );
  }
  if (input.replyTo) {
    headers.push(
      `Reply-To: ${sanitizeHeaderValue(formatAddress(input.replyTo))}`,
    );
  }
  headers.push(
    `Subject: ${sanitizeHeaderValue(encodeHeaderValue(input.subject))}`,
  );
  for (const [key, value] of Object.entries(input.headers ?? {})) {
    headers.push(`${sanitizeHeaderValue(key)}: ${sanitizeHeaderValue(value)}`);
  }
  headers.push("MIME-Version: 1.0");

  const alternative = [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(
      Buffer.from(input.text ?? stripHtml(input.html), "utf8").toString(
        "base64",
      ),
    ),
    "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    chunkBase64(Buffer.from(input.html, "utf8").toString("base64")),
    "",
    `--${altBoundary}--`,
  ].join("\r\n");

  if (!hasAttachments) {
    return [...headers, alternative].join("\r\n");
  }

  const parts: string[] = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    alternative,
    "",
  ];

  for (const attachment of input.attachments ?? []) {
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${attachmentContentType(
        attachment.name,
      )}; name="${sanitizeHeaderValue(attachment.name)}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${sanitizeHeaderValue(
        attachment.name,
      )}"`,
      "",
      chunkBase64(attachment.content.toString("base64")),
      "",
    );
  }
  parts.push(`--${mixedBoundary}--`);

  return parts.join("\r\n");
}

/**
 * Declare what an attachment actually is. `application/octet-stream` on a PDF
 * both renders worse in mail clients and scores worse with filters, which
 * treat unidentified binary as more suspicious than a named document type.
 */
function attachmentContentType(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "ics":
      return "text/calendar; charset=UTF-8; method=REQUEST";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "csv":
      return "text/csv; charset=UTF-8";
    case "txt":
      return "text/plain; charset=UTF-8";
    default:
      return "application/octet-stream";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class GmailSendError extends Error {
  // Written as a plain field rather than a constructor parameter property:
  // the repo's eval runner uses Node's strip-only TypeScript mode, which
  // rejects parameter properties outright.
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "GmailSendError";
    this.status = status;
  }
}

/**
 * Send one message through the Gmail API. Throws GmailSendError on failure so
 * the caller can decide whether to fall back to Brevo.
 */
export async function sendGmailMessage(
  input: GmailSendInput,
): Promise<{ messageId: string }> {
  const raw = Buffer.from(buildMimeMessage(input), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  let res: Response;
  try {
    res = await fetch(GMAIL_SEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      cache: "no-store",
    });
  } catch (error) {
    throw new GmailSendError(
      error instanceof Error ? error.message : "Gmail request failed.",
      null,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GmailSendError(
      `Gmail send failed (${res.status}). ${body.slice(0, 300)}`.trim(),
      res.status,
    );
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { messageId: data.id ?? "" };
}
