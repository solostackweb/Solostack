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

### Projects — completed

The zero-project state no longer renders search, status filters, Grid/Kanban
controls, or duplicate header actions before any project exists. It now gives
the page one job: create the first project. The Flowline explains the real
Brief → Work → Invoice → Paid lifecycle, and the populated Grid and Kanban
states remain unchanged.

Evidence:

- `screenshots/projects-baseline.png` — pre-change desktop state.
- `screenshots/projects-mobile-baseline.png` — pre-change mobile state.
- `screenshots/projects-calm-command.png` — desktop result.
- `screenshots/projects-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Hid controls with no data to control.
2. Removed duplicate creation and Ivo actions.
3. Replaced the generic centered icon state with a product-specific lifecycle.
4. Raised the new mobile actions to the 44px touch-target floor.

Projects design score: **C → B**.

Projects AI slop score: **D → B**.

The create-project dialog was opened and closed in the authenticated browser.
A clean console reload produced no runtime errors. Existing sub-44px controls in
the shared mobile shell remain a cross-product accessibility finding and were
not changed in this feature-scoped slice.

### Invoices — completed

The zero-invoice state no longer presents four zero-value KPI cards, inactive
filters, an empty table, or pagination. It now gives the page one financial job:
create the next invoice. The billing desk uses the authoritative next invoice
number and explains the real Draft → Sent → Paid lifecycle without inventing
revenue or payment data. Summary metrics, filters, bulk actions, status changes,
exports, cancellation, deletion, and the table remain unchanged for populated
accounts.

Evidence:

- `screenshots/invoices-baseline.png` — pre-change desktop state.
- `screenshots/invoices-mobile-baseline.png` — pre-change mobile state.
- `screenshots/invoices-calm-command.png` — desktop result.
- `screenshots/invoices-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Hid zero-value metrics and controls with no invoice data to operate on.
2. Removed duplicate creation and Ivo actions from the empty page header.
3. Replaced the generic empty-table illustration with a billing-specific desk.
4. Exposed the real next invoice number and raised actions to the 44px touch floor.

Invoices design score: **C → B**.

Invoices AI slop score: **D → B**.

The primary action was verified in the authenticated browser. It opens
`/dashboard/invoices/new`, where the existing signature prerequisite correctly
offers signature setup and profile settings rather than allowing an incomplete
invoice. Clean desktop and mobile reloads produced no runtime console errors.
The populated summary card mosaic and its legacy gradients are deferred until a
populated invoice state can be visually verified without fabricating data.

### Next

Carry Calm Command into Meetings: make the schedule and next commitment the
primary information, then reveal filters and management controls only when
meetings exist.
