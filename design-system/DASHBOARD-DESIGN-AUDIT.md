# Stackivo Dashboard Design Audit

Date: 21 August 2026  
Design direction: Calm Command  
Reference: Picktime Smart Meetings Platform by Balkan Brothers

## Outcome

The authenticated dashboard now opens with the state of the business, not with
setup chores or an upgrade pitch. The redesign preserves every existing action
while establishing a calmer hierarchy, a more disciplined blue product canvas,
and a clearer distinction between primary work and secondary guidance.

## Problems found

1. Setup completion and the free-plan prompt appeared before the product's core
   value, making the first screen feel like onboarding and monetization chrome.
2. The sidebar used glow effects, outlined pills, repeated decorative badges,
   and a wide footprint that made the shell feel like a generic admin template.
3. Every dashboard surface had similar visual weight. Revenue, setup, upgrade,
   activity, and quick actions competed rather than forming a useful sequence.
4. Mobile creation actions wrapped unevenly and the business metrics formed a
   long single column, delaying useful information.

## Changes made

- Promoted the Business Pulse to the first product surface below the page title.
- Reframed the opening copy around money, work, and next moves.
- Reduced secondary creation actions to quiet controls while keeping invoice as
  the single blue primary action.
- Converted setup completion to a compact, expandable row on every breakpoint.
- Moved setup and plan guidance below the core business state.
- Removed the upgrade gradient, sidebar glow effects, active-row ring, icon glow,
  and decorative Pro badges.
- Narrowed the sidebar and increased content breathing room.
- Simplified the Business Pulse metrics from nested cards into a structured data
  region and gave the main command surface a deliberate two-part composition.
- Changed mobile actions to a balanced three-column row and business metrics to
  a two-column grid.

## Verification

- TypeScript: passed (`tsc --noEmit`).
- ESLint: passed for all changed source files.
- Authenticated browser test: dashboard loaded successfully with the production
  QA account.
- Interaction test: setup row expands to reveal both deep links and collapses
  back to the compact state.
- Responsive visual checks: passed at 1440×900 and 390×844.
- Browser console: no redesign runtime errors. A pre-existing Next.js development
  warning about smooth scrolling remains unrelated to this work.

## Evidence

- `screenshots/authenticated-dashboard-clean.png` — pre-change baseline.
- `screenshots/authenticated-dashboard-calm-command.png` — desktop result.
- `screenshots/authenticated-dashboard-mobile-calm-command.png` — mobile result.

## Next design slice

### Clients — completed

The zero-client state no longer renders three zero-value KPI cards, inactive
search and filter controls, table columns, or pagination. It now explains the
real product relationship — Client → Project → Invoice → Paid — and offers one
clear primary action. Search, filters, metrics, and the data table remain
available when records exist. The add-client dialog was opened and closed in the
authenticated browser to verify that the redesigned action preserved behavior.

Evidence:

- `screenshots/clients-baseline.png` — pre-change zero-client state.
- `screenshots/clients-calm-command.png` — desktop result.
- `screenshots/clients-mobile-calm-command.png` — mobile result.

### Next

Carry the same hierarchy into projects and invoices: one dominant job per page,
fewer bordered containers, financial values in mono type, restrained blue
emphasis, and the Flowline motif only where it explains a real relationship.
