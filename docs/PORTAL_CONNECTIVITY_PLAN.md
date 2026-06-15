# Stackivo — Portal Connectivity & Premium Experience Plan

**Status:** Planning (no code yet)
**Goal:** Make the client portal feel premium and deeply connected across its whole
lifecycle — onboarding → documents → files → chat → updates → meetings → coming back —
while keeping **marginal cost at ₹0** (stay inside Supabase + Brevo free tiers and
self-hosted / client-side mechanisms).

---

## Cost guardrails (the rules every item below obeys)

What we already pay for and can lean on for free:

- **Cloudflare R2 (already integrated)** — file uploads already run through R2. Free tier
  is **10 GB storage** + free egress. This is our real file backend (not Supabase
  storage). Strategy: stay well inside 10 GB by capping each portal (see Stage 3).
- **Supabase free tier** — 500 MB Postgres, 50K MAU, unlimited API requests, **Realtime
  included**. Watch two ceilings: ~200 concurrent Realtime connections, and projects
  **pause after 1 week of inactivity** (mitigate with a GitHub Actions keep-alive ping —
  see Stage 7).
- **Brevo** — ~300 transactional emails/day free. Keep email for high-signal events;
  push/WhatsApp carry the volume so we never hit the cap.
- **GitHub Actions** — our cron runner (Vercel Cron is **not** on the free plan).
  Scheduled workflows hit our API routes on a schedule for keep-alive, reminders, and
  digests. Free for our usage.
- **Client-side / generated** — `.ics`, QR codes, `.vcf`, share sheet, signature canvas:
  all pure string/canvas generation, zero infra.
- **Jitsi Meet** — fully free embeddable video, no account, no API key.
- **PWA / Web Push (VAPID)** — free, no third party.

**Two product constraints to respect throughout:**

- **No subdomains.** Clients and freelancers do **not** get their own subdomains.
  Everything lives inside the single app domain (path-based, e.g. `/portal/[id]`). The
  portal is a **feature of the app for client communication**, not a standalone
  white-label product. Plan accordingly — branding is in-app theming only.
- **Mobile-first, fully responsive.** Every feature here must work perfectly on phones
  (most clients open portals on mobile). Each item is designed touch-first, with the PWA
  as a first-class surface — not a desktop feature retrofitted to small screens.

Anything that would need a paid tier (e.g. OAuth Google Calendar write-back, inbound
email parsing) is flagged explicitly and deferred.

---

## Stage 1 — Onboarding & first access (the first 60 seconds)

**Today:** invite token → accept page → bounce into portal. Functional, but the first
impression is a redirect, not a welcome.

Premium upgrades (all ₹0):

1. **Branded first-run welcome** — on first visit, a one-time branded splash: client's
   name, the freelancer's logo/brand colour, "Here's your shared workspace" + a 3-item
   tour (Documents, Chat, Meetings). Stored as a `seen_welcome` flag — zero infra.
2. **Welcome video embed** — freelancer pastes a Loom/YouTube link; we embed it on the
   home/onboarding screen via iframe/oEmbed. Hugely personal, zero cost.
3. **Save-the-contact (`.vcf`)** — a "Save {freelancer} to contacts" button that
   downloads a generated vCard. Tiny touch, very premium, pure string.
4. **Frictionless access** — keep invite tokens but add passwordless/magic-link as the
   default path (Supabase auth, free) so clients never wrestle with passwords.
5. **Onboarding checklist** — a real progress strip ("Sign welcome doc ✓ · Review
   contract · Add billing details") that disappears as items complete. Drives activation.

---

## Stage 2 — Documents linked & their view

**Today:** contracts / invoices / welcome docs link in; client reviews & signs / pays /
acknowledges. Drafts are correctly hidden.

Premium upgrades:

1. **Inline comments / annotations on documents** — threaded comments per document
   (Supabase table + Realtime). Client can ask a question on a specific contract clause;
   you reply in place. This is the single biggest "agency-grade" signal.
2. **Typed/drawn signature canvas** — for contract sign-off, a real signature pad
   (client-side canvas → PNG/base64). Feels like DocuSign; costs nothing.
3. **Version history** — when a document is re-issued, keep prior versions visible
   ("v2 — updated 12 Jun"). Trust + transparency.
4. **Export portal summary as PDF** — "Download everything" generates a branded PDF of
   docs + status (server-side, your `pdf` skill; zero marginal cost).
5. **Status clarity** — consistent badges (Awaiting you / Signed / Paid / Overdue) with
   one obvious next action per document.

---

## Stage 3 — Files connectivity (Cloudflare R2 + per-portal storage cap)

**Today:** uploads already run through **Cloudflare R2** (10 GB free). Files are shared,
a viewer exists, only published files link. We host files ourselves — so the strategy is
**stay inside R2's 10 GB by capping each portal**, not by avoiding hosting.

**Core: 100 MB per-portal storage cap** (the headline ask)

1. **Per-portal cap = 100 MB** (configurable constant). With 10 GB free, that comfortably
   supports ~100 active portals before R2 cost is even a question — a deliberate,
   safe-by-default starting limit.
2. **Live space indicator** — a storage meter on the portal (both freelancer and client
   views): "63 MB of 100 MB used" with a progress bar that turns amber → red as it fills.
   Computed from summed R2 object sizes per portal (tracked in DB so we never scan R2 on
   every load).
3. **Enforce on upload** — block/queue uploads that would exceed the cap, with a clear
   message ("This portal is full — free up space or remove old files"). No silent
   failures.
4. **Clean-up / free-space tools** — a manage view: sort files by size, multi-select
   delete, "remove old versions", confirm-before-delete, and a one-tap "free up space"
   that surfaces the largest/oldest files first. Deleting removes the R2 object **and**
   decrements the tracked usage so the meter updates instantly.
5. **Upsell hook (later)** — the cap is the natural Pro boundary ("Need more than 100 MB?
   Upgrade"). No cost to us now; monetization lever for free.

**Experience upgrades (all mobile-first):**

6. **Inline preview** — render PDFs/images directly in-portal instead of forcing a
   download. Works on mobile viewers.
7. **Client-side upload (drag & drop + tap-to-upload)** — clients send their own
   assets/brand files back, with image thumbnails and progress; upload counts against the
   same 100 MB cap. Mobile uses the native file/camera picker.
8. **Download-all as ZIP** — bundle deliverables in one click (server-side stream).
9. **Storage hygiene nudges** — when a portal nears the cap, prompt the freelancer to
   clean up (links into the clean-up view above).

---

## Stage 4 — Chat (make it live)

**Today:** chat page exists but is request/refresh, not live.

Premium upgrades (Supabase Realtime — free):

1. **Live messaging** — messages appear instantly both sides via `postgres_changes`.
2. **Presence + typing indicators** — "online", "typing…", last-seen. This is what makes
   it *feel* expensive.
3. **Read receipts** — "Seen" both ways.
4. **Attachments in chat** — drop a file/image into the thread (reuses Stage 3 storage /
   external-link logic).
5. **Email fallback** — if the recipient is offline, mirror the message to email (Brevo)
   so chat doubles as an async thread no one misses. High-signal, low-volume → safe on
   free tier.
6. **Canned replies** for the freelancer (quick, professional responses).

---

## Stage 5 — Updates & approvals

**Today:** updates section with approvals; linking fixed.

Premium upgrades:

1. **Realtime update feed** — new updates/approvals appear without refresh + a live badge.
2. **Lightweight reactions** — 👍 / ❤️ / "Looks great" one-tap acknowledgement on updates
   (zero cost), so clients engage without writing a paragraph.
3. **Milestone timeline** — a vertical, branded timeline of project progress (visual,
   premium, all from existing data — no fake percentages).
4. **Approve / request-changes inline** with an optional note that threads into Stage 2
   comments.

---

## Stage 6 — Meetings & calendar connectivity

**Today:** meetings with proposed/confirmed times, meet link (pasteable), WhatsApp share.
No calendar handoff, no built-in video.

Premium upgrades:

1. **Add to calendar** — every confirmed meeting gets a generated `.ics` + one-click
   Google / Outlook / Apple links. Pure string generation, ₹0.
2. **Subscribable portal calendar** — a `webcal://…/portal/[id]/calendar.ics` feed the
   client subscribes to once; all future meetings auto-appear in their calendar. Very
   premium, zero cost.
3. **Built-in video via Jitsi** — generate a unique room
   (`https://meet.jit.si/stackivo-<portalId>-<meetingId>`) so the portal has its *own*
   branded "Join call" button — no Zoom/Meet account, no API, no cost. (Freelancer can
   still paste an external link if they prefer.)
4. **Self-scheduling** — client picks from availability the freelancer sets
   (Calendly-style), self-hosted → ₹0.
5. **Reminders** — T-24h and T-1h via a **GitHub Actions** scheduled workflow + push/email.
   Cuts no-shows.

> Deferred (has cost/OAuth): two-way Google/Outlook calendar *write-back* sync. The
> `.ics` + webcal route gives ~90% of the value for free.

---

## Stage 7 — Coming back (retention & re-engagement)

**Today:** little brings a client back between events.

Premium upgrades:

1. **PWA install** — "Add to home screen" with branded icon/splash (manifest already
   exists; needs the install prompt + polished icons). Turns the portal into an app.
2. **Web Push (VAPID)** — "Invoice paid", "New update", "Meeting in 1h" as real push
   notifications even with the tab closed. Free, no third party. Mobile push is the
   highest-value channel here.
3. **"What's new since your last visit"** — track `last_seen`; greet returning clients
   with a digest banner. Zero cost, strong pull-back.
4. **Weekly email digest** — "Here's what moved in your workspace" via Brevo, triggered
   by a **GitHub Actions** scheduled workflow hitting a digest API route. Low volume,
   high signal.
5. **Keep-alive cron (GitHub Actions)** — a scheduled GitHub Actions workflow pings a
   lightweight API route every few days so the free Supabase project never pauses
   (protects every realtime feature above). **Vercel Cron is not on the free plan**, so
   GitHub Actions is our scheduler for this and for reminders/digests. Effectively a
   prerequisite for the realtime work.

---

## Cross-cutting — premium feel everywhere (₹0)

- **In-app branding only (no subdomains)** — logo upload + accent colour + "Powered by
  Stackivo" treatment, all rendered inside the single app domain on the existing
  `/portal/[id]` path (existing `brand_color` is the start). The portal is a feature of
  the app for client communication — **no per-client subdomains or custom domains**.
- **Mobile-first polish** — touch targets, bottom-nav, safe-area insets, skeleton loaders
  (component exists), optimistic UI, micro-interactions, consistent empty states, dark
  mode (ThemeToggle exists). Every screen verified at phone width first.
- **Localization (Hindi/regional)** — optional language toggle for Indian clients. Pure
  i18n strings, zero cost, distinctly premium for the market.
- **Sharing** — QR code (client-side) + native share sheet + one-tap copy for handing off
  portal access in meetings or on a card.
- **Bring-your-own webhook** — freelancer pastes their Slack/Discord/Notion/Zapier
  inbound webhook URL; portal events fire to it. Unlimited integrations, ₹0 to us
  (reuses existing webhook infra).
- **Accessibility** — keyboard nav, focus states, contrast. Cheap, signals quality.

---

## Recommended sequencing

**Phase 1 — highest perceived value, lowest risk, all free**
1. Calendar connectivity (`.ics` + add-to-calendar + webcal) — Stage 6.1–6.2
2. Realtime chat + presence + read receipts — Stage 4.1–4.3
3. Jitsi built-in video — Stage 6.3

**Phase 2 — connectivity & retention**
4. Per-portal 100 MB storage cap + space indicator + clean-up tools (R2) — Stage 3.1–3.4
5. GitHub Actions keep-alive cron → then Web Push + "what's new" — Stage 7.5, 7.2–7.3
6. Document comments/annotations — Stage 2.1

**Phase 3 — premium polish & onboarding**
7. Branded welcome + welcome video + checklist — Stage 1
8. Signature canvas, milestone timeline, reactions — Stage 2.2 / 5.2–5.3
9. In-app branding + QR/share + localization — Cross-cutting

> Every phase ships **mobile-first** — each feature is built and verified at phone width
> before desktop, since most clients open portals on their phones.

---

## Honest caveats

- "Zero cost" holds **inside free tiers**. The real ceilings to watch as you grow:
  **Cloudflare R2 10 GB** files (the 100 MB/portal cap keeps us comfortably inside it),
  Supabase ~200 concurrent Realtime connections + 500 MB DB, and Brevo ~300 emails/day.
  None bite at current volume.
- The **1-week pause** on free Supabase is the one operational gotcha — the **GitHub
  Actions keep-alive cron** (Phase 2) is effectively a prerequisite for everything
  realtime. (Vercel Cron is not free, so we don't use it.)
- The 100 MB/portal cap is deliberate and configurable — it's both a cost guardrail and a
  natural future Pro upsell.
- Deferred-because-cost: OAuth calendar write-back, inbound email-to-portal parsing. **No
  subdomains / custom domains** — out of scope by design (portal is an in-app feature).
