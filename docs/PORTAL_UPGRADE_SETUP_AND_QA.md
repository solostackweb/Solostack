# Portal Upgrade — Setup & QA Checklist

One place to bring the whole portal initiative (Phases 1–3) live and verify it. Work
top-to-bottom. Everything is **inert-safe** until its migration/env is in place — nothing
breaks if you deploy the code first and finish setup after.

Status at handoff: `npx tsc --noEmit` clean, repo-wide null-byte scan clean.

---

## 1. Install dependencies

```bash
npm install
```

New/required packages:
- `web-push` (^3.6.7) — **new**, added for Web Push.
- `qrcode` (^1.5.4) — already in deps; used by the portal QR card.

---

## 2. Run database migrations (in order)

Apply against production Supabase, in this exact order:

| File | What it adds |
| --- | --- |
| `0038_portal_phase1.sql` | `portal_meetings.scheduled_at / duration_minutes / timezone`; `portal_members.last_read_at / calendar_feed_token`; adds `portal_messages` to the `supabase_realtime` publication |
| `0039_portal_phase2.sql` | `portal_members.last_seen_at`; `portal_document_comments` table + RLS + realtime |
| `0040_push_subscriptions.sql` | `push_subscriptions` table + RLS |
| `0041_portal_onboarding.sql` | `portals.welcome_video_url / welcome_message` |

All migrations are idempotent (safe to re-run).

> **Realtime must be enabled** for the project (it is, on the free tier). The migrations
> register the tables on the `supabase_realtime` publication; chat + comments go live once
> 0038/0039 are applied.

---

## 3. Environment variables

### New — Web Push (optional; push silently no-ops until all three are set)
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:you@yourdomain.com
```
Generate the keypair once:
```bash
npx web-push generate-vapid-keys
```
Set all three in Vercel (Production). `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must be the
NEXT_PUBLIC one so the browser can subscribe.

### Already required (confirm they're set — existing features depend on them)
- `NEXT_PUBLIC_APP_URL` — used to build calendar / webcal links.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — file storage.
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` — email comms.
- Supabase URL + anon + service-role keys.

### Supabase Storage
- Bucket `branding-assets` must exist (it already does — profile logos use it). The client
  portal brand logo reuses the freelancer's uploaded logo from **Branding settings**.

---

## 4. Scheduling (GitHub Actions) — no action needed

The existing `.github/workflows/cron-jobs.yml` already runs `/api/cron/monitor` every 15
minutes, which touches the DB and **keeps the free Supabase project from pausing** — the
prerequisite for realtime. No new workflow required. (Vercel Cron is intentionally not
used — it's not on the free plan.)

---

## 5. Deploy & smoke test

```bash
npm run build   # should compile clean
```
Then deploy. After deploy, open a portal as the freelancer and as a client (use the
"View as client" button / an invited client account in a second browser).

---

## 6. QA — feature-by-feature test scripts

Tip: test with **two browsers** (freelancer + client) side by side for the realtime items.

### Phase 1

**Calendar — add to calendar**
1. As freelancer, confirm a meeting with a date/time + duration.
2. On the confirmed card, click **Add to calendar** → Google / Outlook / Apple.
3. Google/Outlook open a prefilled event; Apple/`.ics` downloads and imports with correct
   title, time, and the Join link. ✅

**Calendar — subscribe (webcal)**
1. Meetings header → **Subscribe**. The webcal URL copies to clipboard.
2. Add it as a subscribed calendar (Google "From URL" / Apple "New Calendar Subscription").
3. Confirm a new meeting → it appears in the subscribed calendar after its refresh. ✅

**Realtime chat**
1. Open chat as freelancer + client. Type on one side → "Typing…" shows on the other.
2. Send → message appears on both **without refresh**; presence shows "Online".
3. The sender sees "Sent" → "Seen" once the other side has the chat open. ✅
4. Drop network briefly, restore → messages resync. No duplicates. ✅

**Jitsi video**
1. Confirm a meeting **without** pasting a link → a built-in room is auto-created.
2. Click **Join** → opens `meet.jit.si/stackivo-…`. (If meet.jit.si demands moderator
   login, paste a Zoom/Meet link instead — that path still works.) ✅

### Phase 2

**Storage cap (100 MB/portal)**
1. Files section shows "X MB of 100 MB" with a colored bar (green→amber→red).
2. Upload past the cap → blocked with "This portal is full…". ✅
3. "Largest first" sort surfaces big files; delete one → meter drops immediately. ✅
4. Client Files page shows the read-only meter too. ✅

**Document comments**
1. On any contract/invoice/welcome doc (both views) → **Add comment**.
2. Comment appears live on the other side (realtime). Resolve/reopen and delete work;
   owner can delete anyone's, authors can delete their own. ✅

**What's new since last visit**
1. As client, visit home, then have the freelancer post an update / file / message.
2. Revisit home → "Since your last visit: …" banner with correct counts. ✅

**Web Push** (only after §3 keys)
1. Client (or freelancer) clicks **Enable notifications** → grant permission.
2. Other side sends a chat message / confirms a meeting.
3. A system notification appears even with the tab backgrounded; clicking it opens the
   portal. Toggling **Notifications on** again unsubscribes. ✅
   - Without VAPID keys: the button hides itself and nothing errors. ✅

### Phase 3

**Onboarding checklist**
1. As client with an unsigned contract / unpaid invoice / unacknowledged welcome doc →
   "Getting started" card lists them with progress.
2. Complete each → it ticks off; card disappears when all done. ✅

**Branded welcome (video + message)**
1. As freelancer, right rail → **Onboarding** → paste a Loom/YouTube link + message → Save.
2. Client home shows the embedded video + "Hi {client} 👋" + message. ✅
   (Unknown video host → renders as a "Watch the welcome video →" link.)

**Brand logo**
1. Set a logo in **Branding settings** (if not already).
2. Client portal header shows that logo instead of the colored initials tile. ✅

**Save contact / Share**
1. Client home → **Save contact** downloads a `.vcf` that imports the freelancer's name,
   company, email, phone, website. ✅
2. **Share** opens the native share sheet (mobile) or copies the link (desktop). ✅

**Milestone timeline**
1. Client → Updates tab → "Project timeline" lists updates chronologically with
   type icons, dates, and green checks on approved items. ✅

**Portal QR**
1. Freelancer right rail → **Portal QR** → Show QR → scan with a phone → opens the client
   portal link. Download saves the PNG. ✅

### Cross-cutting
- **Mobile:** repeat the key flows at phone width — chat composer above keyboard, bottom
  nav, cards stack, dialogs/sheets usable. ✅
- **Theme:** toggle dark mode — meters, badges, timelines, comments remain legible. ✅

---

## 7. Rollback notes
- All new columns/tables are additive; no destructive changes to existing data.
- Realtime publication additions can be reverted with
  `alter publication supabase_realtime drop table <table>;` if ever needed.
- Web Push / QR degrade to no-ops without keys/deps, so partial setup is safe.

---

## 8. Deferred (planned, not built)
- **Weekly digest email** (Brevo + cron) — real-time push already covers re-engagement.
- **Hindi localization** — explicitly descoped.
- **Per-portal logo override** — currently uses the freelancer's single brand logo.

---

## 9. File map (what changed)

**Migrations:** `0038`–`0041`.

**New modules:** `features/portals/calendar.ts`, `video.ts`, `video-embed.ts`,
`storage.ts`, `push.ts`, `hooks/use-portal-messages.ts`, `actions-comments.ts`;
components `document-comments.tsx`, `enable-push-button.tsx`, `portal-share-buttons.tsx`,
`milestone-timeline.tsx`, `portal-qr-card.tsx`; routes
`api/portals/[portalId]/calendar.ics`, `.../meetings/[meetingId]/calendar.ics`,
`.../contact.vcf`, `api/push/subscribe`, `api/push/unsubscribe`.

**Edited:** `portal-view.tsx`, `client-portal-pages.tsx`, `client-portal-data.ts`,
`actions.ts`, `actions-meetings.ts`, `meetings-section.tsx`, dashboard portal `page.tsx`,
`lib/supabase/types.ts`, `config/env.ts`, `public/sw.js`, `package.json`, files
`presign`/`commit` routes.

**Plans:** `docs/PORTAL_CONNECTIVITY_PLAN.md`, `PORTAL_PHASE1_IMPLEMENTATION.md`,
`PORTAL_PHASE2_IMPLEMENTATION.md`, `PORTAL_PHASE3_IMPLEMENTATION.md`.
