# Stackivo — Landing / Marketing Redesign Context

Context only (no plans, no procedures). Read this instead of scanning the repo.

## What Stackivo is
An all-in-one workspace for **Indian freelancers, consultants, and small
studios**: clients (CRM), invoices (simple or full GST), contracts with
e-signature, welcome/onboarding docs, projects, time tracking, a client portal,
payments via Razorpay, a Pulse analytics dashboard, and an in-app AI assistant.
Free plan covers the first 5 clients. Paid plans: Pro ₹499/mo, Business
₹1,499/mo (annual ≈ 2 months free).

## Stack
- Next.js `16.2.4` (App Router, RSC), React `19`, TypeScript `5.7`.
- Tailwind CSS `3.4` (config: `tailwind.config.ts`). Design tokens are HSL CSS
  variables in `src/app/globals.css`.
- `framer-motion` `12` available. Icons: `lucide-react`. Toasts: `sonner`.
- shadcn-style UI primitives in `src/components/ui/*` (Button, Sheet, Dialog,
  DropdownMenu, Card, Input, Textarea, etc.).
- Supabase backend. Hosted on Vercel.

## Fonts (already wired in `src/app/layout.tsx` + `tailwind.config.ts`)
- Body: **Inter** → `font-sans` (var `--font-sans`).
- Display/headings: **Space Grotesk** → `font-display` (var `--font-display`).
- Mono: JetBrains Mono → `font-mono` (var `--font-mono`).

## Color tokens (HSL, in `globals.css`; use via Tailwind `bg-primary`, `text-muted-foreground`, `primary/10`, etc.)
Light: `--background 0 0% 100%`, `--foreground 222 47% 11%`,
`--primary 221 83% 53%` (brand blue), `--muted-foreground 240 10% 46%`,
`--border 240 18% 90%`, `--card 0 0% 100%`, `--success 142 72% 36%`,
`--destructive 0 84% 60%`, `--warning 38 92% 50%`.
Dark: `--background 222 12% 9%`, `--foreground 215 20% 95%`,
`--primary 217 91% 64%`. Full dark set in `globals.css`.
- Primary is a **single blue color** (no numeric shades like `primary-500`; use
  opacity form `primary/10`, `primary/80`).
- Brand decision: **blue only — no violet/purple/pink/indigo** anywhere.
- Helper classes in `globals.css`: `.btn-gradient` (blue gradient CTA),
  `.text-gradient` (blue gradient text), `.glow-ring`, `.card-lift`,
  `.animate-page-enter` (Tailwind animation in config).

## Marketing file map
Routes — `src/app/(marketing)/`:
- `page.tsx` (home), `layout.tsx`, `pricing/page.tsx`, `about/`, `blog/`,
  `blog/[slug]/`, `changelog/`, `contact/`, `demo/`, `docs/`, `security/`,
  `talk/`, `privacy/`, `terms/`, `tools/` (+ 3 calculator subpages).
- Auth/checkout live outside marketing: `src/app/(auth)/login|signup|...`,
  billing/checkout under `src/app/(dashboard)/dashboard/settings/billing/`
  and `src/features/billing/`.

Components — `src/components/marketing/`:
`marketing-header.tsx`, `marketing-footer.tsx`, `hero-section.tsx`,
`section.tsx` (exports `Section`, `SectionHeading`, `SectionEyebrow` — shared
layout + heading primitives used across sections), `features-section.tsx`,
`workflow-section.tsx`, `gst-section.tsx`, `pulse-section.tsx`,
`pain-section.tsx`, `faq-section.tsx`, `cta-band.tsx`, `founder-note.tsx`,
`testimonials-section.tsx`, `competitor-comparison.tsx`, `pricing-cards.tsx`,
`pricing-comparison.tsx`, `dashboard-mockup.tsx`, `invoice-mockup.tsx`,
`guarantee-strip.tsx`, `newsletter-form.tsx`, `exit-intent-modal.tsx`,
`sticky-mobile-cta.tsx`, `global-cta-tracker.tsx`, `track-cta.tsx`,
`prose-page.tsx`, `motion.tsx`.

Home (`page.tsx`) currently renders in order: Hero, Pain, Features, Workflow,
GST, Pulse, FounderNote, FAQ, CtaBand.

## Supporting modules the marketing pages use
- `src/features/marketing/auth-state.ts` → `getMarketingAuthState()` returns
  `MarketingAuthState` ({ isAuthenticated, showUpgradeNudge }); types in
  `src/features/marketing/types.ts`. Header/Hero CTAs branch on it.
- `src/config/site.ts` → `siteConfig` (name, url, description).
- `src/components/brand/stackivo-logo.tsx` → `StackivoLogo`, `StackivoMark`.
- Plan data: `src/features/subscription/plans.ts` (PLANS catalogue: features,
  limits, prices in paise). Pricing UI reads from here.
- CTAs carry `data-cta="..."` attributes (analytics) — preserve them.

## Conventions
- Server Components by default; add `"use client"` only when needed (hooks,
  event handlers). Header is a client component (scroll/menu state).
- Import alias `@/` → `src/`.
- Tailwind utility classes only; no CSS modules. Reuse `ui/*` primitives.
- Dark mode is class-based (`.dark`) — every color must use tokens, not raw hex.

## Environment gotcha (important)
The repo lives on a **OneDrive-synced folder**. Rapid file writes through it can
**truncate files mid-write** or append **null bytes** (`\0`), causing
`Unexpected character '\0'` or `Unterminated string constant` build errors.
If that happens: rewrite the whole file (a plain shell heredoc/redirect is most
reliable), then verify the file ends correctly and has zero null bytes
(`tr -cd '\000' < file | wc -c` → 0).

## Build / verify
- Type-check: `npx tsc --noEmit`. Dev: `npm run dev`. Build: `npm run build`.
- Repo is pushed manually by the owner; commits/pushes are done from their
  machine, not from tooling.
