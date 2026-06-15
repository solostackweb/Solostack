# Phase 1 — Implementation Plan (Calendar · Realtime Chat · Jitsi Video)

**Scope:** the three highest-value, zero-cost portal upgrades from
`PORTAL_CONNECTIVITY_PLAN.md`:
1. Calendar connectivity — `.ics` download + add-to-calendar links + subscribable webcal feed
2. Realtime chat — live messages + presence (typing/online) + read receipts
3. Built-in video — Jitsi "Join call" rooms

Everything stays inside existing free tiers (Supabase Realtime, Cloudflare R2, Brevo) and
is **mobile-first**. All commits/pushes are done manually by you from your machine.

---

## Grounding (what the code looks like today)

- **Meetings:** table `portal_meetings` — `id, portal_id, requested_by, topic,
  proposed_time (TEXT, freeform), meet_link, notes, status, created_at, updated_at`.
  Server actions in `src/features/portals/actions-meetings.ts`
  (`requestPortalMeetingAction`, confirm/decline). UI in
  `src/features/portals/components/meetings-section.tsx` (owner confirm uses a
  `datetime-local` picker but formats it to a **string** into `proposed_time`).
- **Messages:** table `portal_messages` — `id, portal_id, parent_id, author_id, body,
  attachments (Json), created_at, edited_at, deleted_at`. Send action
  `postPortalMessageAction` in `src/features/portals/actions.ts`. UI = `MessagesPanel`
  inside `src/features/portals/components/client-portal-pages.tsx` (currently
  `router.refresh()` after send — **not live**). Freelancer side renders via
  `portal-view.tsx`.
- **Realtime client:** `getBrowserSupabase()` in `src/lib/supabase/client.ts` (memoised
  `@supabase/ssr` browser client) — ready for `.channel()` subscriptions.
- **RLS:** policies in `supabase/migrations/0003_rls_policies.sql`. Realtime delivery
  respects RLS, so members already scoped to a portal will only receive their portal's rows.

> **Key schema gap:** `proposed_time` is text, so we cannot reliably emit calendar events
> from it. WS1 adds a real timestamp column.

---

## Workstream 1 — Calendar connectivity

### 1a. Data model (migration)
Add to `portal_meetings`:
- `scheduled_at timestamptz NULL` — the actual confirmed start (source of truth for `.ics`).
- `duration_minutes int NOT NULL DEFAULT 30`.
- (Optional) `timezone text DEFAULT 'Asia/Kolkata'`.

Keep `proposed_time` for the human/freeform proposal; `scheduled_at` is set on confirm.

### 1b. Server
- Update the **confirm action** in `actions-meetings.ts` to write `scheduled_at`
  (from the existing `datetime-local` value, parsed to a real Date) + `duration_minutes`.
- New `.ics` builder `src/features/portals/calendar.ts` — pure function, no deps:
  emits a VCALENDAR/VEVENT string (UID = meeting id, DTSTART/DTEND from `scheduled_at` +
  duration, SUMMARY = topic, DESCRIPTION + URL = portal meeting link / Jitsi room,
  ORGANIZER = freelancer). UTC `Z` timestamps to avoid TZ bugs.
- Two route handlers (App Router, `Content-Type: text/calendar`):
  - `GET /api/portal/[id]/meetings/[meetingId]/calendar.ics` — single event download.
  - `GET /api/portal/[id]/calendar.ics` — **all** confirmed future meetings (the
    subscribable feed). Auth via the existing portal access/token check; cache-control short.

### 1c. Client / UI (mobile-first)
- On each **confirmed** meeting card (in `meetings-section.tsx`), add an **"Add to
  calendar"** control. On tap → a small menu / bottom-sheet:
  - **Apple / Outlook desktop** → download the `.ics`.
  - **Google Calendar** → `https://calendar.google.com/calendar/render?action=TEMPLATE&...`
    (generated link).
  - **Outlook.com** → `https://outlook.live.com/calendar/0/deeplink/compose?...`.
  - Helper `buildCalendarLinks(meeting)` in `calendar.ts` returns all hrefs.
- On the portal **Meetings page header**, add **"Subscribe to calendar"** → copies/opens
  the `webcal://…/api/portal/[id]/calendar.ics` URL (one-time subscribe; all future
  meetings auto-sync). Show a one-line "what this does" hint.
- Mobile: use a bottom-sheet for the add-to-calendar menu, full-width tappable rows
  (44px targets), and `navigator.share` fallback for the webcal URL.

### 1d. Verify
- Validate generated `.ics` against an ICS validator; import into Google + Apple to
  confirm correct time/title/link.
- Confirm webcal feed lists only future confirmed meetings and updates after a new confirm.

---

## Workstream 2 — Realtime chat (+ presence + read receipts)

### 2a. Enable Realtime (migration)
- Add `portal_messages` to the `supabase_realtime` publication:
  `alter publication supabase_realtime add table portal_messages;`
- Confirm RLS SELECT on `portal_messages` is scoped to portal members (it is, via 0003) —
  Realtime will only push rows a user is allowed to read.
- **Read receipts:** add `last_read_at timestamptz` to `portal_members`
  (one column, per member per portal). A message is "seen" if its `created_at <=` the other
  party's `last_read_at`.

### 2b. Server
- New tiny action `markPortalReadAction(portalId)` → sets `last_read_at = now()` for the
  current member. Called on chat open + on focus.
- `postPortalMessageAction` stays as-is (insert triggers the realtime broadcast
  automatically — no extra work).

### 2c. Client hook
- New `src/features/portals/hooks/use-portal-messages.ts`:
  - Seeds state from server props (`data.messages`).
  - `getBrowserSupabase().channel('portal:'+portalId)`:
    - `.on('postgres_changes', { event:'INSERT', table:'portal_messages',
      filter:'portal_id=eq.'+portalId }, …)` → append (dedupe by id; reconcile optimistic).
    - **Presence** (`channel.track({ userId, name })`) → online + last-seen.
    - **Broadcast** `typing` events → typing indicator (ephemeral, no DB writes).
  - Cleans up on unmount; reconnect/backoff handled by the SDK.
- Refactor `MessagesPanel` to consume the hook instead of `router.refresh()`:
  - **Optimistic send** (show immediately, reconcile on echo).
  - Auto-scroll to newest; "new messages" pill if scrolled up.
  - Typing indicator + "Online / last seen" in the header.
  - "Seen" tick under your last message when the other party's `last_read_at` passes it.
- Wire the same hook into the **freelancer** chat (`portal-view.tsx`) so both sides are live.

### 2d. Mobile-first
- Sticky composer above the keyboard (safe-area inset), messages list fills the viewport,
  momentum scroll, 44px send target, typing/online compact on small screens.

### 2e. Verify
- Two browsers (owner + client): message appears live both ways < 1s; typing + online
  show; "Seen" updates; optimistic message reconciles without dupes; reconnect after
  network drop. Confirm no cross-portal leakage (RLS) using a second portal.

---

## Workstream 3 — Built-in video (Jitsi)

### 3a. Mechanism (no infra)
- Deterministic room: `https://meet.jit.si/stackivo-<portalId>-<meetingId>` via helper
  `buildJitsiRoom(portalId, meetingId)`.
- On **confirm**, if the owner didn't paste a `meet_link`, auto-fill it with the Jitsi
  room so every confirmed meeting has a working "Join call" button. Owner can still paste
  Zoom/Meet to override.

### 3b. UI
- Reuse the existing confirmed-meeting **"Join call"** button → opens the room in a new
  tab (works on mobile browsers and the Jitsi mobile app deep-link).
- Optional later: embed the Jitsi External API iframe in-portal; for Phase 1 a link-out is
  simpler and fully mobile-friendly.
- The `.ics` (WS1) and WhatsApp share (existing) automatically carry the Jitsi URL.

### 3c. Caveat to verify before committing
- The public `meet.jit.si` instance has at times required the **first/moderator** join to
  authenticate (Google/GitHub). **Action:** verify current behavior. If it now blocks
  anonymous room creation, fallback options (all still ₹0 or near-0): keep pasted external
  links as the default, or move to **8x8 JaaS free tier** (JWT, generous free minutes), or
  self-host later. Plan keeps the pasted-link path intact so this never blocks a meeting.

---

## Shared prerequisite — GitHub Actions cron (small but enabling)
Not strictly required to ship WS1–3, but needed so the free Supabase project doesn't pause
(which would kill realtime). Add a `.github/workflows/keepalive.yml` scheduled workflow
that curls a lightweight `GET /api/health` (or existing `api/cron/monitor`) every ~3 days.
Reminders/digests (Phase 2) reuse the same runner. (Vercel Cron is not on the free plan.)

---

## Suggested build order
1. **WS1 calendar** — self-contained, no realtime risk, immediate visible value.
2. **GitHub Actions keep-alive** — quick, unblocks realtime reliability.
3. **WS2 realtime chat** — biggest "premium" jump; do migration → hook → both UIs.
4. **WS3 Jitsi** — small, layers onto the confirm flow + `.ics`.

## Migrations summary (one new file)
`supabase/migrations/00xx_portal_phase1.sql`:
- `portal_meetings`: + `scheduled_at`, `duration_minutes`, (`timezone`).
- `portal_members`: + `last_read_at`.
- `alter publication supabase_realtime add table portal_messages;`

## Definition of done
- Type-check clean (`npx tsc --noEmit`), **0 null bytes** in every touched file (run the
  null-scan after each Edit — corruption has recurred even on `C:\Stackivo`).
- Verified on a real phone viewport for every new surface.
- `.ics` imports correctly; webcal feed live-updates; chat is live with presence + seen;
  Jitsi room joins (or documented fallback in effect).
