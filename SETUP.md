# Stackivo Setup (things done outside code)

Code is done — these are the manual steps that make it actually run.
Do them once per environment (local + production).

## 1. Database migrations

```bash
supabase db push
```

This applies everything pending, including:

- `0096_fix_public_profile_rpc.sql` — public-profile RPC column fix,
  review-insert RLS fix, canonical review RPC
- `0097_calendar_sync.sql` — calendar watch-channel + sync-token columns

No dashboard steps needed for these.

## 2. Google Cloud Console (one project)

Console: https://console.cloud.google.com

1. Create a project (or reuse the existing one).
2. **APIs & Services → Library** — enable:
   - Google Calendar API
   - Gmail API (only used if the user opts into Gmail send-as)
   - Google Sheets API (questionnaire exports)
3. **APIs & Services → OAuth consent screen** → External, then add scopes:
   - `calendar.events`
   - `calendar.freebusy`
   - `gmail.send`
   - `openid`, `email`
   - (`drive.file` is requested only for Sheets connects)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   → Web application. Register one **Authorized redirect URI per
   environment**, matched exactly (no trailing slash):
   - `http://localhost:3000/api/google/callback`
   - `https://<your-domain>/api/google/callback`
5. Copy the **Client ID** and **Client Secret**.

### Domain verification (required for calendar sync-back only)

Google only delivers calendar change notifications to public HTTPS URLs
on a verified domain. Without this, `watch` requests are rejected and
external calendar edits won't flow back into meetings (everything else
still works).

1. https://search.google.com/search-console → add `stackivo.me` (or your
   domain) and complete verification.
2. The webhook address is fixed — no registration step:
   `https://<your-domain>/api/webhooks/google-calendar`

Localhost can never receive these notifications, so sync-back only
activates in production. Local dev is unaffected.

## 3. Environment variables

Generate the encryption key (any machine with node):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Var | Where | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | local + Vercel | from step 2.5 |
| `GOOGLE_CLIENT_SECRET` | local + Vercel | from step 2.5 |
| `GOOGLE_OAUTH_REDIRECT` | local + Vercel | callback URL for that env (see 2.4) |
| `TOKEN_ENCRYPTION_KEY` | local + Vercel | generated above; without it calendar shows "not connected" |
| `CRON_SECRET` | Vercel only | random string; protects all `/api/cron/*` routes |
| `ADMIN_EMAIL` | Vercel | required for `/admin` access |

(`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` are stale names
left over from an old draft — they do nothing. Don't set them.)

## 4. GitHub Actions secrets (cron jobs)

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `CRON_SECRET` | same value as the Vercel `CRON_SECRET` |
| `APP_URL` | `https://stackivo.me` (no trailing slash) |
| `CRON_BASE_URL` | `https://<your-project>.vercel.app` (optional; bypasses bot protection) |

The workflow (`.github/workflows/cron-jobs.yml`) runs on schedule —
including the daily `calendar-watch-renew` at 01:30 UTC — and every job
can also be triggered manually from the Actions tab → Cron jobs →
Run workflow.

## 5. Verify it works

1. Open **Settings → Integrations** → connect Google under Calendar.
2. Go to **Meetings → Availability** — status should show connected.
3. Create a meeting, have a client book it (or book it yourself via the
   `/m/<token>` link).
4. Move or delete that event **directly in Google Calendar**.
5. Within a minute or so, the meeting here should move / cancel itself
   and drop an in-app notification (`meeting_external_change`).

If step 4→5 doesn't happen: check `/admin/jobs` for
`calendar-watch-renew` runs, confirm the domain is verified (step 2,
above), and confirm `TOKEN_ENCRYPTION_KEY` is set in production.
