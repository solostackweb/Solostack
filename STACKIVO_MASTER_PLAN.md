# Stackivo Master Product Plan

## North Star

Stackivo is the India-first client work OS for freelancers and small studios handling domestic and global clients.

The product should help a freelancer capture work, send proposals, sign contracts, create GST/export-ready invoices, track payment, manage client portals, understand business health, and use Ivo as a calm workspace assistant.

## Product Principles

- India-first, global-client-ready: GST, export invoices, INR records, foreign client currencies, and professional international documents.
- Connected clientflow over isolated tools: lead, proposal, contract, project, invoice, payment, portal, and insight should feel like one journey.
- Ivo assists, drafts, explains, and suggests. It should not become an autonomous business manager.
- Compliance and professionalism are product advantages, not afterthoughts.
- Every premium feature should save admin time or improve client trust.

## Inspiration From HoneyBook

HoneyBook is useful inspiration because it frames the category as clientflow management, not just invoicing or CRM. The relevant ideas for Stackivo are:

- Client pipeline from lead to payment.
- Proposal, contract, invoice, and payment connected into one workflow.
- Client portal as a branded experience.
- Automations and reminders for repetitive admin.
- AI embedded across workflows.
- Pricing tiers based on workflow maturity.

Stackivo should not copy HoneyBook. Stackivo should specialize in Indian freelancers who serve both domestic and international clients.

## Target User

- Indian freelancer, consultant, designer, developer, marketer, writer, agency founder, or small studio.
- Often invoices foreign clients in USD, EUR, GBP, AUD, CAD, or SGD.
- Needs Indian compliance records in INR.
- Wants to look professional without using five different tools.
- May not have a finance/admin person.

## Strategic Feature Pillars

### 1. Clientflow Pipeline

Track the lifecycle of work:

- Lead
- Planning / discovery
- Proposal sent
- Contract sent
- Active work
- Waiting on client
- Review / revision
- Completed
- Invoiced
- Paid
- Archived

### 2. Proposals And Estimates

Professional proposals for service work:

- Client and project selection.
- Scope, deliverables, timeline, packages, and pricing.
- Client currency and validity date.
- Domestic/export treatment where relevant.
- Public proposal link.
- Accept/decline flow.
- Conversion to project, contract, and invoice.

### 3. India + Global Client Intelligence

Domestic:

- GSTIN parsing.
- State auto-selection.
- CGST/SGST vs IGST.
- B2B/B2C behavior.
- HSN/SAC defaults.

International:

- Country-aware client profile.
- Default foreign currency.
- Export invoice treatment.
- Zero-rated wording where relevant.
- Locked FX rate.
- INR internal equivalent.

### 4. Payment Tracking

Real freelancer payment reality:

- Razorpay, UPI, bank transfer, Wise, PayPal, Stripe, or other.
- Payment currency and received currency.
- INR equivalent.
- Partial payments.
- Payment proof.
- Receipts.
- Payment timeline.

### 5. Client Portal 2.0

Client-facing workspace:

- Proposals.
- Contracts.
- Invoices and receipts.
- Files.
- Project updates.
- Payment status.
- Brand color and logo.

### 6. Ivo Everywhere

Contextual Ivo actions:

- Draft proposal.
- Improve scope.
- Fill contract placeholders.
- Create export invoice.
- Draft payment reminder.
- Summarize client.
- Explain Pulse trend.
- Suggest next action on pipeline card.

### 7. Automation Lite

Approval-first recipes:

- Proposal sent with no response -> draft follow-up.
- Invoice due soon -> draft reminder.
- Invoice overdue -> draft reminder.
- Proposal accepted -> suggest project/contract/invoice.
- Contract signed -> suggest invoice/project.
- Payment marked paid -> receipt and thank-you.

### 8. Business Pulse Pro

Premium insights:

- Domestic vs international revenue.
- Revenue by country and currency.
- Proposal win rate.
- Lead-to-paid cycle time.
- Repeat client rate.
- Client concentration.
- Payment delay trends.
- Cash forecast.
- Unbilled work value.
- Export invoice summary.

## Phased Build Plan

### Phase 1: Clientflow Foundation

Goal: align the existing project lifecycle with the future pipeline/proposal flow.

Build:

- Expand project statuses for proposal, contract, invoiced, and paid stages.
- Keep statuses typed in one source of truth.
- Add a database migration for the expanded status constraint.
- Prepare setup notes for applying the migration.

Done when:

- Project status types, schemas, and UI status registry are aligned.
- Existing project screens still compile.

### Phase 2: Pipeline Page

Goal: make Stackivo feel like a clientflow product.

Build:

- New Pipeline navigation item.
- Board grouped by lifecycle stages.
- Cards show client, project, value, due date, and next action.
- Quick status change.
- Ivo prompt per stage.

### Phase 3: Proposal Schema And List

Goal: introduce proposals as a first-class document.

Build:

- Proposal tables and RLS.
- Proposal list page.
- Draft/create/edit/delete basics.
- Proposal status: draft, sent, viewed, accepted, declined, expired, converted.

### Phase 4: Proposal Builder

Goal: create professional proposals.

Build:

- Builder UI.
- Line items/packages.
- Scope, deliverables, timeline, terms.
- Currency-aware totals.
- Preview.
- Public link.

### Phase 5: Proposal Conversion

Goal: connect proposals to the rest of the product.

Build:

- Convert proposal to project.
- Convert proposal to contract.
- Convert proposal to invoice.
- Carry client, currency, amounts, timeline, and scope.

### Phase 6: India + Global Intelligence Polish

Goal: make domestic/export behavior trustworthy.

Build:

- Global client defaults.
- Export invoice checklist.
- GSTIN/state behaviors.
- Currency and FX defaults.
- Domestic vs international document language.

### Phase 7: Payment Tracking Upgrade

Goal: track how money is actually received.

Build:

- Payment method and proof.
- Partial payments.
- Received currency and INR equivalent.
- Receipt improvements.
- Invoice payment timeline.

### Phase 8: Ivo Contextual Actions

Goal: put Ivo inside workflows.

Build:

- Contextual Ivo entry points across client, project, proposal, contract, invoice, portal, and Pulse.
- Prompt templates with page context.
- Safer action handoff for document creation.

### Phase 9: Automation Lite

Goal: reduce repetitive admin with approval-first recipes.

Build:

- Recipe table/config.
- Reminder drafts.
- Follow-up suggestions.
- Event-triggered suggestions.
- User approval before sending/creating.

### Phase 10: Client Portal 2.0

Goal: make the client-facing experience premium.

Build:

- Portal timeline.
- Proposal tab.
- Project updates.
- Better document grouping.
- Brand polish.

### Phase 11: Lead Forms

Goal: capture new work.

Build:

- Form builder.
- Public lead form link.
- Lead creation.
- Pipeline entry.
- Ivo drafted response.

### Phase 12: Business Pulse Pro

Goal: make Pulse a premium intelligence layer.

Build:

- Proposal metrics.
- Global revenue insights.
- Cash forecast.
- Country/currency mix.
- Client concentration and payment risk.

### Phase 13: Templates

Goal: speed up onboarding and document creation.

Build:

- Proposal templates.
- Contract templates.
- Email templates.
- Export/domestic invoice notes.

### Phase 14: Integrations

Goal: connect the freelancer toolchain.

Priority:

- Google Calendar.
- Google Drive.
- Gmail/email sending.
- Wise/PayPal manual payment instructions.
- Zoho Books or QuickBooks later.
- WhatsApp/SMS reminders later.

## Phase Setup File Rule

After completing code for each phase, create a setup file named:

`PHASE-XX-{phase-name}-SETUP.md`

Each setup file should include:

- What changed.
- Database migrations to apply.
- Environment variables to add.
- Third-party accounts to create.
- Dashboard/configuration steps.
- Manual QA checklist.
- Rollback notes where relevant.

