# Invoice Section — Hardening & Legal Plan

**Status:** Planning (no code yet)
**Goal:** Tighten the *aftermath* of invoice creation — safety, public page + PDF polish,
reminders, and legal compliance — for both GST and non-GST freelancers. Creation path
itself stays as-is apart from removing the redundant payment selector.

---

## Current state assessment

**Creation**
- Works well. One redundant piece: a per-invoice **Payment method** selector (Bank/UPI/
  Card/Cash) in `create-invoice-view.tsx` (and edit view). It is misleading because the
  public page does **not** use it — it resolves the method from settings via
  `getUserPaymentMethod(user_id)`. So the selector sets a field nobody reads downstream.

**Public page (`/i/[token]`)**
- Solid: status chip (paid/overdue/partially/due), UPI QR / Smart Collect / "Pay outside
  Stackivo" fallback, PDF download, Need-help panel.
- **Bug:** "Pay outside Stackivo" copy renders `{senderName} hasn't…` and shows as
  "Akshat Jainhasn't" (missing space). Needs a guaranteed-space fix.
- Polish gaps to audit across **all states** (draft preview, sent, viewed, overdue,
  partially_paid, paid) and at phone width.

**PDF (`invoice-pdf.tsx`)** — already has: Tax Invoice / Invoice label, seller+client
GSTIN, place of supply, authorised signature, state codes, totals with CGST/SGST/IGST.
- **Legal gaps:** no **HSN/SAC** per line, no **reverse-charge** declaration, non-GST docs
  are labelled "Invoice" rather than **"Bill of Supply"**, no amount-in-words / declaration.

**Edit / safety**
- Edit page blocks only `paid`. **Sent / viewed / overdue / partially_paid invoices are
  still editable** — a credibility + legal risk (client already has a copy).

**Reminders / overdue** — already built + scheduled (GitHub Actions):
- `invoices-due-soon`: emails client when `due_date` is **tomorrow** (D−1).
- `invoices-overdue`: flips sent/viewed → `overdue` past due, notifies freelancer, emails
  client at **D+1, +7, +14**. Respects a per-user opt-out.
- Gap vs request: pre-due reminder fires only 1 day before; user wants **from 3 days prior**.

**Numbering** — prefix + starting number + padding + reset-per-FY (legally sound
consecutive serial). Good.

---

## Phase 1 — Creation cleanup + public quick fixes  *(items 1, 2)*
1. **Remove the per-invoice Payment selector** from `create-invoice-view.tsx` and
   `edit-invoice-view.tsx` (and the bank-instructions note). Keep the DB column for
   back-compat (default "bank") — no migration; just stop collecting it. Public page is
   unaffected (already settings-driven). Add a tiny inline hint linking to payment
   settings instead.
2. **Fix the spacing typo** on the public page: render the "Pay outside Stackivo" line via
   an explicit interpolated string so the space is guaranteed, and sweep the file for any
   other `{expr}word` adjacency.

## Phase 2 — Edit safety / immutability  *(item 5)*
1. **Lock editing to `draft` only.** Edit page redirects non-draft invoices to the detail
   page; the update **server action** also refuses non-draft (defense in depth).
2. For sent/viewed/overdue/partially_paid: replace the "Edit" affordance with
   **"Duplicate as draft"** (create an editable copy with a fresh number) so corrections
   never mutate a document the client already holds.
3. Keep `paid` immutable (already enforced) and surface a clear reason in the UI.

## Phase 3 — Public page + PDF final polish (all states)  *(item 3)*
1. **Public page:** verify and polish every state (draft/sent/viewed/overdue/
   partially_paid/paid) — status copy, accent/branding, balance-due vs amount-due, mobile
   layout, empty/edge cases (no logo, long names, non-GST).
2. **PDF:** structural pass — spacing/alignment, brand header/footer, totals block, notes/
   terms, signature; ensure the **feature gate** is correct (custom branding only on Pro;
   free users get the clean default brand, never a broken logo).
3. Keep the public page and PDF visually consistent (same doc label, same figures).

## Phase 4 — Reminders & overdue tuning  *(item 4)*
1. **Pre-due reminders from D−3:** fire at **D−3 and D−1** (configurable set), keyed for
   idempotency so no double-sends. Reuse the existing email template (`daysOverdue = -3 /
   -1` signalling).
2. **Overdue:** keep the auto-flip + D+1/+7/+14 cadence; add a clear "final notice" framing
   on the last reminder and stop after the last threshold. Confirm the freelancer opt-out
   still governs all of it.
3. Confirm the GitHub Actions schedule covers the new cadence (single daily run already
   handles D−3/D−1 since it checks each day).

## Phase 5 — Legal compliance (GST + non-GST)  *(item 6)*
GST-aware throughout — non-registered users never see GST-only fields.
1. **HSN/SAC** per line item: optional field on items + a settings default; shown on the
   PDF tax-invoice column when GST is in use. (Mandatory for GST-registered supplies;
   harmless/hidden for non-GST.)
2. **Reverse charge** declaration line ("Tax payable on reverse charge: No") on GST docs.
3. **Bill of Supply**: non-GST documents labelled "Bill of Supply" (the legally correct
   term when no tax is charged) instead of "Invoice", with the no-tax note.
4. **Declaration + amount in words** on the PDF (common, expected on Indian invoices).
5. Re-confirm numbering integrity (consecutive, FY reset) and that client GSTIN/state are
   captured for B2B place-of-supply correctness.
6. Schema: a migration may be needed for `invoice_items.hsn_sac` + a couple of profile
   defaults; will be additive + nullable (no breaking change).

## Phase 6 — Verify
Per phase: null/truncation scan, cross-file contract checks, GST-on and GST-off paths,
public page across all states at phone width. (Full `tsc`/`build` runs locally — sandbox
OOMs on a project this size.)

## Recommended order
1 → 2 → 3 → 4 → 5 → 6. Phases 1–2 are quick, high-value safety/cleanup; 3 is polish; 4 is
a small reminder tweak; 5 is the legal depth (largest, may need a small additive migration).

## Notes / decisions to confirm at Phase 5
- HSN/SAC: make it **optional** (entered per item, with a settings default) rather than
  hard-required, since many small freelancers are under the turnover threshold.
- "Duplicate as draft" (Phase 2) is the chosen correction path; full credit-note issuance
  is out of scope for this pass.
