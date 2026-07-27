"use server";

/**
 * The complete set of Ivo server actions the assistant panel may call directly.
 *
 * Every export in a `"use server"` module is a publicly reachable endpoint, so
 * this file exists to keep that surface small, legible, and auditable in one
 * place. Everything here is read-only or a metering read: none of it mutates
 * workspace data, sends anything to a client, or changes financial state.
 *
 * Mutations do not belong here. They live in `domain-operations.ts` as plain
 * server functions and are reachable only through the typed tools in
 * `tool-actions.ts`, which enforce ownership, idempotency, approval policy, and
 * the durable action ledger. Adding a mutating export to this file would
 * reintroduce exactly the bypass this split was made to close.
 */

import {
  answerBusinessQuestionAction as answerBusinessQuestion,
  answerFromDocsAction as answerFromDocs,
  getAiUsageAction as getAiUsage,
  getAssistantSuggestionsAction as getAssistantSuggestionsInternal,
  listClientsForAiAction as listClientsForAi,
  listContractsForAiAction as listContractsForAi,
  listInvoicesForAiAction as listInvoicesForAi,
  listProjectsForAiAction as listProjectsForAi,
  listWelcomeDocsForAiAction as listWelcomeDocsForAi,
} from "./domain-operations";

type BusinessQuestionInput = Parameters<typeof answerBusinessQuestion>[0];
type DocsQuestionInput = Parameters<typeof answerFromDocs>[0];

/** Grounded answer to a question about the caller's own workspace figures. */
export async function answerBusinessQuestionAction(input: BusinessQuestionInput) {
  return answerBusinessQuestion(input);
}

/** Answer a product/support question from the Stackivo help sources. */
export async function answerFromDocsAction(input: DocsQuestionInput) {
  return answerFromDocs(input);
}

/** Current month's AI-message usage, for the in-panel usage indicator. */
export async function getAiUsageAction() {
  return getAiUsage();
}

/** Computed cash-flow and workspace nudges shown when the panel opens. */
export async function getAssistantSuggestionsAction() {
  return getAssistantSuggestionsInternal();
}

export async function listClientsForAiAction() {
  return listClientsForAi();
}

export async function listContractsForAiAction(input: { filter?: "pending" | "all" } = {}) {
  return listContractsForAi(input);
}

export async function listInvoicesForAiAction(
  input: { filter?: "unpaid" | "overdue" | "all" } = {},
) {
  return listInvoicesForAi(input);
}

export async function listProjectsForAiAction(input: { filter?: "active" | "all" } = {}) {
  return listProjectsForAi(input);
}

export async function listWelcomeDocsForAiAction(input: { filter?: "open" | "all" } = {}) {
  return listWelcomeDocsForAi(input);
}
