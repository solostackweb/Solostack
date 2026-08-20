# Stackivo Design System — Master (v3)

This is the source of truth for every Stackivo interface: marketing, auth,
onboarding, the workspace, public documents, client portals, support and admin.
If implementation and this document disagree, implementation is wrong unless a
new decision has been explicitly approved and recorded here.

**Direction:** Calm Command.

Stackivo should feel calm enough for an independent professional and exact
enough to hold contracts, tax records and money. The visual identity is cool,
light-first and unmistakably blue. Marketing earns attention through spatial
composition. Product screens earn trust through alignment, restraint and clear
data hierarchy.

The approved visual reference is the composition and atmosphere of
[Picktime — Smart Meetings Platform](https://dribbble.com/shots/25267926-Picktime-Smart-Meetings-Platform-SAAS).
It is inspiration, not a template. Do not copy its assets, scheduling-specific
cards, copy or brand details.

The previous warm-paper/ember direction is archived in `MASTER.v2.md`. The
original adherence-focused blue system remains in `MASTER.v1.md`. Neither is an
active authority.

---

## 1. Product and design objective

Stackivo is a business operating system for Indian freelancers and studios. It
connects clients, projects, time, contracts, invoices, GST, payments, files,
portals and Ivo-assisted workflows.

The first impression to preserve is:

> Calm, unmistakably blue, serious software that does not look machine-generated.

Every visual decision must strengthen at least one of these outcomes:

1. **Connected:** users can see how client work becomes documents and payment.
2. **Credible:** money, tax and legal information feels accurate and controlled.
3. **Calm:** breadth never becomes visual noise.
4. **Distinct:** the page remains recognizable without a logo or generic feature grid.

### What we refuse

- Purple or multicolour gradients as a default brand treatment
- Gradient primary buttons
- Decorative glowing orbs and blurred blobs without product meaning
- Floating icon clouds or disconnected check-mark cards
- Three equal feature cards repeated section after section
- Centring every heading, paragraph and CTA
- Uniform oversized radii on every surface
- Invented testimonials, customer logos, usage figures or outcomes
- Generic claims such as “powerful features built for scale”
- Abstract product mockups when a real Stackivo artifact can be shown

---

## 2. One system, three densities

Semantic token names remain stable. Density and composition change by context.

| Context | Purpose | Theme | Density | Composition |
|---|---|---|---|---|
| Marketing | Explain and persuade | Light only | Spacious | Editorial and spatial |
| Workspace | Operate the business | Light default, dark supported | Comfortable | Grid-disciplined |
| Dense operations | Tables, admin, reports | Inherits workspace | Compact | Grid-disciplined |

Apply `data-surface="marketing"`, `data-surface="workspace"` or
`data-density="compact"` at layout boundaries. Components consume semantic
roles rather than checking route or theme in JavaScript.

Rules:

- Marketing is intentionally light-only.
- The workspace defaults to light. Dark mode is retained as a real redesign,
  not a colour inversion.
- Shared primitives in `components/ui/` use semantic tokens only.
- Marketing-only composition stays in `components/marketing/`.
- Product-only composition stays in feature or dashboard components.
- Public invoices and contracts prioritize document legibility over marketing decoration.

---

## 3. Signature: the Flowline

The Flowline is Stackivo's recurring visual grammar: a thin blue path connecting
real business artifacts.

On marketing pages it can connect:

`client → project → contract → invoice → GST → payment → portal`

Inside the product it becomes:

- timeline rails
- workflow progress
- selected-navigation indicators
- document-to-payment relationships
- activity and milestone connectors

### Flowline rules

- Stroke: 1–1.5px using `primary` at 28–42% opacity
- Prefer a solid line for state and a short dash for an illustrative connection
- Nodes are 8–12px and always correspond to an actual state or artifact
- Never create a decorative network or place more than one primary Flowline per viewport
- Do not animate it continuously. A one-time draw or state transition is permitted
- Hide or simplify it below 640px when it competes with content

The Flowline is not a flourish. If it cannot explain a relationship, remove it.

---

## 4. Colour

### Principle

Blue carries action, continuity and brand recognition. Periwinkle and pale
chromatic washes create atmosphere. They do not compete with primary actions.

Components never name a palette colour directly. Use roles such as `background`,
`foreground`, `primary`, `muted`, `border`, `success-strong` and
`warning-subtle`. Literal values are limited to `src/config/brand-colors.ts`,
image generation contexts and third-party marks.

### Core brand palette

| Name | Hex | Role |
|---|---:|---|
| Stackivo Blue | `#2563EB` | Primary actions, active state, links, focus |
| Deep Action Blue | `#173EA5` | Hover/pressed, blue text on pale surfaces |
| Periwinkle | `#7186E8` | Secondary emphasis and atmospheric detail |
| Sky Wash | `#DCEBFF` | Blue-tinted sections and selected backgrounds |
| Lilac Wash | `#E8E8FF` | Rare supporting atmosphere, never primary CTA |
| Primary Ink | `#111936` | Main light-theme text |

### Light workspace and marketing roles

| Token | Hex | Use |
|---|---:|---|
| `background` | `#F7F9FC` | Cool page canvas |
| `card` / `popover` | `#FFFFFF` | Primary surface |
| `raised` | `#FBFCFF` | Subtle toolbar and nested surface |
| `foreground` | `#111936` | Main text |
| `muted-foreground` | `#5D6885` | Secondary text |
| `border` / `input` | `#DCE2EE` | Default hairline |
| `border-strong` | `#C7D0E2` | Input and structural boundary |
| `primary` | `#2563EB` | Main action |
| `primary-hover` | `#1D4ED8` | Hover |
| `primary-pressed` | `#173EA5` | Pressed |
| `primary-foreground` | `#FFFFFF` | Text on primary |
| `accent` | `#DCEBFF` | Selection and supportive fill |
| `ring` | `#2563EB` | Focus |

Marketing may scope its canvas to `#FAFBFE` when a whiter composition is
needed, but cards and product artifacts remain true white.

### Dark workspace roles

| Token | Hex | Use |
|---|---:|---|
| `background` | `#081020` | Canvas |
| `card` | `#0E1830` | Main surface |
| `raised` / `popover` | `#121E39` | Raised surface |
| `foreground` | `#F4F7FF` | Main text |
| `muted-foreground` | `#AAB6D2` | Secondary text |
| `border` | `#22304F` | Default hairline |
| `border-strong` | `#334469` | Strong structure |
| `primary` | `#6B9CFF` | Action and focus |
| `primary-hover` | `#8CB1FF` | Hover |
| `primary-foreground` | `#071126` | Text on bright blue |
| `accent` | `#112B58` | Selection surface |

Reduce chroma on large dark surfaces. Bright blue belongs to small active areas,
not entire panels.

### Semantic colours

| State | Strong | Subtle |
|---|---:|---:|
| Success | `#087F5B` | `#E7F7F1` |
| Warning | `#A9560D` | `#FFF4DF` |
| Error / destructive | `#C73749` | `#FFEDF0` |
| Information | `#1D4ED8` | `#E7F0FF` |

Dark mode receives separately contrast-tested strong and subtle pairs.

Status is never communicated by colour alone. Pair it with an icon, word or
explicit state label.

### Gradients

Permitted:

- broad radial washes behind marketing compositions
- blue-to-transparent atmospheric fades
- data visualization ramps with a documented scale

Not permitted:

- gradient CTA fills
- gradient text for headings
- blue-purple brand gradients used as decoration everywhere
- more than two atmospheric washes in one viewport

---

## 5. Typography

### Families

| Role | Family | Weight | Purpose |
|---|---|---|---|
| Display and large headings | Plus Jakarta Sans Variable | 500–700 | Recognizable geometric silhouette |
| Body, UI and labels | Instrument Sans Variable | 400–600 | Readable at product density |
| Data, IDs and tax figures | IBM Plex Mono | 400–500 | Tabular financial alignment |

All fonts are self-hosted through `@fontsource`. Production rendering must not
depend on Google Fonts or another remote CDN.

Do not reintroduce Inter as the primary family. It served the old system but
makes the new direction converge on generic SaaS output.

### Scale

| Token | Size / line-height | Use |
|---|---|---|
| `text-micro` | 12 / 16 | Eyebrows, badges, dense metadata |
| `text-xs` | 12 / 18 | Timestamps and supporting data |
| `text-sm` | 14 / 20 | Default product UI |
| `text-base` | 16 / 24 | Body and mobile inputs |
| `text-lg` | 18 / 28 | Leads and card titles |
| `text-xl` | 20 / 28 | Product section heading |
| `text-2xl` | 24 / 32 | Workspace page title |
| `text-3xl` | 30 / 36 | Marketing subheading |
| `text-4xl` | 36 / 42 | Marketing section title |
| `text-5xl` | 48 / 52 | Tablet hero |
| `text-6xl` | 64 / 66 | Desktop hero |
| `text-7xl` | 80 / 82 | Large campaign hero, used rarely |

### Tracking and figures

- Display headings: `-0.045em` to `-0.055em`
- Product headings: `-0.025em` to `-0.035em`
- Body: `0`
- Uppercase mono eyebrow: `+0.12em` to `+0.15em`
- All currency and table numbers: `tabular-nums`
- Financial totals and IDs may use IBM Plex Mono; ordinary prose numbers do not

Minimum text size is 12px. Mobile form controls remain at least 16px to avoid
iOS focus zoom.

---

## 6. Spacing and density

Base unit: 4px.

Permitted scale:

`2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120`

| Context | Typical spacing |
|---|---|
| Icon to label | 8px |
| Related control group | 8–12px |
| Form fields | 16–20px |
| Card interior | 16–24px |
| Workspace section | 24–32px |
| Marketing section | 80–120px |
| Hero top/bottom | 96–144px |

Avoid arbitrary Tailwind spacing unless the value solves a documented optical or
layout constraint. Repeated arbitrary values must become tokens.

---

## 7. Layout and composition

### Marketing

- 12-column grid
- Maximum outer width: 1440px
- Primary content width: 1200–1280px
- Reading measure: 58–68 characters
- Use one centered hero at most; subsequent sections default left-aligned
- Alternate between spatial product compositions, editorial splits and quiet bands
- Never place two generic card grids consecutively
- At least one section per major page should make a single clear point
- Product artifacts may overlap, but text never does

### Workspace

- Fluid shell with stable sidebar and content gutters
- Tables and monetary data align to a consistent right edge
- Page headers preserve a single action hierarchy
- Use 1px borders and spacing before adding shadows
- Dense admin screens may reduce gaps, never touch targets or type below the floor

### Responsive behavior

- Desktop: compose, overlap and use asymmetry deliberately
- Tablet: retain hierarchy, reduce overlap and collapse secondary navigation
- Mobile: linearize artifacts into a comprehensible workflow
- At 320px: no horizontal page scroll
- Product tables either reflow to labeled rows or use a clearly indicated local scroller
- Primary mobile actions remain reachable and at least 44px tall

---

## 8. Radius and elevation

| Token | Value | Use |
|---|---:|---|
| `radius-sm` | 6px | Inputs, compact controls |
| `radius-md` | 10px | Buttons, standard cards |
| `radius-lg` | 16px | Product windows, dialogs |
| `radius-xl` | 24px | Large marketing frame only |
| `radius-full` | 9999px | Avatars and statuses |

Do not use the same large radius everywhere. Radius communicates scale and
containment.

Elevation ladder:

1. **Canvas:** no border or shadow
2. **Surface:** 1px border
3. **Raised:** 1px border plus a soft 8–30px shadow
4. **Floating:** dialog, menu or hero product window with a larger restrained shadow

Shadows are cool-neutral. Avoid dark fuzzy halos and coloured neon glows.

---

## 9. Product artifacts

Marketing visuals show outputs that Stackivo genuinely creates:

- invoices with credible Indian formatting
- GST treatment and place-of-supply decisions
- contracts and signature state
- client project timelines
- tracked time becoming an invoice
- a payment matched to its document
- portal updates and files

Use specific, non-rounded values such as `₹99,120`, `18.5 h` and
`INV-2026-042`. Do not imply integrations, automation or customer activity that
the product does not support.

Hero compositions use two to four artifacts, one primary and the rest supporting.
Everything connects through content or the Flowline. No random floating fragments.

---

## 10. Components

### Buttons

- Primary: flat `primary` fill, 10px radius, 44–48px marketing height
- Secondary: white/surface fill with border
- Ghost: no fill; reserve for tertiary actions
- Destructive: semantic error fill only for destructive confirmation
- One primary action per visual region
- Icons follow labels unless the action is conventionally icon-only

### Inputs

- 6px radius and strong border
- 44px minimum height; 48px on marketing/auth
- Focus ring: 3px primary at approximately 16% opacity plus a primary border
- Labels remain visible; placeholders are examples, not labels
- Errors state the fix, not merely “Invalid input”

### Cards and panels

- A card must group content or create interaction boundaries
- Do not wrap every paragraph in a card
- Use borders before shadows
- Marketing cards may have atmospheric parents, but card content remains crisp
- Data cards keep labels quiet and numbers aligned

### Tables

- Right-align currency and numerical totals
- Use tabular figures
- Keep row actions discoverable by keyboard and pointer
- Sticky headers only when the scroll length justifies them
- Status cells include readable words

### Navigation

- Marketing header is compact, translucent only when it overlaps content
- Workspace sidebar uses a pale blue selected state in light mode
- Active navigation uses both colour and a structural marker
- Mobile navigation keeps primary CTA separate from navigation choices

---

## 11. Motion

Motion explains relationship and state. It does not decorate idle screens.

| Token | Duration | Use |
|---|---:|---|
| Micro | 120–160ms | Hover, focus, press |
| Short | 180–240ms | Menus, tabs, state change |
| Medium | 280–400ms | Marketing entrance, panel transition |
| Long | 450–600ms | Rare guided sequence |

- Enter: ease-out
- Exit: ease-in
- Move/reorder: ease-in-out
- Animate opacity and transform; avoid layout-property animation
- Stagger 30–50ms, capped at six items
- Never run decorative motion forever
- Respect `prefers-reduced-motion` in CSS and the Motion provider
- The Flowline may draw once when it becomes visible; it must then stop

---

## 12. Copy and information architecture

Marketing copy follows this order:

1. State the business outcome
2. Show the connected product evidence
3. Explain the mechanism
4. Answer risk, trust and price questions
5. Ask for one action

Use concrete language: “IGST selected from place of supply” is stronger than
“smart compliance.” “Tracked time becomes an invoice” is stronger than
“streamline your workflow.”

Do not use invented social proof. Until real customer evidence exists, use:

- founder explanation
- transparent product demonstrations
- supported compliance details
- explicit free-plan boundaries
- verifiable security and operational claims

Homepage target: 7–9 meaningful sections, including FAQ and final CTA. Every
section must add a new reason to believe.

---

## 13. Accessibility and quality floor

Nothing ships without:

- WCAG AA contrast: 4.5:1 body, 3:1 large text and UI graphics
- Visible focus indication on every interactive control
- Sequential headings and landmark structure
- 44×44px minimum touch targets with adequate separation
- Keyboard access matching visual order
- Status conveyed with text or icon as well as colour
- Reduced-motion support
- No horizontal page scroll at 320px
- Explicit image dimensions or aspect ratio
- Forms with persistent labels and actionable errors
- Zoom to 200% without loss of content or function
- Light and dark workspace states tested independently

Visual quality checks cover 1440px, 1024px, 768px, 390px and 320px widths.

---

## 14. Implementation sequence

Do not attempt an uncontrolled repository-wide restyle. Migrate in deliberate
vertical slices while the semantic foundation remains usable.

1. Archive v2 and establish this document plus root `DESIGN.md`
2. Install and wire Plus Jakarta Sans and Instrument Sans
3. Restore blue semantic tokens and remove ember/paper marketing scopes
4. Rebuild shared marketing header, buttons and section primitives
5. Rebuild homepage hero and its connected product composition
6. Rebuild remaining homepage sections and remove obsolete duplicates
7. Verify marketing at all target widths and against accessibility checks
8. Migrate auth and onboarding
9. Migrate workspace shell and shared primitives
10. Migrate feature surfaces in user-flow order
11. Migrate public documents and client portals
12. Migrate admin and dense operational screens
13. Run a full drift, accessibility and behavioural QA pass

Each slice must pass type checking, linting, relevant behavioural checks and
visual review before the next begins.

---

## 15. Enforcement

Extend `npm run verify:design` so drift fails locally and in CI.

Enforce:

- no literal Stackivo colours outside `brand-colors.ts`
- no raw palette classes where a semantic role exists
- no arbitrary font sizes below 12px
- only the documented radius scale
- no gradient primary buttons
- no decorative infinite animation
- no remote production font dependency
- no old ember tokens or warm Ledger surface values
- no use of archived master documents as implementation authority

Visual snapshots or browser checks are evidence, not the sole test mechanism.
Critical flows also require behavioural assertions for navigation, forms,
documents, payments and responsive interaction.

---

## 16. Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 20 Aug 2026 | Adopt Calm Command across the entire product | Restores Stackivo blue and creates one coherent system |
| 20 Aug 2026 | Use Picktime as compositional inspiration only | Preserve originality and product relevance |
| 20 Aug 2026 | Make the workspace light-default with supported dark mode | Calm first impression without removing user choice |
| 20 Aug 2026 | Introduce the Flowline signature | Makes connected client-to-payment context visible |
| 20 Aug 2026 | Use Plus Jakarta Sans, Instrument Sans and IBM Plex Mono | Distinct brand silhouette plus readable financial UI |
| 20 Aug 2026 | Allow marketing information architecture and copy changes | Remove generic repetition while preserving product truth |
| 20 Aug 2026 | Implement homepage first, then migrate product surfaces | Establish quality in one vertical slice before scaling |
