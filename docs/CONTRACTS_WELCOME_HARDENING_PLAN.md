# Contracts & Welcome Docs — Hardening & Legal Plan

**Status:** Planning (no code yet)
**Goal:** Bring Contracts and Welcome Documents to the same production-grade bar as
Invoices — legally sound, polished public pages + PDFs + shareable links, and consistently
integrated across the Stackivo ecosystem (portal, clients, branding, feature gates).

---

## Current state assessment (grounded in the code)

### Contracts — strong foundations, real gaps
- **Signing capture is legally sound:** the signature modal requires an explicit consent
  checkbox + a "I confirm my legal name… legally bound by this signature" affirmation
  (intent), and signing records a full audit trail — `legal_name, signed_ip,
  signed_user_agent, signed_device, signed_at, pdf_snapshot_hash`.
- **Public signing page** `/c/[token]` with draw / type / upload signature methods.
- **Status lifecycle:** draft → sent → viewed → signed / declined / expired.
- **Gaps:**
  1. **Signed-PDF snapshot is a placeholder.** `pdf-snapshot.ts` only computes a content
     **hash** — it never renders/stores the actual signed PDF (explicit TODO), even though
     a `contract-pdf.tsx` react-pdf template and the PDF renderer already exist. The
     legally-binding immutable artifact isn't being produced.
  2. **No edit lock.** `updateContractAction` has **no status guard** — a *signed* contract
     can still be edited, which destroys the integrity of the executed agreement.
  3. **No delete guard** (to confirm) — signed contracts must never be deletable.
  4. **PDF has no audit certificate** — it shows the signature image but not the legal
     evidence (signer legal name, IP, user-agent, timestamp, snapshot hash).
  5. Public page + PDF polish: state coverage, branding + **feature gate**, mobile.

### Welcome Documents — functional, needs polish (not legally binding)
- **Public viewer** `/w/[token]`, branded **PDF**, and an **acknowledgement** flow exist.
- **Gaps:** mostly polish — public page + PDF branding/feature-gate/mobile consistency,
  acknowledgement audit (who/when) surfacing, and label/status consistency with the rest
  of the app. No e-signature legal weight needed.

---

## Phase C1 — Contract integrity & immutability  *(legal-critical)*
1. **Lock editing once issued.** `updateContractAction` + the edit page refuse anything
   past `draft` (sent/viewed/signed/declined/expired). Mirror the invoice pattern: offer
   **"Duplicate as draft"** for corrections so an executed agreement is never mutated.
2. **Guard deletion.** Only drafts deletable; signed/sent contracts are retained (a
   `cancelled`/void path if needed, or simply non-deletable) for the audit trail.
3. Surface the lock in the detail UI (no Edit on issued; clear reason).

## Phase C2 — Real signed-PDF snapshot  *(legal-critical)*
1. At signing, **render the actual contract PDF** (`contract-pdf.tsx` via
   `renderPdfToBuffer`) capturing the exact signed content + signature.
2. **Store immutably** in a Supabase storage bucket (`upsert: false`, never overwrite),
   save `pdf_snapshot_url` + `pdf_snapshot_hash` on the signature row.
3. Detail page + public page expose "Download signed copy" from the snapshot; verify the
   stored hash matches on access.

## Phase C3 — Contract public page + PDF polish + audit certificate
1. **Public page** `/c/[token]`: polish every state (sent/viewed/signed/declined/expired),
   branding + accent, mobile, edge cases (no logo, long names).
2. **PDF:** structural pass + a **signature audit certificate** section — signer legal
   name, IP, user-agent, timestamp, and snapshot hash — the legal-evidence appendix.
   Keep the **custom-branding feature gate** correct (free users → clean default).
3. Shareable-link consistency (labels/status with detail + PDF).

## Phase W1 — Welcome docs public page + PDF polish
1. **Public viewer** `/w/[token]`: branding, feature gate, mobile, state coverage, polish.
2. **PDF:** branded, consistent with the other document PDFs; feature gate correct.
3. **Acknowledgement:** surface who acknowledged + when (audit), consistent status labels;
   confirm the ack flow + confirmation copy read well.

## Phase W2 — Integration & consistency
- Shared status labels + branding across detail, public, PDF, and the **client portal**
  (welcome docs + contracts both appear there — verify consistent labels, like we did for
  invoices).
- Feature gating consistent with plan tiers.

## Phase V — Verification
Per phase: esbuild parse + null/truncation scan, cross-file contract checks, public pages
across all states at phone width. (Full `tsc`/`build` runs locally — sandbox OOMs.)

## Recommended order
C1 → C2 → C3 (contracts first — the legal weight is here) → W1 → W2 → V.

## Notes / decisions
- Contract corrections use **"Duplicate as draft"** (consistent with invoices); formal
  amendment/addendum workflows are out of scope for this pass.
- Welcome docs are **not** legally binding — treated as polish + acknowledgement tracking,
  not e-signature.
