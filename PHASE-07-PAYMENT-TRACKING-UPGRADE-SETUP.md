# Phase 07 - Payment Tracking Upgrade Setup

## What This Phase Adds

- Invoice payment ledger for partial, offline, and international payments.
- Manual payment recording with:
  - Payment method.
  - Invoice-currency amount.
  - Actual received amount and received currency.
  - Optional transaction reference, proof link, and notes.
- Partial payment status support through the invoice detail flow.
- Payment timeline on invoice detail pages.
- INR equivalent tracking for foreign-currency invoices when an invoice FX rate exists.
- Receipt generation for each recorded payment.

## Required Setup

1. Apply the new migration:

   ```bash
   supabase db push
   ```

   Required SQL file for this phase:

   - `supabase/migrations/0062_invoice_payment_ledger.sql`

2. No new environment variables are required.

3. No new third-party accounts are required.

## Manual QA Checklist

- Open a sent invoice and click `Record payment`.
- Record a full INR payment and confirm the invoice becomes `Paid`.
- Record a partial payment and confirm the invoice becomes `Partially paid`.
- Record a second payment for the remaining balance and confirm the invoice becomes `Paid`.
- For a foreign-currency invoice, record the invoice amount and the actually received currency/amount.
- Confirm the invoice detail page shows:
  - Total.
  - Received.
  - Balance due when partially paid.
  - Payment timeline rows.
  - INR equivalent where available.
- Add a proof link and confirm it appears in the payment timeline.
- Confirm each payment generates a receipt.

## Notes

- Stackivo does not verify manual/offline transfers. The freelancer is confirming that money was received.
- For foreign-currency invoices, use the invoice's locked FX rate for INR reporting where available.
- Payment proofs should be links to files the freelancer controls, such as Drive links or bank receipt URLs.
