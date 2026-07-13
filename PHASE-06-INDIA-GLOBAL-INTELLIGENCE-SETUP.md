# Phase 06 - India Global Intelligence Setup

## What This Phase Adds

- Client-aware proposal billing guidance.
- Export proposal treatment for foreign clients:
  - Uses the client's configured currency.
  - Shows no GST estimate.
  - Mentions export/zero-rated invoice handling and LUT setup where relevant.
- Domestic proposal treatment:
  - Shows non-GST guidance when the seller is not GST registered.
  - Shows intra-state CGST+SGST guidance when seller/client state match.
  - Shows inter-state IGST guidance when state differs or is incomplete.
- Builder-side suggested GST amount based on the seller's default GST rate.
- Public proposal tax/export note for clients.
- Proposal-to-invoice conversion now uses the seller's default GST rate.
- Proposal-to-contract conversion stores FX and INR equivalent for foreign-currency proposal values.

## Required Setup

- No new migration is required in this phase.
- No new environment variables are required.
- No new third-party accounts are required.

Make sure these prior migrations are already applied:

- `supabase/migrations/0059_clientflow_project_statuses.sql`
- `supabase/migrations/0060_proposals.sql`
- `supabase/migrations/0061_proposal_conversions.sql`

## Manual QA Checklist

- Create/open a proposal for an Indian domestic client in the same state.
- Confirm builder guidance says intra-state GST / CGST+SGST.
- Create/open a proposal for an Indian domestic client in a different state.
- Confirm builder guidance says inter-state GST / IGST.
- Create/open a proposal for a foreign client.
- Confirm currency changes to the client currency and tax is cleared.
- Open the public proposal link and confirm the public tax/export note appears.
- Convert a proposal to invoice and confirm GST/export handling still matches invoice rules.
- Convert a foreign-currency proposal to contract and confirm contract value is carried.

## Notes

This phase does not make proposals a tax invoice. It only makes proposal pricing clearer and safer before invoice conversion.
