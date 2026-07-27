"use client";

import * as React from "react";

import {
  approveInvoiceIvoToolAction,
  deliverInvoiceIvoToolAction,
  emailContractIvoToolAction,
  emailInvoiceIvoToolAction,
  emailWelcomeDocumentIvoToolAction,
  markInvoicePaidIvoToolAction,
  prepareContractWhatsAppIvoToolAction,
  prepareInvoiceWhatsAppIvoToolAction,
  prepareWelcomeWhatsAppIvoToolAction,
  publishWelcomeDocumentIvoToolAction,
  saveWelcomeTemplateIvoToolAction,
} from "@/features/ai-workflows/tool-actions";

/**
 * Invocation plumbing for Ivo's approval, delivery, and share-preparation
 * tools.
 *
 * Every one of these calls previously repeated the same four steps inline in
 * the panel: resolve or create the conversation, read the active run id, mint
 * or reuse a per-scope request id, and release that id in a `finally`. Ten
 * copies of that meant ten chances to omit the request id — and a delivery tool
 * without one loses its idempotency barrier, so a double-click emails a client
 * twice. Centralising it makes the barrier structural rather than remembered.
 *
 * This module is deliberately mechanical. It decides nothing about the domain:
 * no copy, no message kind, no block identity, no sequencing. Those are server
 * decisions carried on the tool's response descriptor.
 */

type ToolContext = {
  conversationIdRef: React.RefObject<string | null>;
  activeRunIdRef: React.RefObject<string | null>;
  ensureConversation: () => Promise<unknown>;
};

/** Returned when the panel cannot establish a conversation to bind the attempt to. */
type NoConversation = { ok: false; error: string };

const noConversation = (what: string): NoConversation => ({
  ok: false,
  error: `I couldn't start this ${what}. Please try again.`,
});

export function useIvoTools({
  conversationIdRef,
  activeRunIdRef,
  ensureConversation,
}: ToolContext) {
  // Scope -> request id, so concurrent UI clicks on the same entity share one
  // idempotency key instead of minting a fresh one per click.
  const requestKeysRef = React.useRef<
    Map<string, { requestId: string; activeCalls: number }>
  >(new Map());

  const acquireRequestKey = React.useCallback((scope: string) => {
    const existing = requestKeysRef.current.get(scope);
    if (existing) {
      existing.activeCalls += 1;
      return existing.requestId;
    }
    const created = crypto.randomUUID();
    requestKeysRef.current.set(scope, { requestId: created, activeCalls: 1 });
    return created;
  }, []);

  const releaseRequestKey = React.useCallback((scope: string, requestId: string) => {
    const current = requestKeysRef.current.get(scope);
    if (!current || current.requestId !== requestId) return;
    current.activeCalls -= 1;
    if (current.activeCalls <= 0) requestKeysRef.current.delete(scope);
  }, []);

  /** Resolves the conversation id, creating the conversation if needed. */
  const conversation = React.useCallback(async () => {
    await ensureConversation();
    return conversationIdRef.current;
  }, [conversationIdRef, ensureConversation]);

  const base = React.useCallback(
    (conversationId: string) => ({
      conversationId,
      runId: activeRunIdRef.current ?? undefined,
    }),
    [activeRunIdRef],
  );

  /**
   * Runs a tool that needs a request id, holding one key for the whole call so
   * that overlapping invocations for the same entity cannot diverge.
   */
  const withRequestKey = React.useCallback(
    async <T>(
      scope: string,
      fixedRequestId: string | undefined,
      run: (requestId: string) => Promise<T>,
    ): Promise<T> => {
      const requestId = fixedRequestId ?? acquireRequestKey(scope);
      try {
        return await run(requestId);
      } finally {
        // A caller-supplied id is owned by the caller (it is the durable user
        // message id), so this hook must not retire it.
        if (!fixedRequestId) releaseRequestKey(scope, requestId);
      }
    },
    [acquireRequestKey, releaseRequestKey],
  );

  const emailInvoice = React.useCallback(
    async (invoiceId: string, fixedRequestId?: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("delivery");
      return withRequestKey(`invoice.email:${invoiceId}`, fixedRequestId, (requestId) =>
        emailInvoiceIvoToolAction({ ...base(conversationId), invoiceId, requestId }),
      );
    },
    [base, conversation, withRequestKey],
  );

  /** Server-sequenced invoice delivery across one or both channels. */
  const deliverInvoice = React.useCallback(
    async (invoiceId: string, channel: "email" | "whatsapp" | "both") => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("delivery");
      return withRequestKey(`invoice.deliver:${invoiceId}`, undefined, (requestId) =>
        deliverInvoiceIvoToolAction({
          ...base(conversationId),
          invoiceId,
          channel,
          requestId,
        }),
      );
    },
    [base, conversation, withRequestKey],
  );

  const emailContract = React.useCallback(
    async (contractId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("delivery");
      return withRequestKey(`contract.email:${contractId}`, undefined, (requestId) =>
        emailContractIvoToolAction({ ...base(conversationId), contractId, requestId }),
      );
    },
    [base, conversation, withRequestKey],
  );

  const emailWelcomeDocument = React.useCallback(
    async (welcomeDocId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("delivery");
      return withRequestKey(`welcome_document.email:${welcomeDocId}`, undefined, (requestId) =>
        emailWelcomeDocumentIvoToolAction({ ...base(conversationId), welcomeDocId, requestId }),
      );
    },
    [base, conversation, withRequestKey],
  );

  const saveWelcomeTemplate = React.useCallback(
    async (welcomeDocId: string, title: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("template save");
      return withRequestKey(
        `welcome_document.save_template:${welcomeDocId}`,
        undefined,
        (requestId) =>
          saveWelcomeTemplateIvoToolAction({
            ...base(conversationId),
            requestId,
            welcomeDocId,
            title,
          }),
      );
    },
    [base, conversation, withRequestKey],
  );

  const approveInvoice = React.useCallback(
    async (invoiceId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("approval");
      return approveInvoiceIvoToolAction({ ...base(conversationId), invoiceId });
    },
    [base, conversation],
  );

  const markInvoicePaid = React.useCallback(
    async (invoiceId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("status change");
      return markInvoicePaidIvoToolAction({ ...base(conversationId), invoiceId });
    },
    [base, conversation],
  );

  const publishWelcomeDocument = React.useCallback(
    async (welcomeDocId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("publishing action");
      return publishWelcomeDocumentIvoToolAction({ ...base(conversationId), welcomeDocId });
    },
    [base, conversation],
  );

  const prepareInvoiceWhatsApp = React.useCallback(
    async (invoiceId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("WhatsApp share");
      return prepareInvoiceWhatsAppIvoToolAction({ ...base(conversationId), invoiceId });
    },
    [base, conversation],
  );

  const prepareContractWhatsApp = React.useCallback(
    async (contractId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("WhatsApp share");
      return prepareContractWhatsAppIvoToolAction({ ...base(conversationId), contractId });
    },
    [base, conversation],
  );

  const prepareWelcomeWhatsApp = React.useCallback(
    async (welcomeDocId: string) => {
      const conversationId = await conversation();
      if (!conversationId) return noConversation("WhatsApp share");
      return prepareWelcomeWhatsAppIvoToolAction({ ...base(conversationId), welcomeDocId });
    },
    [base, conversation],
  );

  return React.useMemo(
    () => ({
      approveInvoice,
      deliverInvoice,
      emailContract,
      emailInvoice,
      emailWelcomeDocument,
      markInvoicePaid,
      prepareContractWhatsApp,
      prepareInvoiceWhatsApp,
      prepareWelcomeWhatsApp,
      publishWelcomeDocument,
      saveWelcomeTemplate,
    }),
    [
      approveInvoice,
      deliverInvoice,
      emailContract,
      emailInvoice,
      emailWelcomeDocument,
      markInvoicePaid,
      prepareContractWhatsApp,
      prepareInvoiceWhatsApp,
      prepareWelcomeWhatsApp,
      publishWelcomeDocument,
      saveWelcomeTemplate,
    ],
  );
}
