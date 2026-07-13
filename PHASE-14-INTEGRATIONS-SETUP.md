# Phase 14: Integrations Setup

## What changed

- Added `/dashboard/settings/integrations`.
- Added Integrations to the Settings navigation.
- Documented current integration capabilities in-app:
  - Google Calendar add-links,
  - Outlook add-links,
  - `.ics` meeting downloads,
  - subscribable portal calendar feeds,
  - platform transactional email,
  - Wise/PayPal/Payoneer/bank payment connections through Payments settings.
- Added recommended setup order for Indian freelancers working with global clients.

## Required setup

No new database migration is required for this phase.

For deeper future Google Drive/Gmail sync, finish Google OAuth app verification first:

1. Public homepage must be accessible without login.
2. Homepage must clearly explain Stackivo.
3. OAuth app name must match the homepage branding.
4. Privacy policy and terms must be reachable publicly.

## Manual QA checklist

1. Open `/dashboard/settings/integrations`.
2. Confirm each integration card renders in light and dark mode.
3. Open the Google Calendar external link.
4. Open Payment settings from the payment card.
5. Open Portal from the calendar/files cards.
6. In a client portal meeting, confirm:
   - Google Calendar add-link works,
   - Outlook add-link works,
   - `.ics` download works,
   - Subscribe calendar copies a `webcal://` link.

## Notes

- This phase does not add fake OAuth connection states.
- Current calendar integration is link/feed based, which is safer and usable before Google OAuth verification.
- Payment integrations remain instruction/link based for international methods; Stackivo does not hold client funds.
