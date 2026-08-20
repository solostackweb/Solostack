# Stackivo Design System — Master

Source of truth for visual decisions. Every UI change should be justifiable
against this file; where it and a component disagree, the component is wrong.

**Direction:** refined professional. The existing blue identity stays. What
changes is craft — a real typeface, a wider type scale, one spacing rhythm,
three radii instead of seven, and semantic colour everywhere. Stackivo holds
people's invoices and contracts; it should read like a tool you'd trust with
money, not a dashboard template.

---

## 0. Why this exists (measured, not opinion)

Audit of `src/` at the time of writing:

| Finding | Count | Consequence |
|---|---|---|
| Text below 12px (`text-[11px]` 545, `text-[10px]` 216, `text-[9px]` 13) | **761** | Reads cramped; below any accessibility floor |
| Raw palette classes bypassing tokens (`text-emerald-600`, `bg-amber-500`, …) | **1,201** | Tokens don't control the UI; dark mode unreliable |
| Files hardcoding hex (incl. brand blue `#2563EB` ×20) | **34** | Two sources of truth for one colour |
| Distinct corner radii in live use | **7** | No rule for which means what |
| Web fonts loaded | **0** | Running on the bare system stack |

The second row is the important one: **a redesign driven by tokens cannot work
while 1,201 places ignore them.** Fix adherence first, then restyle.

---

## 1. Typography

### Family

| Token | Value | Use |
|---|---|---|
| `--font-sans` | **Inter** (variable, `next/font/google`) | All UI text |
| `--font-display` | Inter, `letter-spacing: -0.02em`, weight 600–700 | h1–h3, page titles, marketing headlines |
| `--font-mono` | existing system mono stack | IDs, tokens, code, API keys |

Inter is chosen for one specific reason beyond looks: it ships true **tabular
figures**. An invoicing product aligns numbers in columns constantly, and
proportional digits make totals jitter as they change.

Load with `next/font` and `display: "swap"`. Never add a second display face —
one family, varied by weight and tracking, is what makes a system feel coherent.

### Scale

Eleven steps. Nothing outside this list; no arbitrary `text-[Npx]`.

The three display steps exist because a marketing hero genuinely needs to be
larger than anything in the app — capping the scale at 48px made the homepage
headline *smaller* than it was.

| Token | Size / line-height | Use |
|---|---|---|
| `text-micro` | 12 / 16, `tracking-wide`, uppercase | Eyebrows, table headers, badge text |
| `text-xs` | 12 / 18 | Dense metadata, timestamps |
| `text-sm` | 14 / 20 | **Default UI text.** Labels, table cells, secondary copy |
| `text-base` | 16 / 24 | **Default body.** Paragraphs, form inputs, anything read in sequence |
| `text-lg` | 18 / 28 | Card titles, section leads |
| `text-xl` | 20 / 28 | Sub-headings |
| `text-2xl` | 24 / 32 | Page titles (dashboard) |
| `text-3xl` | 30 / 36 | Section headings (marketing) |
| `text-4xl` | 36 / 1.1, `tracking-tight` | Marketing section headings, hero on mobile |
| `text-5xl` | 48 / 1.05, `tracking-tight` | Hero at tablet |
| `text-6xl` | 60 / 1.02, `tracking-tight` | Hero at desktop |

**Hard floor: 12px.** Nothing smaller ships. The 761 existing violations map
to `text-micro` (labels/badges) or `text-xs` (metadata) — see §8.

**Form inputs are 16px on mobile.** Below that, iOS auto-zooms on focus.

### Weight

400 body · 500 labels and table headers · 600 headings and buttons · 700 hero
only. Weight carries hierarchy before size does; reach for it first.

---

## 2. Colour

### The rule

**Components never name a colour.** No hex, no `emerald-600`, no `slate-500`.
They name a *role*. This is what makes both dark mode and any future redesign
a token change rather than a 1,201-file edit.

### Semantic tokens

Existing tokens stay: `background` `foreground` `card` `popover` `primary`
`secondary` `muted` `accent` `destructive` `border` `input` `ring` `sidebar`.

Status colours already exist as `success` `warning` `info` but only as solid
fills. Most real usage is *tinted text on a tinted background* (a status pill),
which is why components reached for `text-emerald-700 bg-emerald-500/10`
instead. Add the missing halves so they don't have to:

```
--success-subtle / --success-strong      (bg tint / text + icon)
--warning-subtle / --warning-strong
--info-subtle    / --info-strong
--destructive-subtle / --destructive-strong
```

Every status surface uses `bg-*-subtle text-*-strong`. One pattern, both themes.

### Brand

`--primary: 221 83% 53%` is the blue. `#2563EB` is the same colour written by
hand in 34 files — those become `primary`. Third-party brand colours
(WhatsApp green, payment logos) are the **only** permitted literals, and they
belong in a single `brand-colors.ts`, never inline.

### Contrast floor

Body text ≥ 4.5:1. Large text and UI glyphs ≥ 3:1. Verify light and dark
**separately** — a pair that passes on white often fails on the dark surface.

Status must never be carried by colour alone: pair with an icon or a word.

---

## 3. Spacing

4px base. Permitted steps: **4 8 12 16 20 24 32 40 48 64 80**. No arbitrary
padding values.

| Context | Gap |
|---|---|
| Inside a control (icon → label) | 8 |
| Between fields in a form | 16 |
| Between cards in a grid | 16 (dense) / 24 (default) |
| Card padding | 20 (dense) / 24 (default) |
| Between sections on a page | 32 dashboard |

Marketing breathes; the dashboard is denser. That difference is intentional and
should be consistent within each context.

**Marketing vertical rhythm belongs to one component.** `components/marketing/
section.tsx` owns it — `py-12 sm:py-14 lg:py-16` — and 31 of 40 marketing
sections already route through it. Do not hand-roll section padding; use
`<Section>` and the rhythm follows.

The nine surfaces that use a raw `<section>` are deliberate structural
exceptions, not drift: heroes (`hero`, `page-hero`, `hero-section`), the trust
strip, the two CTA bands, and content lists in docs/changelog. Each has a
genuine reason to differ — a hero that breathed like a body section would look
broken. Leave them.

Container max-width stays `1440px` with `1rem` gutters, widening to `1.5rem`
from `md` up.

---

## 4. Radius

Seven radii become four. Each step is visually distinct; the discarded ones
(`md` 8px, `xl` 12px) were indistinguishable from `lg` and existed only as
inconsistency.

| Token | Value | Applies to |
|---|---|---|
| `rounded-sm` | 6px | Inputs, badges, small controls |
| `rounded-lg` | 10px (`--radius`) | **Default.** Buttons, cards, dialogs, panels |
| `rounded-2xl` | 16px | Large marketing surfaces, hero cards |
| `rounded-full` | pill | Avatars, status pills, icon buttons |

`lg` is the default rather than `md` because that is the shadcn/ui convention
already in use here — `rounded-lg` maps to `var(--radius)`, and every shadcn
component added later will assume it. Fighting that would mean re-patching
every primitive we pull in.

Collapse `md` → `lg`, `xl` → `lg`, `3xl` → `2xl`. Nested corners: the inner
radius is the outer minus the padding, never larger than the parent's.

---

## 5. Elevation

Three levels, each tied to meaning rather than taste. A card that isn't
interactive gets a border, not a shadow.

| Level | Use |
|---|---|
| `border` only | Static cards, table containers, list rows |
| `shadow-sm` | Raised/interactive cards, dropdown triggers |
| `shadow-md` | Popovers, dropdowns, sheets |
| `shadow-lg` + scrim | Dialogs and modals only |

Modal scrim: 40–60% black. Anything lighter leaves the background competing.

---

## 6. Motion

| Property | Value |
|---|---|
| Micro-interaction | 150ms |
| State transition | 200ms |
| Enter / overlay | 250ms |
| Exit | ~70% of enter (faster out than in) |
| Easing | `ease-out` entering · `ease-in` exiting · never `linear` |

Animate **transform and opacity only**. Animating width, height, top or left
causes layout thrashing and CLS.

Motion must express cause and effect — a panel slides *from* the control that
opened it. Decorative movement is noise. One or two animated elements per view.

List entrances stagger 30–50ms per item, capped at ~6 items.

`prefers-reduced-motion` must be honoured globally, not per component.

---

## 7. Component rules

**Buttons.** One primary action per screen; everything else is secondary or
ghost. Heights: 36 (sm) / 40 (default) / 44 (touch contexts). Disabled = 50%
opacity plus a real `disabled` attribute — never a visual-only lookalike.
Async buttons show a spinner and go non-interactive.

**Forms.** Visible label above every input — placeholders are not labels.
Helper text sits below and persists. Errors appear beneath the field, in words
that state cause *and* fix ("Enter a GSTIN like 27AAPFU0939F1ZV", not
"Invalid"). Validate on blur, not per keystroke. Focus the first invalid field
on submit.

**Tables.** Right-align and tabular-figure every numeric column. Sticky header
past ~10 rows. Row actions stay visible on touch — hover-reveal is desktop-only
polish, never the only route.

**Empty states.** Explain what goes here and give the action that creates the
first one. Never an empty box.

**Loading.** Skeletons that match final layout, not spinners, for anything over
300ms. Reserve the space so nothing jumps.

**Icons.** Lucide only, 1.5px stroke, sized 16 / 20 / 24. Never emoji. Icon-only
buttons require `aria-label`.

---

## 8. Migrating existing drift

Mechanical and verifiable — do this before restyling anything.

1. **Sub-12px text (761).** `text-[9px]`, `text-[10px]`, `text-[11px]` →
   `text-micro` where it's a label/badge/eyebrow, `text-xs` where it's
   metadata. Any remaining `text-[Npx]` → nearest scale step.
2. **Raw palette (1,201).** `emerald` → success · `amber` → warning ·
   `red` → destructive · `blue`/`sky` → info · `slate`/`gray` → `foreground` /
   `muted-foreground` / `border` by role. Status pills become
   `bg-*-subtle text-*-strong`.
3. **Hex (34 files).** `#2563EB` and variants → `primary`. Third-party brand
   values move to `brand-colors.ts`.
4. **Radius.** `lg` / `xl` / `2xl` / `3xl` → `md`, except deliberate pills.

Each step is independently shippable and independently reviewable. Do not
batch them.

---

## 9. Keeping it

A standard without enforcement decays back to 1,201 exceptions.

- `scripts/verify-design-tokens.mjs` fails CI on new raw-palette classes,
  hex literals in components, or `text-[Npx]` outside the scale.
- Allowed exceptions live in one explicit list in that script, with a reason.
- New components are reviewed against §7 before merge.

---

## 10. Accessibility floor

Non-negotiable, checked before any UI ships:

- Contrast 4.5:1 body / 3:1 large, verified in **both** themes
- Visible focus rings — never `outline: none` without a replacement
- Tab order matches visual order
- Interactive targets ≥ 44px in touch contexts
- `aria-label` on every icon-only control
- Status never conveyed by colour alone
- Sequential headings, no skipped levels
- `prefers-reduced-motion` respected
