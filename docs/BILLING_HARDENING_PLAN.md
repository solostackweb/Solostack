# Billing — Hardening & Compliance Plan

**Status:** Planning (no code yet)
**Goal:** Bring the billing/autopay flow to production grade — a modern, branded checkout
UX, a clean subscription lifecycle, and verified RBI e-mandate (autopay) compliance.

---

## Current state assessment

- **Checkout:** `CheckoutButton` calls `startCheckoutAction` then opens the Razorpay
  Checkout popup via the JS SDK (loaded `lazyOnload`). Theme color set. On success →
  toast + delayed `router.refresh()`; webhook is source of truth.
  - **UX gap:** clicking "Upgrade" goes straight to the Razorpay popup, which loads its
    iframe over a blank/white blurred backdrop (the SDK is lazy-loaded, so there's a
    visible white flash while it initializes). No branded intermediate step, no plan/price
    recap, no mandate disclosure.
- **Cancel:** `CancelSubscriptionButton` → `cancelSubscriptionAction` → cancel at period
  end, keep features till `current_period_end`, retention chat (Crisp), reactivate exists.
  Functional — needs a once-over for edge cases + clearer lifecycle display.
- **Webhook:** handles all `subscription.*` + `payment.*` events; on `subscription.charged`
  it flips the invoice to paid and **generates a receipt + receipt email** (post-debit
  confirmation already exists).
- **Policy pages:** Terms, Refund policy, Privacy all exist.
- **Compliance gap:** there is **no autopay mandate disclosure at checkout** and **no
  merchant-side renewal/pre-debit reminder**.

## RBI e-mandate (autopay) compliance — what the law actually requires

(Researched — see Sources at the end of the chat message.)
- **Pre-debit notification is 24 hours, not 3 days.** The collecting entity must notify the
  customer **at least 24h before every debit**, including merchant name, amount, date/time,
  mandate reference, reason, **and an opt-out option**. (A 3-day heads-up is good practice,
  not the legal minimum.)
- **Merchant shares responsibility** — the obligation runs down the chain (PA + merchant).
  In practice Razorpay, as the payment aggregator, sends the mandatory 24h pre-debit
  notification + post-debit confirmation for subscription charges; we must (a) ensure this
  is enabled, and (b) not contradict it.
- **Post-debit confirmation** (merchant name, amount, date/time, txn + mandate refs,
  grievance details) — partly covered by our receipt; we'll make sure it's complete.
- **Mandate consent** must be clear at sign-up: recurring amount, frequency, that it's an
  autopay mandate, and how to cancel.
- **Easy cancellation + grievance redressal** must be available.

---

## Phase B1 — Checkout flow overhaul (UX + mandate consent)
1. **Pre-checkout summary step** (branded sheet/modal) shown on "Upgrade", before Razorpay:
   plan, billing cycle, **price + GST note**, what's included, and an explicit **autopay
   mandate disclosure** — "₹X will auto-debit every month/year until you cancel; you can
   cancel anytime; you'll get a reminder before each charge" + links to Terms / Refund /
   Privacy. A clear **"Proceed to secure payment"** CTA.
2. **Kill the white flash:** preload the Razorpay SDK (eager/`afterInteractive` or on
   summary-open) so the popup opens instantly; show a proper loading state and keep the
   hosted-page fallback. Branded theme already set.
3. Robust states: loading, dismissed, failed (clear messaging), and a clean post-success
   "activating…" state while the webhook lands.

## Phase B2 — Subscription lifecycle review & polish
1. **Review `cancelCurrentSubscription`** — verify Razorpay cancel-at-period-end actually
   fires, handles already-cancelled / immediate / no-subscription, and that
   reactivate works. Confirm the webhook reconciles the cancel.
2. **Clear lifecycle display** on the billing page: current plan, **renews on / cancels on**
   date, **next charge amount**, payment method, and the right CTA (Cancel vs Reactivate).
3. Edge cases: halted/pending/paused states surfaced with guidance.

## Phase B3 — Autopay legal compliance
1. **Mandate consent at checkout** — delivered by B1's disclosure step.
2. **Pre-debit notification (24h):** confirm Razorpay sends it for our subscriptions
   (PA responsibility); **add a merchant-side renewal reminder email** ahead of each charge
   (e.g. ~3 days before, via the existing GitHub Actions cron) with amount, charge date,
   manage/cancel link, and grievance contact — exceeds the minimum and removes any doubt.
3. **Post-debit confirmation:** verify the `subscription.charged` receipt email includes
   the required fields (merchant, amount, date, references, grievance) — top up if missing.
4. **Grievance redressal + policy links** surfaced on the billing page and checkout step.
5. Document the compliance posture (who sends what) in this doc for the record.

## Phase B4 — Verification
esbuild parse + null scan; lifecycle dry-run review; confirm no secrets/keys exposed
client-side; mobile-first checkout. (Full build runs locally — sandbox OOMs.)

## Recommended order
B1 (UX, highest visible impact + carries mandate consent) → B2 (lifecycle) →
B3 (compliance depth) → B4.

## Notes / corrections
- The "3-day reminder" you mentioned isn't the regulatory line — **24h pre-debit
  notification is the RBI mandate** (handled by Razorpay as PA). We'll still add our own
  ~3-day renewal reminder as a courtesy + safety margin.
- No Razorpay keys/secrets move to the client; checkout stays server-initiated.
