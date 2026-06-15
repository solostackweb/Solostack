# Phase 3 — Implementation Plan (Premium Onboarding & Polish)

**Scope** (from `PORTAL_CONNECTIVITY_PLAN.md`, Phase 3): make the first impression and the
"feels expensive" polish. All ₹0, mobile-first, on the existing stack. Migrations/envs are
applied by the user later.

---

## Mainstream — built in this pass (zero-dependency, self-contained)

### WS1 — Onboarding checklist (client home)
A real, data-driven activation checklist that auto-hides when complete:
- Sign welcome guide (welcome docs needing acknowledgement)
- Review & sign contract (unsigned contracts)
- Settle first invoice (open invoices)
Each row links to the right place, shows a tick when done, and a progress count. Pure
computation from data already loaded — no new infra.

### WS2 — Branded welcome (video + message)
- Migration: `portals.welcome_video_url`, `portals.welcome_message`.
- Freelancer: an "Onboarding" settings card to paste a Loom/YouTube link + a welcome note.
- Client home: embeds the video (YouTube/Loom → iframe; otherwise a link) and shows the
  personal message. `buildVideoEmbed()` normalises the URL. Hugely personal, ₹0.

### WS3 — Save-the-contact (.vcf)
- `GET /api/portals/[portalId]/contact.vcf` generates a vCard from the freelancer's
  `user_profiles` (name, company, phone, email, website). A "Save contact" button on the
  client portal. Pure string generation.

### WS4 — Share & copy link
- A `SharePortalButton` using `navigator.share` with a clipboard fallback, for handing off
  the portal link. Zero dependency.

---

## Planned next (not in this pass)

- **Milestone timeline** — vertical, branded progress view from updates data.
- **Reactions on updates** — 👍/❤️ one-tap ack (needs a small table).
- **In-app logo upload** — `logo_url` exists on profiles; surface per-portal branding.
- **QR code** — needs a `qrcode` dependency (lazy-import pattern like web-push).
- **Localization (Hindi)** — i18n string layer.

---

## Build order (this pass)
1. Migration `0041` + `PortalRow` types + ViewProps wiring.
2. `updatePortalOnboardingAction` (owner-only).
3. `buildVideoEmbed` helper.
4. Client home: welcome block + onboarding checklist.
5. Freelancer: onboarding settings card.
6. `.vcf` route + Save-contact button.
7. Share button.

## Definition of done
- `tsc --noEmit` clean, 0 null bytes in touched files (post-edit scan).
- Mobile-first; every new surface verified at phone width.
- Welcome block + checklist hidden when empty/complete; `.vcf` downloads a valid card.
