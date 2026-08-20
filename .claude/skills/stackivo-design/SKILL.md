---
name: stackivo-design
description: Stackivo's design system — tokens, type scale, spacing, radius, elevation, motion, colour semantics and accessibility floor. Use whenever building or changing any UI in this repo: pages, components, layouts, styling, colours, typography, spacing, animation, dark mode, or reviewing UI code for consistency.
---

# Stackivo Design System

The full standard lives in **`design-system/MASTER.md`** at the repo root.
Read it before writing UI code. It is the source of truth; where it and an
existing component disagree, the component is wrong and should be migrated.

## Before writing any UI

1. Read `design-system/MASTER.md`.
2. Check whether a primitive already exists in `src/components/ui/`.
3. Only then write markup.

## The rules that are broken most often

These four cause the majority of drift in this codebase. Check them every time.

**Never name a colour.** No hex, no `emerald-600`, no `slate-500`. Name the
role: `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`.
Status surfaces use `bg-{success|warning|info|destructive}-subtle` with
`text-*-strong`. Third-party brand colours are the only literals, and they live
in `brand-colors.ts`.

**Never invent a font size.** No `text-[11px]`. Use the scale: `text-micro`
(12, uppercase labels/badges), `text-xs` (12, metadata), `text-sm` (14, default
UI), `text-base` (16, body and form inputs), then `lg` `xl` `2xl` `3xl` `5xl`.
Nothing below 12px ships. Form inputs are 16px on mobile or iOS zooms on focus.

**Four radii only.** `rounded-sm` (6px, inputs and badges), `rounded-lg` (10px,
the default for buttons, cards, dialogs — this is `--radius` and the shadcn
convention), `rounded-2xl` (16px, large marketing surfaces), `rounded-full`
(pills, avatars). Never `md`, `xl` or `3xl`.

**Spacing comes from the 4px scale.** 4 8 12 16 20 24 32 40 48 64 80. No
arbitrary padding. Dashboard sections use 32. For marketing, never hand-roll
section padding — wrap in `<Section>` (components/marketing/section.tsx), which
owns the vertical rhythm.

## Non-negotiable before anything ships

- Contrast 4.5:1 body / 3:1 large — verified in light **and** dark separately
- Visible focus rings; tab order matches visual order
- Touch targets ≥ 44px in touch contexts
- `aria-label` on every icon-only control
- Status never conveyed by colour alone — pair with an icon or word
- `prefers-reduced-motion` respected
- Animate transform and opacity only; never width, height, top or left

## Motion

150ms micro-interactions · 200ms state changes · 250ms enters · exits ~70% of
enter. `ease-out` in, `ease-in` out, never `linear`. Motion must show cause and
effect; one or two animated elements per view.

## Icons

Lucide only, 1.5px stroke, sized 16 / 20 / 24. Never emoji.
