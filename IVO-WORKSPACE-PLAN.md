# Ivo Workspace Integration Plan

Status: scope locked (E-A-B-C-D), slice commits under IVO-004+
Authority: `design-system/MASTER.md` v3 "Calm Command" (the stackivo-design
skill file describes retired v2 - repo docs win)
Related: `IVO-LATENCY-PLAN.md` (shipped), `IVO-AI-COMPANION-ROADMAP.md`

## Goal

Ivo should feel like a colleague working inside every section of the workspace:
present, animated, context-aware, and human - not a bolted-on chat window.
Premium per MASTER.md: calm, semantic tokens only, transform/opacity motion,
no decorative loops.

## Audit baseline (23 Aug 2026)

Wired today: IvoContextActions on 9 detail/index surfaces; empty-state prompts
on 7 list views; time unbilled CTA; dashboard automation suggestions; prepared
actions; global panel in TopNav via openIvo() event bus. Panel: docked
resizable rail desktop / fullscreen mobile, 180-220ms slide-fade entrance,
token streaming with caret, read-status labels, entity cards, chips.

Gaps: static header presence; zero message/card/chip entrances; phases swap
text only; missing contextual surfaces on invoices list, meetings,
questionnaires, time rows, notifications; suggestions not page-aware; canned
lane strings flat vs agent prose; smart fields on only 2 of ~6 text-heavy
surfaces; prepared emails plain-rendered; panel is one 4,380-line file.

## Phases and slices

### PHASE E - Panel foundation (enabler, no behavior change)
Extract leaf presentation from `stackivo-ai-assistant.tsx` into
`components/panel/*` so later phases edit small pinned files.

- E1 `panel/pending-bubble.tsx` - thinking/streaming indicator (liveReply,
  agentStatus props).
- E2 `panel/transcript-message.tsx` - one rendered transcript row incl. rich
  block resolution handoff and chips row.
- E3 `panel/empty-state.tsx` - welcome screen + suggestion card grid.
- E4 `panel/header-presence.tsx` - header identity/status cluster (lands just
  before Phase A needs it).

Rule: move markup verbatim, props explicit, zero class/logic edits mixed in.
Verification after each: type-check, evals, lint, manual panel open/send.

### PHASE A - Presence and motion (the "alive" pass)
All durations/tokens per MASTER.md section 11 (120-160 micro, 180-240 short,
280-400 medium; ease-out enter; stagger 30-50ms capped at six;
transform/opacity only; prefers-reduced-motion respected).

- A1 Presence dot in header reflecting live phase (idle/thinking/reading/
  writing) replacing static "Connected" text; subtle scale/opacity pulse only
  while active.
- A2 Message entrance: new assistant/user rows fade+rise once (~200ms);
  entity cards and chip rows stagger 30-40ms capped at six. One-shot only -
  no re-animate on scroll/re-render.
- A3 Status phase transition: label swap gets a 120ms crossfade; reading
  statuses keep existing copy.
- A4 Prepared-action and receipt blocks get the same entrance treatment so
  generated content lands consistently.

### PHASE B - Workspace weave
- B1 Contextual Ivo surfaces where none exist: invoices list view, meetings
  list/detail, questionnaires list/detail, notifications, time entry rows.
- B2 Page-aware opening: when openIvo fires with no prompt, panel greets with
  2-3 suggestions derived from current route + real data (reuses
  getAssistantSuggestionsAction shape; deterministic, no model call).
- B3 Resource attach affordance in composer (@-mention picker for visible
  client/project/invoice) feeding existing selectedResources pipeline.

### PHASE C - Human voice
- C1 Canned lane strings get small variation pools (2-3 variants, picked by
  hash of entity id so repeats stay stable); planner evals updated to match.
- C2 Receipt/activity labels rewritten to human sentences; receipts.eval.ts
  pins them.

### PHASE D - Generation feel
- D1 Smart fields extended to invoice notes/terms, proposal sections,
  questionnaire questions (field-generation-actions already supports kinds;
  UI wiring is the work).
- D2 Prepared-email block presented as a document preview (paper surface per
  MASTER section 9) rather than a plain bordered box.

## Non-negotiables

- Semantic tokens only; no hex, no palette classes (verify:design stays green)
- Motion: transform/opacity only, one-shot entrances, reduced-motion honoured
- No new "use server" surface; B3 uses existing authenticated pipelines
- Evals green after every slice; new behavior gets pinned cases
- Panel file shrinks monotonically; no new logic added inside it during A-D

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 23 Aug 2026 | Order E-A-B-C-D | Foundation makes polish low-risk |
| 23 Aug 2026 | Slice-level commits | Matches IVO-003 cadence that worked |
| 23 Aug 2026 | Skill file drift noted | stackivo-design skill describes v2; MASTER.md v3 governs |

## Outcomes (24 Aug 2026)

| Slice | Result |
|---|---|
| E1-E4 | Shipped: `panel/pending-bubble`, `panel/transcript-row`, `panel/empty-state`, `panel/header-presence` extracted verbatim; panel file shrank ~120 lines |
| A1 | Shipped with E4: header presence dot pulses through thinking/reading/writing phases, exact static look at rest |
| A2-A4 | Shipped: chips, prepared-action cards, and Today suggestions get one-shot staggered entrances (35-40ms); agent status swaps crossfade |
| B1 | Notifications gained an Ask-Ivo entry point; invoices/meetings/questionnaires/time/clients/projects already had one - audit overcounted |
| B2 | Shipped: `page-prompts.ts` deterministic per-section opening prompts in the empty state, pinned by eval |
| B3 | Already shipped - composer has a live @-mention picker; verified, no work needed |
| C1 | Shipped: stable variation pools (hash-picked per conversation) for deterministic lane replies |
| C2 | Closed without churn: receipts wording already human and pinned by receipts.eval.ts |
| D1 | Shipped: smart fields on questionnaire questions (`questionnaire_question` kind). Invoice notes/terms and proposal sections already had inline drafting via dedicated actions - audit overcounted; dead kinds deliberately not added |
| D2 | Shipped: prepared email renders as a document surface (header rule, reading type) instead of nested boxes |

Verification at close: type-check clean; 275/275 evals green; lint clean on
touched files; `verify:design` no new drift.
