import "server-only";

/**
 * Canonical URL helpers for shared documents.
 *
 * Public share routes are `/i/<token>` (invoice) and `/c/<token>`
 * (contract). PDF download endpoints sit under `/api/share/...`.
 *
 * The base URL comes from `NEXT_PUBLIC_APP_URL` so the same code works
 * in dev (`http://localhost:3000`) and prod (`https://app.stackivo.in`).
 */

import { env } from "@/config/env";

export function getPublicAppUrl(): string {
  return env.appUrl.replace(/\/$/, "");
}

export function getInvoiceShareUrl(token: string): string {
  return `${getPublicAppUrl()}/i/${token}`;
}

export function getContractShareUrl(token: string): string {
  return `${getPublicAppUrl()}/c/${token}`;
}

export function getProposalShareUrl(token: string): string {
  return `${getPublicAppUrl()}/p/${token}`;
}

export function getProposalPdfShareUrl(token: string): string {
  return `${getPublicAppUrl()}/api/share/proposal/${token}/pdf`;
}

export function getContractPdfShareUrl(token: string): string {
  return `${getPublicAppUrl()}/api/share/contract/${token}/pdf`;
}

export function getInvoicePdfShareUrl(token: string): string {
  return `${getPublicAppUrl()}/api/share/invoice/${token}/pdf`;
}
