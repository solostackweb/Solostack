# Phase 2 — Implementation Plan (Storage cap · Re-engagement · Doc comments)

**Scope** (from `PORTAL_CONNECTIVITY_PLAN.md`, Phase 2):
1. **Per-portal 100 MB storage cap** + live space indicator + clean-up tools (R2)
2. **Re-engagement** — Web Push + "what's new since your last visit" (keep-alive cron
   already satisfied by the existing 15-min monitor workflow)
3. **Document comments / annotations** (Stage 2.1)

All ₹0, mobile-first, on the existing Cloudflare R2 + Supabase + Brevo stack. Commits/pushes
are manual from your machine.

---

## Grounding (what already exists)

- **Storage backend:** Cloudflare R2. Per-portal usage is tracked in
  `portal_storage_usage (portal_id, total_bytes, file_count)`. Uploads go through
  `/api/portals/[portalId]/files/presign` then `/files/commit`; **both already enforce a
  cap** = `limitFor(sub, "storage_bytes")` (the plan limit), checked per portal.
- **Freelancer Files UI** (`portal-view.tsx → FilesSection`) already renders a usage meter
  (`usagePct`) and per-file delete (`deletePortalFileAction`).
- **Client Files UI** (`client-portal-pages.tsx → ClientPortalFiles`) lists files; no meter
  yet; `storageCap` is currently `Infinity`.
- **Realtime** (Phase 1) is live — reused for "what's new" badges later.

> So the storage work is mostly: swap the plan-based cap for a **fixed 100 MB per-portal
> cap**, surface the meter on both sides, and add cleanup affordances.

---

## Workstream 1 — Per-portal 100 MB storage cap  ✅ (mainstream, built now)

### 1a. Policy (`src/features/portals/storage.ts`)
- `PORTAL_STORAGE_CAP_BYTES = 100 MB`.
- `effectivePortalStorageCap(planCap)` = `min(planCap, 100 MB)` (plan can restrict further;
  defaults to 100 MB when plan is unbounded).
- `storageTone(used, cap)` → `ok | warn(≥80%) | full(≥95%)` for meter colour.

### 1b. Enforcement
- `presign` + `commit` routes: replace `cap = limitFor(sub,"storage_bytes")` with
  `effectivePortalStorageCap(limitFor(...))`. Clear "portal is full — free up space"
  message on rejection. (Commit stays the hard check.)

### 1c. Indicator (both views, mobile-first)
- Freelancer `FilesSection` meter: colour by `storageTone`, show "X MB of 100 MB".
- Client `ClientPortalFiles`: add a compact meter (read-only) using `storageUsage` + cap.
- Feed the effective cap through `page.tsx` (freelancer) and `client-portal-data.ts`
  (client, set to `PORTAL_STORAGE_CAP_BYTES`).

### 1d. Clean-up tools
- Files already deletable (owner + own uploads). Add a **"Largest first"** sort toggle so
  users can find space hogs fast; delete decrements usage (existing trigger/commit logic).
- When `full`, uploads are blocked with a message that points at cleanup.

---

## Workstream 2 — Re-engagement (Web Push + "what's new")  — plan, build next

### 2a. "What's new since your last visit" (cheapest, do first)
- We already persist `portal_members.last_read_at` (Phase 1). On portal home, compare
  `last_read_at` to recent updates/files/invoices/messages → show a "Since your last visit"
  banner with counts + deep links. Zero new infra.

### 2b. Web Push (VAPID, free)
- Generate VAPID keypair → env vars `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
- New table `push_subscriptions (user_id, portal_id, endpoint, p256dh, auth, created_at)`.
- Client: extend existing service worker (`public/sw.js`) with `push` + `notificationclick`
  handlers; a "Enable notifications" prompt on the portal (permission + subscribe).
- Server: `web-push` send helper; fire on key events (new message offline, invoice issued,
  meeting confirmed/reminder, update posted). Reuse the existing comms dispatch points.
- Reminders/digests ride the existing GitHub Actions cron (add a job hitting a new
  `/api/cron/portal-digest` route).

### 2c. Weekly digest email (Brevo)
- A `/api/cron/portal-digest` route + GitHub Actions schedule → per-portal "what moved this
  week" email. Low volume, under Brevo's 300/day free cap.

---

## Workstream 3 — Document comments / annotations  — plan, build after WS2

- New table `portal_document_comments (id, portal_id, doc_type, doc_id, author_id, body,
  resolved_at, created_at)` + RLS scoped to portal members; add to `supabase_realtime`
  publication for live threads (reuse the Phase 1 channel pattern).
- Server actions: post / resolve / delete comment.
- UI: a comment thread on each document card (contracts/invoices/welcome) in both views,
  with unread/resolved states. Mobile: collapsible thread under each doc.

---

## Build order
1. **WS1 storage cap** (mainstream — built in this pass).
2. WS2a "what's new" banner (reuses `last_read_at`).
3. WS2b Web Push (VAPID + sw.js + subscriptions table).
4. WS2c weekly digest cron.
5. WS3 document comments.

## Definition of done (each WS)
- `tsc --noEmit` clean, **0 null bytes** in touched files (post-edit scan every time).
- Verified at phone width.
- Storage: uploads blocked at 100 MB with a clear message; meter colours correct; delete
  frees space and the meter updates.
