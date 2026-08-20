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

### Meetings — completed

The unavailable-calendar state is no longer a centered technical dead end. It
now distinguishes missing Google credentials from unavailable secure token
storage, tells the user who needs to act, and provides a direct setup-help path.
The supporting Flowline explains the real availability → client choice → Meet
link lifecycle without implying that scheduling is already available.

Evidence:

- `screenshots/meetings-baseline.png` — pre-change desktop state.
- `screenshots/meetings-mobile-baseline.png` — pre-change mobile state.
- `screenshots/meetings-calm-command.png` — desktop result.
- `screenshots/meetings-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Replaced the generic centered deployment error with an actionable setup gate.
2. Separated credential and secure-storage failure copy.
3. Added a verified recovery route to Help & support.
4. Explained the real scheduling lifecycle and privacy boundary.

Meetings design score: **D → B**.

Meetings AI slop score: **C → B**.

The setup-help destination was verified at `/help`. Clean desktop and mobile
reloads produced no runtime console errors. Connected calendars, the populated
meeting board, status actions, availability, and scheduling behavior remain
unchanged because this finding is limited to the deployment gate.

### Documents — completed

The Documents hub no longer presents five equal icon cards as a generic feature
catalogue. Its primary surface now follows the actual client-delivery sequence:
proposal → contract → questionnaire → welcome document. Lead forms sit apart as
the pre-client acquisition path, so they no longer compete with delivery work.
All original destinations and the Ivo guidance entry point remain available.

Evidence:

- `screenshots/documents-baseline.png` — pre-change desktop state.
- `screenshots/documents-mobile-baseline.png` — pre-change mobile state.
- `screenshots/documents-calm-command.png` — desktop result.
- `screenshots/documents-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Removed the repeated three-column icon-card pattern.
2. Reordered document types around the real client journey.
3. Added one meaningful Flowline instead of five decorative card icons.
4. Separated lead capture from post-sale client delivery.
5. Reduced mobile scanning from five oversized cards to compact workflow rows.

Documents design score: **C → B**.

Documents AI slop score: **D → B**.

The Proposals and Lead forms destinations were opened in the authenticated
browser and rendered successfully. Clean desktop and mobile reloads produced no
runtime console errors. The browser reports only the pre-existing Next.js
development warning about smooth scrolling during route transitions.

### Proposals — completed

The empty Proposals workspace now starts with the decision the user needs to
prepare, rather than four zero-value metrics, inactive filters, and repeated
creation actions. The Proposal desk frames the real draft → client review →
accepted lifecycle and names the commercial details that make an offer
actionable. Populated proposal lists, filters, sending, deletion, status, and
conversion behavior remain unchanged.

Evidence:

- `screenshots/proposals-baseline.png` — pre-change desktop state.
- `screenshots/proposals-mobile-baseline.png` — pre-change mobile state.
- `screenshots/proposals-calm-command.png` — desktop result.
- `screenshots/proposals-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Hid zero-value metrics and controls when there are no proposals to operate on.
2. Removed duplicate creation and Ivo actions from the empty page header.
3. Replaced the generic empty state with a proposal-specific decision desk.
4. Explained the draft → review → acceptance journey with one meaningful Flowline.
5. Kept the primary action at the 44px touch floor on desktop and mobile.

Proposals design score: **C → B**.

Proposals AI slop score: **D → B**.

The primary action was verified in the authenticated browser. It opens
`/dashboard/proposals/new`, where both the blank proposal path and existing
templates render successfully. Clean desktop and mobile reloads produced no
runtime console errors. Populated proposal cards and their actions are deferred
for visual verification with real data; their implementation was not changed.

### Contracts — completed

The empty Contracts workspace now explains the signature journey instead of
leading with four zero-value metrics, inactive controls, and three competing
creation actions. The Contract desk gives one primary route into agreement
creation, keeps Ivo available as an intentional drafting aid, and shows the real
draft → sent → signed lifecycle. Populated contract lists, filtering, sending,
resending, deletion, statuses, and signed-value calculations remain unchanged.

Evidence:

- `screenshots/contracts-baseline.png` — pre-change desktop state.
- `screenshots/contracts-mobile-baseline.png` — pre-change mobile state.
- `screenshots/contracts-calm-command.png` — desktop result.
- `screenshots/contracts-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Hid zero-value metrics and controls when there are no contracts to operate on.
2. Removed duplicate creation and AI actions from the empty page header.
3. Replaced the generic empty state with a contract-specific signature desk.
4. Explained the draft → sent → signed journey with one meaningful Flowline.
5. Kept contract creation primary and Ivo drafting visibly secondary.

Contracts design score: **C → B**.

Contracts AI slop score: **D → B**.

The primary action was verified in the authenticated browser. It opens
`/dashboard/contracts/new`, where the existing signature prerequisite correctly
offers signature setup and profile settings before contract authoring. Desktop
and mobile reloads produced no application runtime errors. Development logs
contain only report-only analytics CSP notices and the known Next.js smooth-scroll
warning. Populated contract rows and actions are deferred for visual verification
with real data; their implementation was not changed.

### Questionnaires — completed

The first-use Questionnaires workspace now starts with the client brief journey,
not a duplicate empty-state action followed by nine equal template cards. The
Brief desk explains build → response → kickoff readiness, while the starter
library is a compact, scan-friendly list that keeps every existing brief and its
server action available. Populated questionnaire editing, responses, sending,
and deletion remain unchanged.

Evidence:

- `screenshots/questionnaires-baseline.png` — pre-change desktop state.
- `screenshots/questionnaires-mobile-baseline.png` — pre-change mobile state.
- `screenshots/questionnaires-calm-command.png` — desktop result.
- `screenshots/questionnaires-mobile-calm-command.png` — mobile result.

Quick wins completed:

1. Removed the duplicate first-questionnaire action from the empty page header.
2. Replaced the generic empty card with a brief-specific preparation desk.
3. Explained build → client response → kickoff readiness with one Flowline.
4. Replaced nine oversized template cards with one compact starting-brief list.
5. Raised blank and starter actions to the 44px touch floor.

Questionnaires design score: **C → B**.

Questionnaires AI slop score: **D → B**.

The primary action was verified in the authenticated browser. It opens
`/dashboard/questionnaires/new`, where the existing title, introduction, question
builder, and save controls render successfully. Desktop and mobile reloads
produced no application runtime errors. Starter creation was not submitted during
QA because it would create workspace data; its existing server action was
preserved unchanged.

### Next

Reframe Welcome documents around the client alignment handoff, then verify its
creation route and relationship to the completed questionnaire step.
