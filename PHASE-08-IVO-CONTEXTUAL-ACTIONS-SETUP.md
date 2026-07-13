# Phase 08 - Ivo Contextual Actions Setup

## What This Phase Adds

- Reusable contextual Ivo action strip.
- Page-aware Ivo prompts on:
  - Client detail.
  - Project detail.
  - Invoice detail.
  - Proposal builder.
  - Contract detail.
  - Portal management.
  - Pulse.
- Prompts now pass the current record context into Ivo, such as status, client, value, balance due, GST/export state, and collection signals.
- Ivo remains approval-first. These entry points open the assistant and ask a contextual question; they do not send, create, or mutate records directly.

## Required Setup

- No new migration is required.
- No new environment variables are required.
- No new third-party accounts are required.

## Manual QA Checklist

- Open a client detail page and click each Ivo contextual action.
- Open a project detail page and confirm prompts mention project status/client/billing.
- Open an invoice detail page and confirm prompts mention invoice status, received amount, balance due, and GST/export context.
- Open a proposal builder and confirm prompts mention proposal pricing/client/tax guidance.
- Open a contract detail page and confirm prompts mention contract status/client/value.
- Open client portals and confirm the portal planning prompts open Ivo.
- Open Pulse and confirm the period-aware prompts open Ivo with current revenue, outstanding, overdue, and collection context.
- Confirm Ivo panel opens without changing records until the user explicitly approves a workflow action.

## Notes

- This phase intentionally avoids autonomous actions. Ivo should feel present inside the workspace while still behaving as a helpful assistant, not an unsupervised business manager.
