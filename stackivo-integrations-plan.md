# Stackivo — Calendar, Video & Workspace Integrations Plan (v2)

Revised per your feedback: Slack dropped (too early), payment integrations dropped (India-only freelancer app — UPI covers domestic, existing Razorpay international methods already cover cross-border, no gap there). Zoom stays paired with Google Meet as a joint video-link addition. Google Calendar is confirmed as-is on the backend, no changes needed there — but its front-end visibility on the Meetings page is broken and is now a fix item in section 0. Gmail send-as confirmed as a priority addition. Daily.co stays exactly as it is today — nothing here replaces or touches the in-app embedded video feature; Zoom/Meet are link-generation options that sit *alongside* it, not a replacement.

## 0. Fix first: Google Calendar isn't actually set up anywhere you'd look for it

You flagged this directly and asked me to check every surface — Meetings page, client portal, Settings → Integrations, and Ivo. Audited all four in the actual code. Verdict per surface:

| Surface | Status | Evidence |
|---|---|---|
| **Meetings page** (`meetings-hub-view.tsx`) | **Not wired.** No mention of Google Calendar, no connection state, no link to the real connect flow. Only buttons are "Availability" and "Schedule a call." | The real "Connect Google Calendar" button only exists at `/dashboard/meetings/availability`, one click behind a button whose label gives no hint it's the integration entry point. |
| **Client portal** (`features/portals/**`) | **Not wired — and not meant to be.** `portals/calendar.ts` only builds "Add to Calendar" links (Google/Outlook URLs + an .ics file) for the *client* to add a confirmed meeting to their own calendar. That's a different, legitimate feature — it has nothing to do with *your* OAuth connection and was never supposed to. | No reference to `calendar_connections` or `isGoogleConfigured` anywhere in the portal feature. |
| **Settings → Integrations** (`/dashboard/settings/integrations/page.tsx`) | **Wired to nothing — it's a static, hardcoded page.** It lists a "Google Calendar" card labeled **"Workflow-ready"** with a green checkmark, but the card never checks `isGoogleConfigured()` or `calendar_connections`, and its buttons link to "Open portals" and an external `calendar.google.com` URL — **not** to the real connect flow at `/dashboard/meetings/availability`. This is actively misleading: it tells you the integration is ready when there is no connect action on the page at all. | `page.tsx` line 17–28: the entire `integrations` array is a hardcoded literal, not data read from your actual connection state. |
| **Ivo** (`ai-workflows/domain-operations.ts`) | **Correctly wired**, the one place that is. Before booking an availability-mode meeting, it calls `getCalendarConnection()` + `isGoogleConfigured()` and, if not connected, returns an `availabilitySetup` flag that the assistant panel uses to redirect you to `/dashboard/meetings/availability`. | `domain-operations.ts` ~line 1619; asserted directly by `evals/meeting-availability-integrity.eval.ts`. |

**So the honest summary: there is exactly one working, real "Connect Google Calendar" button in the entire app**, and it lives at `/dashboard/meetings/availability` — not on the Meetings page, not in the portal, and not on the Settings → Integrations page that claims it's already "workflow-ready." You were right that it's effectively not set up anywhere a normal user would look.

**Fix, in order:**

1. **Deployment check first, costs nothing:** confirm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT` are actually set (see section 8 below for exactly where to get them). If any is blank, the one real connect button won't even render — `isGoogleConfigured()` returns false and the availability page just shows "not enabled on this deployment yet." Rule this out before anything else.
2. **Rewrite the Settings → Integrations Google Calendar card to be real, not decorative:** replace the hardcoded "Workflow-ready" entry with one that reads actual connection state (`getCalendarConnection()` + `isGoogleConfigured()`) and links straight to `/api/google/connect` (or shows Connected/Disconnect) — the same data `scheduling-settings-view.tsx` already has. This is the highest-priority single fix, because right now this page actively lies about the feature's state.
3. **Add visibility on the Meetings page**: connection-status badge in the header (Connected / Not connected / Not set up on this deployment) with a one-click connect action, plus renaming "Availability" to something that also reads as the integration entry point (e.g. "Calendar & Availability").
4. **Leave the portal's "Add to Calendar" links alone** — that's a separate, working feature for clients, not a gap.

This is the very first thing to build, ahead of Zoom/Meet/Gmail — every one of those would inherit the same "real feature, invisible or misleadingly labeled everywhere" problem if this isn't fixed first.

## 1. What's already there (unchanged from audit)

| Area | Current state |
|---|---|
| Calendar | Google Calendar — OAuth (`google.ts`), free/busy read, event + Meet-link creation. Confirmed good, no changes planned. |
| Video | Daily.co (`video.ts`) — in-app embedded rooms via iframe, free tier, no client SDK dependency. **Stays as the primary/default in-app meeting experience.** |
| Email | Brevo (API or SMTP) — default and required sender. |
| Payments | Razorpay (UPI + cards etc. domestic, existing international methods). No changes planned. |

## 2. Revised integration set

### A. Zoom + Google Meet as joint link-generation options (alongside Daily, not replacing it)

Today a meeting can be: a Daily.co embedded room, or a Google Meet link created automatically when a Google-connected user books via Calendar, or a manually pasted link. The addition is Zoom as a third *generated* link option, offered together with Meet wherever a user picks how their meeting should happen.

- **Zoom**: Server-to-Server OAuth app + Meetings API (`POST /users/me/meetings`) to create a scheduled meeting and return join/host URLs. New `zoom.ts` mirroring the shape of `video.ts`: `isZoomConfigured()`, `createZoomMeeting()`.
- **Google Meet**: already technically available today via `google.ts`'s `withMeet` flag on `createCalendarEvent()` — currently only triggered inside the Calendar-connected booking flow. The addition is surfacing it as an explicit, standalone "Generate a Meet link" choice even for a manually-scheduled meeting (not only the availability-mode Calendar flow), so it's a first-class option next to Daily and Zoom rather than a side effect of connecting Calendar.
- **UI**: meeting creation gets a `videoProvider` choice — `daily` (default, in-app), `google_meet`, `zoom`, or `manual_link` — surfaced once, at meeting-creation time, in `meeting-new-view.tsx` and the scheduling settings view. Daily remains the pre-selected default so nothing changes for existing users unless they actively choose otherwise.
- **Data model**: `meetings` table already stores a link/URL per meeting (used today for the pasted-link fallback) — the new providers just populate that same field with a provider tag, no schema redesign needed beyond a `video_provider` column.

This is additive only: Daily.co's embed component (`daily-embed.tsx`), its free-tier usage, and its use as the default remain fully intact.

### B. Gmail send-as (confirmed priority)

- Extend the existing Google OAuth scope (already used for Calendar) to include `gmail.send`, so a connected user can optionally route invoice/contract/proposal emails through their own Gmail address via the Gmail API.
- **Brevo stays the default and required path.** Email must keep working with zero Google connection — Gmail is strictly an opt-in per-user sender identity, chosen in Settings, not a replacement for the transactional email system.
- Implementation sits at the same seam where delivery tools currently call `brevo-api.ts` (e.g. `invoice.deliver`): a thin sender-selection layer checks whether the user has Gmail connected and opted in, otherwise falls through to Brevo — the audited ledger, idempotency key, and dedupe logic in the Ivo delivery tools stay untouched, only the transport changes.
- Practical benefit: emails land from the freelancer's own @gmail.com or Workspace address, which many clients trust more than a third-party sending domain — directly useful for invoice/contract delivery trust.

## 3. Explicitly out of scope (per your steer)

- Slack notifications — deferred, too early for the product stage.
- Stripe/PayPal or any additional payment rails — not needed; India-only freelancer base is fully served by existing Razorpay UPI (domestic) and current international methods.
- Anything that touches or replaces Daily.co's in-app meeting experience — Daily stays as-is and as the default.

## 4. Still worth keeping on the radar (not built now, just noted)

These were in the earlier draft as lower-tier items and remain reasonable *later* candidates, but are not part of this focused round unless you want them added back in:

- Microsoft/Outlook Calendar parity (for non-Google freelancers).
- Google Drive attach/export for portal files.
- Google Contacts import for client creation.
- A generic outbound webhook, once there's an actual second channel to justify it — with Slack off the table for now, this has no immediate anchor point, so it's parked rather than planned.

## 5. Suggested build order (revised)

0. **Fix Google Calendar visibility on the Meetings page** (section 0) — deployment env check + Meetings-hub connection badge + button rename. Do this before anything else below.
1. **Zoom meeting creation** (`zoom.ts`, Server-to-Server OAuth + Meetings API) — smallest new surface.
2. **Standalone Google Meet link option** — mostly UI/wiring, since `withMeet` already exists in `google.ts`; just needs to be reachable outside the Calendar-availability flow.
3. **`videoProvider` selection in meeting creation UI** — ties Daily/Meet/Zoom/manual together as one explicit choice, Daily pre-selected.
4. **Gmail send-as** — extend Google OAuth scope, add sender-selection layer ahead of the existing Brevo call site, opt-in only.

## 6. New env vars this implies

```
# --- Zoom (video meetings) ---
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
```

No new env vars needed for the Google Meet standalone option (reuses existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT` and the `calendar.events` scope already requested) or for Gmail send-as beyond adding `gmail.send` to the existing `SCOPES` array in `google.ts` — both ride on the Google connection that's already there. Zoom is the only genuinely new credential set, following the same `isZoomConfigured()` fail-closed pattern as every other optional integration in the app.

## 7. How integrations get discovered, connected, and kept visible

Today "integration" in Stackivo means one line hidden in a settings page — a user only finds out Google Calendar exists if they happen to open Scheduling settings. That's not enough for three connections that each unlock real functionality (faster invoice trust, real meeting links, no manual slot-picking). This section is the product surface plan, not just the settings checkbox.

### 7.1 A dedicated Integrations hub (new page, not a settings subsection)

Add `/dashboard/settings/integrations` as its own page — reachable from Settings, but built as a small marketplace-style grid, not a form:

- One card per integration: Google Calendar, Google Meet, Zoom, Gmail send-as. Each card shows an icon, one-line value statement ("Get a real Zoom link on every meeting — no more pasting links by hand"), connection status (Not connected / Connected as you@gmail.com / Needs reconnect), and a single primary action button.
- Cards that share a provider (Calendar, Meet, Gmail all ride on the same Google OAuth) show that plainly — "Connected via Google" once, with three toggles underneath for which capabilities are turned on (Calendar sync / Meet links / Send emails as me) — so connecting Google once visibly unlocks three things instead of the user wondering why they'd connect three separate items.
- Zoom is its own card with its own OAuth connect button, since it doesn't share a provider with anything else.
- Failed/expired tokens surface as a visible "Reconnect" state on the card itself, not a silent failure discovered only when a meeting creation fails later.

This mirrors what the app already does well elsewhere (the scheduling settings view already has a "Connect Google" card) — the change is promoting that pattern into its own first-class page that covers all provider connections in one place, instead of Calendar living in Scheduling settings and nothing else having a home at all.

### 7.2 Surface integrations at the moment they'd help, not just in settings

A settings-only integrations page still only reaches users who go looking. The bigger unlock is contextual surfacing at the exact point an unconnected integration would help:

- **Meeting creation**: if Zoom/Meet aren't connected yet, the `videoProvider` picker in `meeting-new-view.tsx` shows them as selectable options that trigger the OAuth connect flow inline (connect-then-continue), rather than only listing what's already connected. First-run friction becomes the discovery moment, not a dead end.
- **Invoice/contract send**: if Gmail send-as isn't connected, the existing send dialog can show a one-line, dismissible nudge — "Send this from your own Gmail instead of Stackivo's address — Connect Gmail" — appearing only where it's contextually relevant (about to send something to a client), and only until dismissed or connected.
- **Empty/first-use states**: the Meetings hub and Scheduling settings already have empty states for "no calendar connected" — extend the same pattern so a first-time meeting creation without any calendar connected actively offers the connect action instead of just falling back silently to manual slots.
- **Ivo awareness**: Ivo's meeting-creation flow (Phase 1 slice 34 in the AI roadmap) already checks calendar availability before offering to send a live link — it should also be aware of Zoom/Meet as offered options once built, and if nothing is connected, tell the user in plain language what connecting would unlock ("Connect Zoom or Google Meet in Integrations to send a live link automatically") rather than only presenting the manual-slots fallback as if that's the only path.

### 7.3 Make integrations visible outside the settings tree entirely

- **Onboarding**: add an optional, skippable "Connect your tools" step to onboarding (`features/onboarding`) alongside whatever's already there — not mandatory, since the app must keep working with zero integrations connected, but present so it isn't undiscoverable to a brand-new user.
- **Dashboard**: a small, dismissible prompt card (same visual language as any other dashboard nudge) for users who are N days in and still have zero integrations connected — one-time, not nagging, dismissible for good.
- **Settings top-level**: Integrations gets its own entry in the settings nav (`settings/constants.ts` already defines the settings sections list) rather than being buried as a field inside Scheduling.
- **Marketing site**: once built, a short "Integrations" or "Works with your tools" section on the public marketing site (`src/features/marketing`) listing Google Calendar, Google Meet, Zoom, and Gmail with their logos — this is also a legitimate conversion lever (freelancers evaluating the product want to see it fits their existing stack before signing up), not just an in-app concern.

### 7.4 What "connected" should feel like afterward

- Each connected integration should have a visible, undo-able state — a clear "Disconnect" action on its card, not just a connect button with no way back.
- Where an integration silently changes behavior (e.g., Gmail send-as changes the From address on every future send), that should be stated plainly on the card itself ("All invoice, contract, and proposal emails will send from you@gmail.com") so the user isn't surprised by a client-facing change they made two months ago and forgot about.
- Token expiry/reconnect needs, already partly handled for Google Calendar's refresh flow, should produce an in-app notification (via the existing `notifications` system) rather than a feature quietly stopping — "Your Google connection expired — reconnect to keep creating Meet links" as a real notification, not a support ticket waiting to happen.

### 7.5 Suggested build order addition

Insert this as parallel/adjacent work to section 5, not sequential after it — the hub page and the individual integrations should ship together per integration, so nothing launches invisible:

1. Build the Integrations hub page shell (`/dashboard/settings/integrations`) with the Google (Calendar/Meet/Gmail) card wired to the existing OAuth connect flow — this alone fixes the "Calendar is invisible unless you're already in Scheduling settings" problem even before Zoom exists.
2. Ship Zoom connect + card in the same hub as its own OAuth entry.
3. Add the `videoProvider` picker's inline connect-then-continue behavior in meeting creation.
4. Add the Gmail send-as nudge on the invoice/contract send dialog, plus the "sending from you@gmail.com" state notice on its card.
5. Add the onboarding step and dashboard nudge once the hub itself is stable — these are discovery amplifiers, not gates, so they should come after the destination they point to already works.

## 8. Where to get the actual credentials

### 8.1 Google (Calendar, and later Meet/Gmail — same credential set)

Stackivo's Google integration needs three values: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT`. All three come from one place, Google Cloud Console:

1. Go to **console.cloud.google.com** and sign in with the Google account you want to own this (your business account, not a personal one — you'll manage OAuth consent and verification from here).
2. **Create a project** (top-left project dropdown → "New Project"). Name it something like "Stackivo" — this is just a container for credentials, not customer-facing.
3. **Enable the API**: left sidebar → "APIs & Services" → "Library" → search "Google Calendar API" → Enable. (When you build Gmail send-as later, also enable "Gmail API" in the same project — same credentials will cover both once you add the scope.)
4. **Configure the OAuth consent screen** (APIs & Services → "OAuth consent screen"): choose **External** user type (your users are freelancers with regular Gmail/Workspace accounts, not accounts inside your own Google org). Fill in app name ("Stackivo"), support email, and your app's logo/domain when ready. While the app is in **Testing** mode, only accounts you explicitly add as test users can connect — fine for development, but you'll need to submit for **verification** before real users can connect broadly (Google reviews apps requesting sensitive scopes like calendar write access; this can take a few days to a few weeks, budget for it before a public integrations launch).
5. **Create the OAuth Client ID** (APIs & Services → "Credentials" → "Create Credentials" → "OAuth client ID"): Application type = **Web application**. Under "Authorized redirect URIs," add the exact callback URL your app already expects — based on `google.ts`'s flow, this is whatever route handles the OAuth callback (`/api/google/connect/callback` or similar in your codebase; check the route handler under `src/app/api/google/`, and use `https://yourdomain.com/...` for production plus `http://localhost:3000/...` for local dev as a second entry).
6. Google shows you a **Client ID** and **Client Secret** immediately after creation — copy both. Client ID → `GOOGLE_CLIENT_ID`. Client Secret → `GOOGLE_CLIENT_SECRET`. The exact redirect URI you registered in step 5 → `GOOGLE_OAUTH_REDIRECT`, matched exactly (Google rejects any mismatch, including trailing slashes).
7. Paste all three into `.env.local` for local dev, and into your hosting provider's environment variable settings (Vercel, based on the `vercel.json` in this repo) for staging/production — each environment needs its own redirect URI registered if the domains differ.

**Scopes already requested by the app** (from `google.ts`): `calendar.events`, `calendar.freebusy`, `openid`, `email`. You don't configure these in the Console directly for a Web application client — they're requested at auth time by the code and just need to be declared on the consent screen's "Scopes" step so Google doesn't flag them as unreviewed for verification. When Gmail send-as is built, `gmail.send` gets added there too.

### 8.2 Zoom (when built)

Zoom credentials come from **marketplace.zoom.us** → "Develop" → "Build App" → choose **Server-to-Server OAuth** app type (this fits Stackivo's model better than user-level OAuth, since it's your platform account creating meetings on behalf of a connected feature, not asking each freelancer to individually authorize a Zoom app — confirm this matches your intended UX before committing to the app type). After creating the app, Zoom shows an **Account ID**, **Client ID**, and **Client Secret** on the app's credentials tab — these map directly to `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`. You'll need to add the specific scopes for meeting creation (`meeting:write:admin` or equivalent) under the app's "Scopes" tab before it works.

### 8.3 A general note on account ownership

Whoever's Google/Zoom account creates these OAuth apps becomes the account of record for API quota, verification status, and billing alerts — make sure it's a Stackivo business account you control long-term, not a personal one, since losing access to it later means losing the ability to manage the integration.

## 9. Are these integrations free to integrate?

**Yes.**

Google Calendar API, Gmail API, and Zoom's Server-to-Server OAuth app all have free tiers that comfortably cover a freelancer-scale product — Google Calendar/Gmail API usage is free up to very high daily quotas (measured in requests per user per 100 seconds, not dollars, and Stackivo's usage pattern is nowhere near those ceilings), and creating a Zoom Server-to-Server app itself costs nothing (Zoom's paid tiers gate *meeting capacity/features for the Zoom account making the calls*, like participant limits, not the API access itself — worth confirming the specific Zoom plan tier needed once you decide whether meetings should run through a free or paid Zoom account, since a free Zoom account caps group meeting length at 40 minutes, though that limit doesn't apply to 1:1 calls, which is Stackivo's primary use case). The only real cost across all of this is engineering time and, for Google, the verification review process being a wait rather than a fee.
