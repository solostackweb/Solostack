---
name: stackivo-design
description: Stackivo's design system — the two-surface architecture (Ledger on marketing, Workbench in the app), tokens, type scale, spacing, radius, elevation, motion, colour semantics, composition rules and accessibility floor. Use whenever building or changing any UI in this repo: pages, components, layouts, styling, colours, typography, spacing, animation, dark mode, or reviewing UI code for consistency. Also use when adapting an outside component from 21st.dev, Tailwind UI or shadcn blocks.
---

# Stackivo Design System (v2)

The full standard lives in **`design-system/MASTER.md`** at the repo root.
Read it before writing UI code. It is the source of truth; where it and an
existing component disagree, the component is wrong and should be migrated.

v1 is archived at `design-system/MASTER.v1.md` for reference only. Do not
follow it — the brand blue, the blur-based elevation and the single-surface
palette it describes are all retired.

## Before writing any UI

1. Read `design-system/MASTER.md`.
2. Work out **which surface** you are on (see below). It changes the answer.
3. Check whether a primitive already exists in `src/components/ui/`.
4. Only then write markup.

## The two surfaces

One set of token names, two sets of values, scoped by CSS:

| Scope | Surface | Character |
|---|---|---|
| `[data-surface="marketing"]` | **Ledger** | Warm paper, Instrument Serif, hairline rules, light-only |
| `:root` / `.dark` | **Workbench** | Near-black, Inter tight, 1px grid, dark-first |

Components never branch on surface in JS. They name roles — `bg-card`,
`text-foreground`, `border-border` — and land correctly on either. If a
component needs to know which surface it is on, a token is missing.

Marketing is **light-only** (`forcedTheme="light"`). The theme toggle lives in
the app.

## The rules broken most often

**Never name a colour.** No hex, no `emerald-600`, no `slate-500`. Name the
role: `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`.
Status surfaces use `bg-{success|warning|info|destructive}-subtle` with
`text-*-strong`. Third-party brand colours are the only literals and live in
`brand-colors.ts`.

The brand is a **warm ember**, not blue. `#7A2E1E` on marketing, `#E8623C` on
app dark, `#B4441F` on app light — all as `primary`. The old `#2563EB` is
retired; 27 files still hardcode it and are part of the migration backlog.

**Never invent a font size.** No `text-[11px]`. Use the scale: `text-micro`
(12, uppercase labels), `text-xs` (12, metadata), `text-sm` (14, default UI),
`text-base` (16, body and form inputs), then `lg xl 2xl 3xl 4xl 5xl 6xl`.
Nothing below 12px. Form inputs are 16px on mobile or iOS zooms on focus.

**Set tracking explicitly.** Instrument Serif display `-0.015em` · Inter app
display `-0.04em` · headings `-0.02em` · body `0` · uppercase micro labels
`+0.13em` · mono eyebrows `+0.16em`. Default tracking on a 60px headline is the
single most common reason it looks amateur.

**Instrument Serif is display-only.** Marketing headings, nothing else. It
never sets body text, never sets UI labels, never appears in the app.

**Money is mono.** Every figure in a table, every total, every ID gets
`font-mono tabular-nums`. Stackivo aligns numbers in columns constantly.

**Four radii only.** `rounded-sm` (6, inputs and badges), `rounded-lg` (10, the
default for buttons, cards, dialogs — this is `--radius`), `rounded-2xl` (16,
large marketing surfaces), `rounded-full` (pills, avatars). Never `md`, `xl` or
`3xl`. Exception: marketing document surfaces representing paper use
`rounded-none`.

**No blur for depth.** Retired on both surfaces — it is the most recognisable
AI-site tell. Marketing depth is a flat offset block in `muted` behind a `card`,
plus hairline rules. App depth is hairline borders, `gap-px bg-border` grids and
z-index. The only shadow in the system is `shadow-sm` on a genuinely floating
overlay.

**Spacing comes from the 4px scale.** 4 8 12 16 20 24 32 40 48 64 80. No
arbitrary padding. Dashboard sections use 32. Marketing never hand-rolls
vertical padding — wrap in `<Section>` (components/marketing/section.tsx),
which owns the rhythm.

## Composition — what stops it looking generic

Tokens stop a page being wrong. Composition stops it being anonymous.

- **Seven or eight sections on the homepage, not eleven.** Each gets real room.
- **Default to left-aligned** on marketing. Centre is the exception, twice at most.
- At least two sections break the container — full-bleed band or edge-to-edge rule.
- At least one section is a single sentence with nothing else in it.
- **Never two card grids in a row.**
- Asymmetric columns (`1.08fr .92fr`), not `1fr 1fr`.
- Ledger's signature is the hairline rule and the offset paper block; Workbench's
  is the 1px grid. They repeat across every page — a visitor should identify a
  Stackivo page from a 200px crop.
- Product visuals show **real product output** — a typeset invoice, a GST
  treatment table, a data readout. Never floating fragments or decorative
  check-mark cards.
- Numbers in mockups are **specific and unrounded**. `₹1,24,847`, not `₹1,25,000`.
- Every claim is concrete or it is cut. No invented social proof.

## Non-negotiable before anything ships

Verified on **each surface separately** — marketing, app light, app dark.

- Contrast 4.5:1 body / 3:1 large
- Visible focus rings; tab order matches visual order
- Touch targets ≥ 44px in touch contexts
- `aria-label` on every icon-only control
- Status never conveyed by colour alone — pair with an icon or a word
- `prefers-reduced-motion` honoured in **both** `globals.css` and `MotionProvider`
- Animate transform and opacity only; never width, height, top or left

## Motion

150ms micro-interactions · 200ms state changes · 250ms enters · 400ms marketing
scroll reveals · exits ~70% of enter. `ease-out` in, `ease-in` out, never
`linear`. Stagger 30–50ms, capped at six items. One or two animated elements per
view. No infinite decorative loops. Import from `motion/react` — `framer-motion`
is gone.

## Icons

Lucide only, 1.5px stroke, sized 16 / 20 / 24. Never emoji.

## Finding drift

```bash
grep -rhoE "(text|bg|border)-(slate|gray|zinc|emerald|amber|red|blue|green|indigo|violet|rose|orange|teal|sky)-[0-9]{2,3}" src --include=*.tsx | wc -l   # target 0
grep -rlE "#[0-9a-fA-F]{6}" src --include=*.tsx | wc -l                                                                                                # target 0
grep -rhoE "text-\[[0-9]+px\]" src --include=*.tsx | sort | uniq -c
grep -rhoE "rounded-(none|sm|md|lg|xl|2xl|3xl|full)" src --include=*.tsx | sort | uniq -c
grep -rn "blur-" src --include=*.tsx | wc -l
```

`npm run verify:design` enforces these in CI.

## Bringing in outside components (21st.dev, shadcn blocks, Tailwind UI)

Outside components are for **composition ideas** — how a section is laid out,
what it puts next to what, what the signature visual is. They are never for
styling. Every one of them arrives dressed in someone else's design system,
and pasting it unedited is how drift gets back in.

The pipeline, in order. Do not skip step 3.

**1. Take the prompt, not the code.** On 21st.dev use *Copy prompt* rather
than copying the source. The prompt describes intent; the source carries
`bg-slate-900`, `rounded-xl`, `text-[13px]` and a font stack we do not use.

**2. State the target before generating.** Append to the prompt:

> Stack: Next.js App Router (RSC by default), TypeScript, Tailwind, shadcn/ui
> new-york, `motion/react` for animation, Lucide icons. Follow
> `design-system/MASTER.md`. Semantic tokens only. Server component unless it
> needs state — then push the client boundary to the smallest possible leaf.

**3. Strip it against this list.** Every incoming component gets audited:

| Arrives as | Becomes |
|---|---|
| `bg-white` `bg-slate-900` `text-gray-500` | `bg-card` `bg-background` `text-muted-foreground` |
| any `#hex` | a semantic token, or `brand-colors.ts` if third-party |
| `rounded-md` `rounded-xl` `rounded-3xl` | `rounded-sm` `rounded-lg` `rounded-2xl` `rounded-full` |
| `text-[13px]` `text-[11px]` | the nearest scale step, never below 12px |
| `p-[18px]` `gap-[14px]` | the 4px scale — 4 8 12 16 20 24 32 40 48 64 80 |
| hand-rolled `py-24` section padding | wrap in `<Section>`; it owns vertical rhythm |
| emoji, Heroicons, react-icons | Lucide, 1.5px stroke, 16 / 20 / 24 |
| `framer-motion` import | `motion/react` |
| inline `transition={{duration: 0.8}}` | the durations in MASTER.md §6 |
| `useState` at the top of the file | move the boundary down; keep the section a server component |
| `localStorage`, `window` at module scope | guard in `useEffect`, or drop it |

**4. Check what it animates.** Transform and opacity only. A component that
animates `height`, `width`, `top` or `left` gets rewritten or rejected — no
exceptions, it causes CLS and we measure that.

**5. Look at it in dark mode before you keep it.** Most library components are
designed light-first and fall apart on `--background` at 9% lightness. If it
needs a colour that only works in one theme, it is the wrong component.

**6. Delete what you did not use.** These components ship with variants,
props and helpers for cases we do not have. Unused surface area is future
drift. Keep the markup you actually render.

### What to reach for it for

Good: section composition, an interaction you have not built before, a
signature visual (a marquee, a scroll-linked reveal, a bento arrangement).

Bad: buttons, inputs, dialogs, tabs, tooltips, dropdowns, tables. Those exist
in `src/components/ui/` already and are wired to the token system. Replacing
one with a library version is a regression, not an upgrade.
