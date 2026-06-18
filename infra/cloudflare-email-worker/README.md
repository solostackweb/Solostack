# Cloudflare Email Worker — inbound support email → ticket

Turns email sent to `support@stackivo.me` (and `support+<token>@stackivo.me`)
into first-party Stackivo support messages by POSTing to
`/api/support/inbound`. Free, runs on Cloudflare's edge.

## How it fits together

```
Customer replies to support email
        │  (To: support+<token>@stackivo.me)
        ▼
Cloudflare Email Routing  ──►  this Worker  ──►  POST /api/support/inbound
        │                                              │ (Bearer SUPPORT_INBOUND_SECRET)
        └─ (optional) forward a copy to your           ▼
           Google Workspace mailbox             append to the ticket thread
```

The plus-address `token` is the ticket's `public_token` (Stackivo sets it as the
`Reply-To` on every outbound support email). If there's no token, the app falls
back to the sender's most recent open ticket, otherwise it opens a new one.
De-duplication uses the email `Message-ID`, so retries are safe.

## One-time setup

### 1. App side
Set the secret in your Stackivo deployment (Vercel → Project → Settings → Environment Variables):

```
SUPPORT_INBOUND_SECRET = <a long random string>
```

Generate one: `openssl rand -hex 32`

### 2. Deploy the worker
```
cd infra/cloudflare-email-worker
npx wrangler deploy
npx wrangler secret put SUPPORT_INBOUND_SECRET   # paste the SAME value as the app
```
Edit `wrangler.toml` first if your inbound URL isn't `https://stackivo.me/...`,
and uncomment `FORWARD_TO` if you also want a copy in your Workspace inbox.

### 3. Cloudflare Email Routing
In the Cloudflare dashboard for `stackivo.me`:

1. **Email → Email Routing → Get started** (adds the required MX + SPF records).
2. **Routing rules → Create rule**
   - Custom address: `support@stackivo.me` → **Send to a Worker** → `stackivo-support-inbound`.
3. **Catch-all** (so `support+<token>@…` plus-addresses are captured): set the
   catch-all action to the same Worker, **or** add a rule matching `support+*`.
   (Cloudflare matches the catch-all when no exact rule matches the plus-address.)

### 4. Test
- From any mailbox, send an email to `support@stackivo.me` → a new ticket should
  appear in `/admin/support`.
- Reply to a Stackivo support email (which is `From: support@`, `Reply-To:
  support+<token>@`) → the reply should append to that existing ticket.

## Notes
- Keep `SUPPORT_INBOUND_SECRET` identical in both places or the app returns 401.
- The Worker reads up to ~1 MB of the message; attachments are ignored for now
  (customers can be told to use the in-app uploader).
- DMARC/DKIM/SPF for *sending* are configured on the Brevo + Workspace side
  (see the main setup guide); Email Routing only handles *receiving*.
