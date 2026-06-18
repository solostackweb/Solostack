# Stackivo — Help & Support System Rebuild Plan

**Status:** Planning (approved tooling; no code yet)
**Goal:** Replace the bland, half-working Crisp + Zoho Desk setup with a **first-party**, **zero-cost**, **fully admin-integrated** help & support system. Everything — chat, tickets, contact forms, email — is owned by Stackivo and run from `/admin/support`. Google Workspace is the human mailbox + sending identity; Stackivo's own database is the source of truth.

---

## 1. Decisions locked in

| Decision | Choice |
|---|---|
| Chat model | **First-party live chat** on Supabase Realtime (reuse the portal-chat engine). Replaces Crisp. |
| Email-to-ticket | **Cloudflare Email Routing** → Email Worker → Stackivo webhook (free). |
| DNS host | **Cloudflare** (Email Routing available). |
| Tier policy | **Recommended default** (see §5). |
| Cost | **₹0** — Supabase + Brevo free tier + Cloudflare free + Google Workspace (already owned). |

---

## 2. What exists today (and why it's being replaced)

- `support_threads` (migration 0022): a **thin index** with *no message bodies* — only pointers out to Crisp/Zoho. Service-role only.
- **Crisp** widget is effectively invisible: `crisp-provider.tsx` hides `.crisp-client` with `display:none !important` on every screen — so chat never really shows.
- **Zoho Desk** backs the `/help` bug-report form (`submitBugReportAction` → `createZohoTicket`, email fallback).
- **Webhooks** (`/api/webhooks/crisp`, `/api/webhooks/zoho-desk`) sync metadata into `support_threads`.
- **Admin** `/admin/support` reads `support_threads` + Brevo `delivery_logs`.
- **Outbound email** = Brevo (API + SMTP fallback). No inbound email today.
- **Reusable asset:** Supabase Realtime chat already built for client portals.

**Problem:** two external SaaS dependencies, two extra sources of truth, clunky integration, no real ownership, and the one "live" channel is hidden. We replace all of it with one owned system.

---

## 3. Target architecture (final tooling)

| Layer | Tool | Notes |
|---|---|---|
| System of record | **Supabase Postgres** (existing) | New tables hold tickets + message bodies. |
| Real-time chat | **Supabase Realtime** (existing) | Reuse portal-chat patterns. |
| Outbound email | **Brevo** (existing) | Reply notifications, receipts, founder alerts. |
| Inbound email → ticket | **Cloudflare Email Routing + Email Worker** | Free. Posts parsed mail to a secured Stackivo webhook. |
| Human mailbox / sending identity | **Google Workspace** `support@stackivo.me` | Manual fallback + a copy of inbound; proper SPF/DKIM/DMARC. |
| Tier-0 deflection | **Stackivo AI assistant + FAQ** (existing) | Answer before a ticket is even created. |
| **Removed** | Crisp, Zoho Desk | Widget, clients, webhooks, env vars all deleted. |

---

## 4. Data model (new migrations)

**`support_tickets`** — the conversation/thread (first-party):
`id`, `user_id` (nullable for guests), `email`, `name`, `subject`, `status` (`new` / `open` / `waiting_on_customer` / `waiting_on_us` / `resolved` / `closed`), `priority` (`low`/`normal`/`high`/`urgent`), `category` (existing 6-cat taxonomy), `plan_at_creation`, `assignee_user_id`, `tags[]`, `channel` (`in_app`/`chat`/`email`/`contact_form`), `sla_due_at`, `first_response_at`, `resolved_at`, `last_message_at`, `last_customer_message_at`, `public_token` (guest access + email threading), `source_page`, `trace_id`, timestamps.

**`support_messages`** — the bodies:
`id`, `ticket_id`, `author_type` (`customer`/`agent`/`system`/`ai`), `author_user_id`, `body`, `attachments` (jsonb → storage refs), `via` (`in_app`/`chat`/`email`), `external_message_id` (email dedupe), `is_internal_note` (agent-only), `created_at`.

**`support_canned_responses`** — `id`, `title`, `shortcut`, `body`, `category`.

**Storage:** bucket `support-attachments`, RLS scoped by `user_id` / ticket token.

**RLS:**
- Customers: SELECT/INSERT their own tickets + messages (`user_id = auth.uid()`), **never** `is_internal_note` rows.
- Guests: access via `public_token` through server actions only (no direct RLS read).
- Admin: service-role.

**Legacy:** `support_threads` is left in place but no longer written/read (harmless). New tickets are first-party.

---

## 5. Tier-wise support policy (recommended default)

| Tier | Channels | Priority / SLA target | Live chat |
|---|---|---|---|
| **Free** | FAQ + AI assistant + async ticket/email | Best-effort, no promised SLA | "Leave a message" (async) |
| **Pro** | In-app tickets + email + live chat | Priority queue, **~24h** first response | Live during hours |
| **Business** | Everything, top of queue | **~4–8h** first response | Live, prioritized |

Mechanics: store `plan_at_creation`, compute `sla_due_at` by plan, show SLA badges to the customer, and sort the admin queue by plan / MRR / priority / SLA-breach. Live-chat "online" affordance is gated by tier (free sees async).

---

## 6. Surfaces

### Customer-facing
1. **`/help`** — keep FAQ accordion + AI deflection; replace bug-report form with unified **Contact support** (creates a first-party ticket) + **My tickets** list + threaded ticket detail with reply box.
2. **Live chat widget** — first-party floating button (replaces Crisp/`SupportButton`), **visible on desktop + mobile**. Opens a panel backed by Supabase Realtime; unread badge; optional typing/presence. Tier-aware (live vs leave-a-message).
3. **Marketing `/contact`** (logged-out) — form creates a **guest ticket** (email required), returns a `public_token` link (`/support/t/[token]`) to view/continue, plus a confirmation email. No Crisp.

### Admin-facing — `/admin/support`
- Inbox over `support_tickets`: status tabs, filters (plan, priority, category, assignee, unanswered), sort by SLA/plan/MRR, search; metrics (open/waiting/resolved, first-response time, SLA breaches).
- `/admin/support/[id]`: full thread, **reply box** (writes agent message → emails customer + realtime push), **internal notes**, status/priority/category/tags/assignee editors, **canned responses**, SLA timer, customer context panel (plan, MRR, recent activity, deep link to user).
- Keep **Delivery failures** tab (`delivery_logs`); add "convert failure → ticket".
- Canned-responses CRUD.

### Email bridge
- **Outbound:** new ticket → confirmation to customer + alert to founder; agent reply → email customer with a **reply-to token address** (`support+<token>@stackivo.me`).
- **Inbound:** Cloudflare Email Worker parses mail to `support@` (+ plus-addressed), extracts the ticket token (plus-address → `In-Reply-To`/`References` → subject tag), and `POST`s to **`/api/support/inbound`** (HMAC-secured). Server dedupes by `Message-ID`, appends as a customer message, reopens the ticket; unmatched mail opens a **new** ticket.

---

## 7. Phases of execution

> Built in parallel to the old system; Crisp/Zoho are removed only at the end so nothing breaks mid-flight.

- **S0 — Schema & scaffolding.** Migrations (tickets, messages, canned, bucket + RLS), shared types, feature flag to flip `/help` + `/admin/support` old→new.
- **S1 — Ticket core (server).** Server actions (create/add-message/list/get for user, guest-by-token, and admin: list/get/reply/status/priority/category/tags/assignee/internal-note/canned CRUD); email templates (new-ticket, reply, ack); SLA computation by plan.
- **S2 — Customer surfaces.** Rebuild `/help`; ticket detail (threaded); marketing `/contact` → guest ticket + `/support/t/[token]` page.
- **S3 — Live chat widget.** First-party Realtime widget replacing Crisp; desktop + mobile; unread badge; tier behavior.
- **S4 — Admin console.** Rebuild inbox + conversation view; filters/sort/search/metrics; canned responses; keep delivery-failures + convert-to-ticket.
- **S5 — Email bridge.** Outbound token reply-to; `/api/support/inbound` (HMAC, dedupe, match/create); Cloudflare Email Worker (committed to repo for deploy).
- **S6 — Remove Crisp + Zoho.** Delete providers/clients/webhooks/env vars/competitor refs; fix contact-page + FAQ copy; stop using `support_threads`.
- **S7 — Verify + polish + guide.** Bundle/RLS/mobile/GST-off checks; SLA badges + tier gating; full setup guide.

Each phase ends with the standard verification (esbuild bundle at warning level for the import graph, null scan, RLS spot-check; full `npm run build` run by you locally).

---

## 8. Setup you'll do (full step-by-step delivered after coding)

1. **Google Workspace:** ensure `support@stackivo.me` (mailbox or group) exists.
2. **DNS / deliverability (Cloudflare):** SPF, DKIM, DMARC covering Brevo **and** Workspace sending.
3. **Cloudflare Email Routing:** enable for `stackivo.me`; route `support@` (and catch plus-addressing) to an **Email Worker**; Worker forwards to `/api/support/inbound` with the shared secret (and optionally a copy to your Workspace inbox).
4. **Env vars:** add `SUPPORT_INBOUND_SECRET` (+ any reply-domain config); **remove** all `CRISP_*` and `ZOHO_DESK_*` vars.
5. **Test:** round-trip — create ticket in app → reply from admin → customer email → customer replies by email → reply appears back in the thread.

---

## 9. Out of scope (for now)
- Multi-agent teams / round-robin assignment (schema leaves room via `assignee_user_id`).
- Public knowledge base CMS (FAQ stays code-defined; can graduate later).
- CSAT surveys, SLA escalation automations (easy follow-ups once core lands).

---

## 10. Recommended order
**S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7.** Start with S0 (schema) so everything downstream has a stable foundation.
