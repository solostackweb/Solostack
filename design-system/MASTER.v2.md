# Stackivo Design System — Master (v2, archived)

> Archived on 20 August 2026. This warm Ledger / dark Workbench direction was
> rejected because it retired Stackivo's blue identity and diverged from the
> approved Calm Command direction. It is historical context, not an active
> source of truth. See `MASTER.md` and `/DESIGN.md` for current decisions.

Source of truth for visual decisions. Every UI change should be justifiable
against this file; where it and a component disagree, the component is wrong.

**Direction:** two atmospheres, one system.

*Ledger* on marketing — warm paper, a serif that carries authority, hairline
rules instead of cards, and numbers set like a financial document. You are
asking freelancers to run their money through Stackivo; the way in should feel
considered.

*Workbench* in the app — near-black, a visible 1px structure, zero decorative
blur, mono tabular figures. Once someone is inside, they are operating an
instrument and want precision, not warmth.

This is not inconsistency. The two surfaces do different jobs. What binds them
is a single type system, a single spacing scale, a single set of colour *roles*,
and one brand accent expressed at two brightnesses.

v1 is preserved at `MASTER.v1.md`. Its adherence programme worked and its
numbers are quoted below; what changes here is the visual language, not the
discipline.

---

## 0. Where we start (measured, August 2026)

v1 set out to fix token adherence before restyling. That worked:

| Finding | v1 baseline | Now |
|---|---|---|
| Text below 12px | 761 | **0** |
| Raw palette classes bypassing tokens | 1,201 | **196** |
| Files hardcoding hex | 34 | **27** |
| Distinct radii in live use | 7 | **4** (+10 `rounded-none`) |
| Web fonts loaded | 0 | Inter Variable, self-hosted |

The remaining 196 and 27 are the migration backlog in §9. They matter more now
than they did in v1: a two-palette architecture **cannot work** while any
component names a colour directly. A hardcoded `#2563EB` does not know which
surface it is on.

---

## 1. Architecture: one token set, two surfaces

Semantic token **names** never change. Their **values** are scoped.

```
:root                      → app surface, light   (Workbench light)
.dark                      → app surface, dark    (Workbench dark)
[data-surface="marketing"] → marketing surface    (Ledger, light only)
```

`[data-surface="marketing"]` goes on the `(marketing)` route group layout and
redefines the same custom properties. Every component keeps writing `bg-card`,
`text-foreground`, `border-border` and lands correctly on either surface
without knowing which one it is on.

**Marketing is light-only.** Ledger has no honest dark twin — warm paper
inverted is just brown. The marketing layout sets `forcedTheme="light"`. The
theme toggle stays, and lives in the app where it belongs.

**The app is dark-first with a real light mode.** Not an inversion; designed.

Consequences to respect:

- No component branches on theme in JS. If it needs to know, a token is missing.
- Anything shared (`components/ui/*`) is written against roles only and must be
  checked on all three surfaces.
- Marketing-only components live in `components/marketing/`, app-only in
  `components/dashboard/`. Shared primitives stay neutral.

---

## 2. Colour

### The rule

**Components never name a colour.** No hex, no `emerald-600`, no `slate-500`.
They name a role. This is what makes a two-surface system a token change rather
than a 196-file edit.

### Brand: one ember, two brightnesses

The accent is a warm ember. On paper it is a deep oxblood that passes as body
text (8.4:1 on the marketing background). On near-black it brightens to stay
legible. Same hue family, so the brand reads as one thing across both surfaces.

| Surface | HSL | Hex | Use |
|---|---|---|---|
| Marketing | `13 61% 30%` | `#7A2E1E` | Eyebrows, rules, emphasis, primary fill |
| App dark | `13 79% 57%` | `#E8623C` | Primary actions, focus, active nav |
| App light | `13 68% 42%` | `#B4441F` | Same, contrast-corrected for white |

The `#2563EB` brand blue is retired. All 27 files hardcoding it become
`primary`. Third-party brand colours (WhatsApp green, Razorpay, payment logos)
are the **only** permitted literals and live in `brand-colors.ts`.

### Marketing surface — Ledger

| Role | HSL | Hex |
|---|---|---|
| `background` | `40 38% 94%` | `#F6F2EA` paper |
| `card` | `0 0% 100%` | `#FFFFFF` |
| `muted` | `40 33% 89%` | `#EDE7DB` raised paper |
| `border` / `input` | `41 21% 80%` | `#D6CFC0` rule |
| `foreground` | `60 14% 7%` | `#14140F` ink |
| `muted-foreground` | `43 8% 33%` | `#5A564C` |
| `primary` | `13 61% 30%` | `#7A2E1E` |
| `primary-foreground` | `40 38% 94%` | paper |
| `accent` | `19 37% 90%` | `#EFE2DC` |
| `ring` | `13 61% 30%` | ember |

### App surface — Workbench dark

| Role | HSL | Hex |
|---|---|---|
| `background` | `210 11% 4%` | `#08090A` canvas |
| `card` | `200 10% 6%` | `#0E1011` surface |
| `popover` | `200 9% 9%` | one step above card |
| `border` / `input` | `200 9% 13%` | `#1E2224` hairline |
| `foreground` | `150 8% 95%` | `#F2F4F3` |
| `muted-foreground` | `200 5% 56%` | `#8A9296` |
| `primary` | `13 79% 57%` | `#E8623C` |
| `sidebar` | `200 10% 3%` | deepest |

The elevation ladder is now **four steps, not five**, each a lightness change of
2–4% only. Workbench separates regions with hairlines, not contrast between fills.

### Status

Every status surface is a tinted background with a strong foreground. Both
halves defined per surface, no exceptions:

```
--success-subtle / --success-strong
--warning-subtle / --warning-strong
--info-subtle    / --info-strong
--destructive-subtle / --destructive-strong
```

`bg-*-subtle text-*-strong`. One pattern, three surfaces.

### Contrast floor

Body ≥ 4.5:1, large text and UI glyphs ≥ 3:1. Verify **each of the three
surfaces separately.** A pair that passes on paper routinely fails on canvas.

Ember at `#E8623C` does **not** pass 4.5:1 as small text on light backgrounds.
On the app light surface use `#B4441F`. Bright ember is a fill with dark text on
top, never small text on a pale background.

---

## 3. Typography

### Families

| Token | Value | Where |
|---|---|---|
| `--font-sans` | **Inter Variable** | All body and UI text, both surfaces |
| `--font-display` | **Instrument Serif** 400 | Marketing headings only |
| `--font-display` | **Inter** 700 at `-0.04em` | App headings (same token, per surface) |
| `--font-mono` | **IBM Plex Mono** 400/500 | Figures, IDs, eyebrows, timestamps, code |

All self-hosted via `@fontsource`. Never `next/font/google` — the build must not
depend on reaching Google.

```
@fontsource-variable/inter      (installed)
@fontsource/instrument-serif    ^5.3.0   400 + 400 italic
@fontsource/ibm-plex-mono       ^5.3.0   400 + 500 only
```

Instrument Serif ships one weight. That is correct for a display face and
enforces the rule below.

**Instrument Serif is display-only.** It falls apart below 24px. It never sets
body text, never sets UI labels, and never appears in the app.

**Mono is not decoration.** Stackivo aligns money in columns constantly. Every
figure in a table, every total, every ID uses `font-mono` with `tabular-nums`.
Inter's tabular figures remain the fallback for numbers inside running prose.

### Scale

Eleven steps. Nothing outside this list; no arbitrary `text-[Npx]`.

| Token | Size / line-height | Use |
|---|---|---|
| `text-micro` | 12 / 16, uppercase | Eyebrows, table headers, badges |
| `text-xs` | 12 / 18 | Dense metadata, timestamps |
| `text-sm` | 14 / 20 | **Default UI text** |
| `text-base` | 16 / 24 | **Default body**, form inputs |
| `text-lg` | 18 / 28 | Card titles, section leads |
| `text-xl` | 20 / 28 | Sub-headings |
| `text-2xl` | 24 / 32 | Page titles (app) |
| `text-3xl` | 30 / 36 | Section headings |
| `text-4xl` | 36 / 1.08 | Marketing section headings |
| `text-5xl` | 48 / 1.04 | Hero at tablet |
| `text-6xl` | 60 / 1.02 | Hero at desktop |

**Hard floor: 12px.** **Form inputs are 16px on mobile** or iOS zooms on focus.

### Tracking

The setting that most often makes a headline look amateur. Not optional.

| Context | Tracking |
|---|---|
| Instrument Serif display (marketing) | `-0.015em` |
| Inter display (app, 700) | `-0.04em` |
| `text-2xl`–`text-3xl` headings | `-0.02em` |
| Body | `0` |
| `text-micro` uppercase labels | `+0.13em` |
| Mono uppercase eyebrows | `+0.16em` |

### Weight

400 body · 500 labels and mono · 600 app headings and buttons · 700 app display.
Marketing display is 400 — the serif carries authority through form, not weight.

Reach for weight before size when building hierarchy.

---

## 4. Spacing

One 4px scale: **4 8 12 16 20 24 32 40 48 64 80**. No arbitrary padding.

App sections use 32. Marketing never hand-rolls vertical padding — wrap in
`<Section>` (`components/marketing/section.tsx`), which owns the rhythm.

Marketing rhythm increases in v2. Ledger needs air:

```
py-16 sm:py-20 lg:py-28
```

Body measure is `max-w-[65ch]` — a character measure, not a pixel width, so it
tracks the font size.

---

## 5. Radius

Four values, each with a meaning. Never `md`, `xl`, or `3xl`.

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 6px | Inputs, badges |
| `rounded-lg` | 10px | **Default.** Buttons, cards, dialogs (`--radius`) |
| `rounded-2xl` | 16px | Large marketing surfaces |
| `rounded-full` | — | Pills, avatars |

**Ledger exception.** Marketing document surfaces — the invoice, the contract,
anything representing paper — use `rounded-none`. Paper does not have rounded
corners, and the sharpness is the point.

---

## 6. Elevation

**Blur is retired as a depth mechanism on both surfaces.** It is the most
recognisable AI-site tell, and it was doing most of the depth work in v1.

| Surface | Depth comes from |
|---|---|
| Marketing | A flat offset block in `muted` behind a `card`. Hairline rules. Nothing else. |
| App | Hairline borders, 1px grid gaps (`gap-px bg-border`), z-index. Zero drop shadow. |

Permitted: `shadow-sm` on a genuinely floating overlay — dialog, popover,
dropdown. That is the only shadow in the system.

Deleted from v1: `GradientMesh`, `GlowSpotlight`, and every decorative
`blur-[Npx]` wash. Grep for `blur-` before shipping.

---

## 7. Motion

| Property | Value |
|---|---|
| Micro-interaction | 150ms |
| State transition | 200ms |
| Enter / overlay | 250ms |
| **Scroll reveal (marketing only)** | **400ms** |
| Exit | ~70% of enter |
| Easing | `ease-out` entering · `ease-in` exiting · never `linear` |

v1 specified 250ms enters, but `marketing/motion.tsx` shipped 550–800ms. Rather
than pretend, v2 names a scroll-reveal case and caps it at 400ms. Above that
reads as sluggish, not elegant.

Stagger **30–50ms** per item, capped at six. v1 shipped 80ms uncapped; fix it.

Animate **transform and opacity only**. Never width, height, top or left.

Motion expresses cause and effect. One or two animated elements per view. No
infinite decorative loops — the hero `Floating` component is deleted.

`prefers-reduced-motion` is honoured in **two** places and needs both: the CSS
block in `globals.css` for CSS-driven animation, and `MotionProvider`
(`components/providers/motion-provider.tsx`) for Motion, which writes inline
transforms from JS that CSS overrides cannot reach.

---

## 8. Composition

New in v2, and the part that actually decides whether the site looks designed.
Tokens stop a page being wrong; composition stops it being anonymous.

### Section rhythm

**Seven or eight sections on the homepage. Not eleven.** Each gets real room.

The failure mode v1 shipped: eleven consecutive sections of centred eyebrow pill
→ centred heading → subtitle → card grid. Correct, and completely anonymous.

- Default to **left-aligned** on marketing. Centre is the exception, twice at most.
- At least two sections break the container — full-bleed band or edge-to-edge rule.
- At least one section is a single sentence with nothing else in it.
- Never two card grids in a row.
- Asymmetric columns (`1.08fr .92fr`), not `1fr 1fr`.

### The signature

Ledger's signature is **the hairline rule and the offset paper block**. They
appear on every marketing page. A visitor should be able to identify a Stackivo
page from a 200px crop.

Workbench's signature is **the 1px grid**: `gap-px bg-border` grids, hairline
dividers, mono tabular figures right-aligned.

### Product visuals

Show real product output — a typeset invoice, a GST treatment table, a data
readout. Artifacts Stackivo genuinely produces. Never floating fragments, never
decorative check-mark cards.

Numbers in any mockup are **specific and unrounded**. `₹1,24,847` is credible;
`₹1,25,000` is a placeholder wearing a costume.

### Copy

Every claim is concrete or it is cut. "Powerful features built for scale" is
deleted on sight. Name the state, the tax treatment, the actual number of days.

No invented social proof. Until there are real named customers with real
numbers, the proof slot is a founder note in first person.

---

## 9. Migrating the drift

Ordered. Do not restyle ahead of step 2.

1. **Retire the blue.** 27 files hardcoding `#2563EB` → `primary`.
2. **Clear the 196.** Raw palette classes → semantic roles. Drive both counts to
   zero. The two-surface architecture is inert until this is done.
3. **Install the surface scope.** `[data-surface="marketing"]` in `globals.css`;
   `data-surface` + `forcedTheme` on the marketing layout.
4. **Fonts.** Add the two `@fontsource` packages, wire `--font-display` and
   `--font-mono` per surface.
5. **Strip the blur.** Delete `GradientMesh`, `GlowSpotlight`, `Floating`, and
   every decorative `blur-` wash.
6. **Rebuild marketing sections**, homepage first, one at a time.
7. **Move the app to Workbench** — hairlines, four-step elevation, mono figures.
8. **Re-audit** and record the numbers in §0.

---

## 10. Accessibility floor

Nothing ships without these, verified on **each surface separately**.

- Contrast 4.5:1 body · 3:1 large text and UI glyphs
- Visible focus rings, never removed; tab order matches visual order
- Touch targets ≥ 44px with ≥ 8px between them
- `aria-label` on every icon-only control
- Status never conveyed by colour alone — pair with an icon or a word
- Sequential heading hierarchy, no skipped levels
- `prefers-reduced-motion` honoured in both CSS and Motion
- No horizontal scroll at 320px
- Images carry explicit dimensions or `aspect-ratio`; CLS under 0.1

---

## 11. Keeping it

`npm run verify:design` fails the build on drift. Extend it as v2 lands:

- No hex outside `brand-colors.ts`
- No raw palette classes
- No `text-[Npx]`
- No radius outside the four
- No `blur-` outside the permitted overlay shadow
- No `framer-motion` import (it is `motion/react` now)
- Contrast pairs checked per surface

A design system that cannot show a falling drift count is not being enforced.
