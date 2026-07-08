# Stackivo

A premium business operating system for freelancers: clients, invoices, contracts, projects, files, payments, Ivo AI workflows, client portals, support, admin operations, and analytics in one workspace.

> **Status:** Release-candidate application. The app includes Supabase-backed auth/data, invoice and contract workflows, public document links, client portal, support, billing/payment integrations, admin console, observability hooks, and the Ivo AI assistant.

## Tech Stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS 3.4, CSS variables, shadcn/Radix primitives
- **Backend:** Supabase Postgres, RLS, storage, Next.js route handlers, server actions
- **Payments:** Razorpay platform payments and manual payment flows
- **AI:** Groq-backed Ivo workflows with local rule-based fallbacks
- **Observability:** Sentry, PostHog, security/admin audit helpers
- **Checks:** TypeScript, ESLint, client env audit, admin action audit

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Key routes:

- `/` - marketing site
- `/login`, `/signup` - auth
- `/dashboard` - main workspace
- `/dashboard/{clients,projects,invoices,contracts,portal,time,pulse,welcome,settings}`
- `/i/[token]`, `/c/[token]`, `/w/[token]` - public invoice, contract, and welcome document links
- `/portal`, `/portal/[id]` - client portal
- `/admin` - founder/admin console

## Scripts

```bash
npm run dev                   # local dev server
npm run build                 # production build
npm run start                 # production server
npm run type-check            # TypeScript
npm run lint                  # ESLint
npm run security:client-env   # verify no server secrets are exposed client-side
npm run verify:admin-actions  # verify admin exports use audited wrappers
```

## Release Checks

Before production deploy:

```bash
npm run type-check
npm run lint
npm run security:client-env
npm run verify:admin-actions
npm run build
```

Then manually verify:

- Signup, onboarding, and subscription gates
- Domestic GST invoice: same-state CGST/SGST and different-state IGST
- International export invoice, PDF, public page, email, and receipt
- Razorpay test payment, failed payment, duplicate callback, webhook replay
- Contract send/sign/download flow and signed PDF snapshot
- Client portal invite, file upload/download, comments, and updates
- Ivo create/draft/send workflows, support answers, Pulse summary, and quota tracking
- Admin access, audit log, support queue, cron routes, Sentry, PostHog, and email worker

## Project Structure

```text
src/
  app/        Next.js App Router routes and route groups
  components/ Shared UI, layout, loading, admin, and marketing components
  features/   Feature modules: invoices, contracts, AI workflows, portal, support, etc.
  lib/        Cross-app helpers, formatting, security, Supabase, analytics
  config/     Environment and app configuration
supabase/
  migrations/ Database schema, RLS, storage, and operational migrations
infra/
  cloudflare-email-worker/ Inbound support email worker
```
