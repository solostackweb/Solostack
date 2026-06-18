# Stackivo — Help & Support: Setup Guide

This is everything **you** do to switch on the new first-party support system
and retire Crisp + Zoho Desk. Total external cost: **₹0** (Supabase + Brevo free
tier + Cloudflare free + the Google Workspace you already pay for).

Work top to bottom. Steps 1–2 make support work in-app immediately; steps 3–5
add the email bridge (customers can reply by email and it threads back).

---

## 0. What changed (so you know what you're configuring)

- Support is now **first-party**: tickets + messages live in your own Supabase
  (`support_tickets`, `support_messages`). No Crisp, no Zoho.
- Customers reach you via: the **live chat widget** (bottom-right on the
  dashboard), the **/help** page, the **/contact** page (guests), or by
  **emailing `support@stackivo.me`**.
- You run everything from **`/admin/support`** (inbox, reply, internal notes,
  status/priority/tags, canned responses, SLA, delivery failures).
- Tiers: **Free** = best-effort · **Pro** = ~24h · **Business** = ~4–8h, shown
  as SLA badges and used to sort your queue.

---

## 1. Apply the database migration  *(required)*

Run migration **`0047_support_system.sql`** on your Supabase project.

- Supabase Dashboard → SQL Editor → paste the file → Run, **or**
- `supabase db push` if you use the CLI.

This creates the tables, RLS policies, the `support-attachments` bucket, and
enables Realtime on the support tables. Safe to run once.

> After this, the in-app widget, /help, /contact, ticket pages, and
> `/admin/support` are fully functional — even before you touch email.

---

## 2. Environment variables  *(required + cleanup)*

In **Vercel → Project → Settings → Environment Variables**:

**Add:**

| Name | Value |
|---|---|
| `SUPPORT_INBOUND_SECRET` | a long random string — generate with `openssl rand -hex 32` |

**Remove** (no longer used — safe to delete):
`NEXT_PUBLIC_CRISP_WEBSITE_ID`, `CRISP_API_IDENTIFIER`, `CRISP_API_KEY`,
`CRISP_WEBHOOK_SECRET`, `NEXT_PUBLIC_ZOHO_DESK_HELP_URL`, `ZOHO_DESK_ORG_ID`,
`ZOHO_DESK_ACCESS_TOKEN`, `ZOHO_DESK_DEPARTMENT_ID`, `ZOHO_DESK_API_BASE`,
`ZOHO_DESK_WEBHOOK_SECRET`.

Redeploy after changing env vars.

> Email **sending** already works through your existing Brevo config — no new
> sending setup is needed. `SUPPORT_INBOUND_SECRET` is only for receiving.

---

## 3. Google Workspace — the `support@` mailbox

You want a real `support@stackivo.me` address that humans and Cloudflare can use.

1. **Google Admin** (admin.google.com) → **Directory → Users**, or
   **Apps → Google Workspace → Gmail → Routing** to create a **group**.
2. Easiest: create a **Group** `support@stackivo.me` (Groups → Create group) and
   add yourself as a member, so mail to `support@` lands in your inbox.
3. That's all Workspace needs for now — Cloudflare handles the inbound routing in
   step 5, and can also forward a copy here.

> Why both Workspace and Cloudflare? Workspace is your human mailbox + a clean
> sending identity. Cloudflare Email Routing is what turns inbound mail into
> Stackivo tickets. They coexist (see the note in step 5 about MX records).

---

## 4. Email deliverability (SPF / DKIM / DMARC)

So your outbound support email lands in inboxes, not spam. In **Cloudflare → DNS**
for `stackivo.me`:

- **SPF** (one TXT record on the root) authorising **both** senders, e.g.
  `v=spf1 include:spf.brevo.com include:_spf.google.com ~all`
- **DKIM**: add the DKIM CNAME/TXT records Brevo gives you (Brevo → Senders &
  Domains → Authenticate) **and** the Google Workspace DKIM key
  (Google Admin → Gmail → Authenticate email).
- **DMARC** (TXT at `_dmarc`): start relaxed, e.g.
  `v=DMARC1; p=none; rua=mailto:support@stackivo.me`

> If Brevo's domain authentication is already green from your existing setup, you
> only need to **add Google** to SPF + add Google's DKIM.

---

## 5. Cloudflare Email Routing + the inbound Worker

This is what lets a customer **reply to a support email** and have it appear in
the ticket. Full details in **`infra/cloudflare-email-worker/README.md`**; summary:

1. **Deploy the worker** (from the repo):
   ```
   cd infra/cloudflare-email-worker
   npx wrangler deploy
   npx wrangler secret put SUPPORT_INBOUND_SECRET   # same value as Vercel
   ```
   Edit `wrangler.toml` if your URL isn't `https://stackivo.me/...`. Uncomment
   `FORWARD_TO` to also drop a copy in your Workspace inbox.
2. **Cloudflare dashboard → `stackivo.me` → Email → Email Routing → Get started**
   (this adds the receiving **MX** + SPF records automatically).
3. **Routing rules:**
   - `support@stackivo.me` → **Send to a Worker** → `stackivo-support-inbound`.
   - Set the **catch-all** action to the same Worker so plus-addresses
     (`support+<token>@…`, used to thread replies) are captured.

> ⚠️ MX note: Email Routing sets Cloudflare MX records to *receive* mail. If you
> also want full Google Workspace mailboxes receiving on the same domain, keep
> `support@` on Cloudflare routing and use a **subdomain** (e.g.
> `team@mail.stackivo.me`) for Workspace, or route `support@` to the Worker and
> let the Worker `FORWARD_TO` your Workspace address. Don't point the same
> address at both Google MX and Cloudflare routing simultaneously.

---

## 6. Test the round-trip

1. **In-app:** open the chat bubble (bottom-right of the dashboard) → send a
   message → confirm it appears in **`/admin/support`**.
2. **Admin reply:** open the ticket → **Reply to customer** → the customer gets
   an email and sees it in their chat/`/help/tickets`.
3. **Email in:** from any mailbox, email `support@stackivo.me` → a new ticket
   appears in the inbox.
4. **Email reply threads:** reply to a Stackivo support email (it's
   `Reply-To: support+<token>@…`) → the reply lands on the **same** ticket.
5. **Guest:** open `/contact` logged-out → submit → you get a ticket + the guest
   gets a `/support/t/<token>` link.

---

## 7. Day-to-day (for you)

- **`/admin/support`** — tabs (Needs reply / Waiting / Resolved / Delivery
  failures), search, plan + priority + SLA badges.
- Open a ticket to **reply**, add a **private internal note**, insert a **canned
  response**, or change **status / priority / category / tags**.
- Create reusable replies once (canned responses) to move faster.
- The **Delivery failures** tab surfaces bounced/blocked transactional emails.

---

## 8. Tier policy (current defaults)

| Tier | First-response target | Live chat |
|---|---|---|
| Free | Best-effort | "Leave a message" (still real-time delivery) |
| Pro | ~24 hours | Online |
| Business | ~4–8 hours | Online, prioritized |

To change these, edit `TIER_SUPPORT_POLICY` in
`src/features/support/ticket-types.ts` (labels, SLA hours, queue weight).

---

## 9. Cost summary

| Piece | Service | Cost |
|---|---|---|
| Tickets, messages, attachments, realtime | Supabase | included |
| Outbound email | Brevo | free tier |
| Inbound email → ticket | Cloudflare Email Routing + Worker | free |
| Human mailbox / sending identity | Google Workspace | already owned |
| **Total new spend** | | **₹0** |
