import "server-only";

/**
 * Provider-agnostic transactional email service.
 *
 * The app calls this layer with a sender purpose (billing, share,
 * support, admin, connect). The service resolves the sender identity,
 * selects a configured Brevo transport, retries transient failures, and
 * only then emits the message to the provider adapter.
 */

import {
  getBrevoConfig,
  EmailTransportError,
  sendBrevoEmail,
  sendBrevoSmtpEmail,
  type BrevoAttachment,
  type BrevoSendInput,
} from "./client";
import { getEmailSender, type EmailSenderType } from "./senders";
import { getGmailSenderIdentity } from "./gmail-sender";
import { sendGmailMessage } from "./gmail";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailInput {
  type: EmailSenderType;
  to: EmailRecipient;
  cc?: EmailRecipient[];
  replyTo?: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  attachments?: BrevoAttachment[];
  metadata?: Record<string, unknown>;
  tags?: string[];
  headers?: Record<string, string>;
  /**
   * Route through this user's own Gmail when they've connected Google and
   * opted into send-as. Anything else — or any failure on that path — falls
   * through to Brevo, which stays the default and the guarantee.
   */
  asUserId?: string | null;
}

export interface SendEmailResult {
  messageId: string;
  provider: "brevo-api" | "brevo-smtp" | "gmail";
  sender: ReturnType<typeof getEmailSender>;
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const sender = getEmailSender(input.type);

  // Opt-in Gmail send-as. Deliberately best-effort: if the user's token has
  // expired or Gmail rejects the message we still deliver via Brevo rather
  // than dropping a client's invoice on the floor.
  if (input.asUserId) {
    const gmail = await getGmailSenderIdentity(input.asUserId);
    if (gmail) {
      // Drop a Reply-To that just points back at the sender. From and
      // Reply-To naming two different addresses for one person is a
      // needless mismatch for filters to weigh, and replying to yourself
      // was never the intent.
      const replyTo =
        input.replyTo &&
        input.replyTo.email.toLowerCase() !== gmail.email.toLowerCase()
          ? input.replyTo
          : undefined;

      try {
        const result = await sendGmailMessage({
          accessToken: gmail.accessToken,
          to: input.to,
          cc: input.cc,
          replyTo,
          subject: input.subject,
          html: input.html,
          text: input.text,
          attachments: input.attachments,
          headers: input.headers,
        });
        return { messageId: result.messageId, provider: "gmail", sender };
      } catch {
        // Fall through to Brevo below.
      }
    }
  }

  const config = getBrevoConfig();
  const transportOrder = resolveTransportOrder(config.transport, config);

  if (transportOrder.length === 0) {
    throw new Error(
      "Email is not configured. Set BREVO_API_KEY or Brevo SMTP credentials.",
    );
  }

  const payload: BrevoSendInput = {
    sender,
    to: input.to,
    cc: input.cc,
    replyTo: input.replyTo,
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text,
    attachments: input.attachments,
    tags: input.tags,
    headers: input.headers,
  };

  let lastError: unknown = null;
  for (const transport of transportOrder) {
    const result = await sendWithRetry(transport, payload, sender.type);
    if (result.ok) return result.value;
    lastError = result.error;
    // Skip the secondary transport when the failure was classified as
    // non-retryable (e.g. 400 "Sender not verified"). Both transports
    // share sender verification, account reputation, and recipient
    // suppressions — retrying via SMTP after an API 400 burns quota on a
    // deterministic failure.
    if (
      result.error instanceof EmailTransportError &&
      !result.error.retryable
    ) {
      break;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Email delivery failed.");
}

function resolveTransportOrder(
  preferred: "api" | "smtp",
  config: ReturnType<typeof getBrevoConfig>,
): Array<"api" | "smtp"> {
  const available: Array<"api" | "smtp"> = [];
  if (config.apiConfigured) available.push("api");
  if (config.smtpConfigured) available.push("smtp");

  if (available.length === 0) return [];

  if (!available.includes(preferred)) return available;

  return [preferred, ...available.filter((item) => item !== preferred)];
}

async function sendWithRetry(
  transport: "api" | "smtp",
  payload: BrevoSendInput,
  senderType: EmailSenderType,
): Promise<{ ok: true; value: SendEmailResult } | { ok: false; error: Error }> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result =
        transport === "api"
          ? await sendBrevoEmail(payload)
          : await sendBrevoSmtpEmail(payload);
      return {
        ok: true,
        value: {
          messageId: result.messageId,
          provider: transport === "api" ? "brevo-api" : "brevo-smtp",
          sender: getEmailSender(senderType),
        },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown email error.");
      if (attempt === attempts || !isRetryableEmailError(err)) {
        return { ok: false, error: err };
      }
      await wait(Math.min(250 * 2 ** (attempt - 1), 1500));
    }
  }

  return { ok: false, error: new Error("Email delivery failed.") };
}

function isRetryableEmailError(error: Error): boolean {
  // Typed errors carry an explicit retryable flag. Trust it.
  if (error instanceof EmailTransportError) {
    return error.retryable;
  }
  // For unknown errors, only retry on clear transient-network signals.
  // The previous `5\d\d` branch incorrectly matched any three-digit
  // substring in the message body (e.g. an invoice total formatted as
  // "599.00"), flipping deterministic failures into retry loops.
  return /timeout|network|ECONN(REFUSED|RESET)?|ETIMEDOUT|EAI_AGAIN/i.test(
    error.message,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
