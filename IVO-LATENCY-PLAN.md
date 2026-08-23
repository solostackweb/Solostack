# Ivo Latency Plan

Status: proposed, awaiting scope lock-in
Owner: engineering
Related: `IVO-AI-COMPANION-ROADMAP.md` (phases), `src/features/ai-workflows/`

## Problem

Every Ivo message pays a serial tax before the model produces its first token,
and the agent loop itself wastes time once it starts reading. Users perceive
this as "Ivo takes forever to start typing."

Measured anatomy of one message (`conversation-actions.ts:1277`,
`agent.ts:1221`, `groq.ts:524`):

| Stage | Cost | Serial today |
|---|---|---|
| Auth + conversation ownership select | 1 DB RT | yes |
| Persist user message | 1 DB RT | yes |
| Insert `ivo_runs` row | 1 DB RT | yes |
| Quota snapshot + increment | 2 DB RT | yes |
| Rate limit | 1 Upstash RT | yes |
| Active-draft recheck | 0-1 DB RT | yes |
| Agent round 1 TTFB | 1 Groq call | yes |
| Read tools inside a round | up to 3 DB reads, awaited one-by-one | yes |
| Rounds 2..N | full re-send of system prompt incl. up to 240 id lines | yes |

Workspace loads (clients/projects/profile/memories) already overlap via
`workspacePromise` (conversation-actions.ts:1302). Everything else above runs
one-await-at-a-time. Worst case before any visible output: ~6-8 round trips
plus a cold Groq call.

Streaming exists end-to-end (`api/ivo/message/route.ts` SSE + panel reader +
`onDelta`) so perceived latency work is about time-to-first-event, not plumbing.

## Non-negotiables (must not regress)

- User message persists before processing; duplicate `clientMessageId` rejects
  before quota consumption (23505 guard, conversation-actions.ts:1342).
- Retrieval envelope semantics: failed reads stay `unavailable`, never `empty`.
- Tool governance untouched: registry, approval derivation, ledger paths.
- All 262 evals green after every slice; new behavior gets new eval cases.

## Slices (in shipping order)

### SLICE 1 - Parallelize the pre-model gate chain
File: `conversation-actions.ts`.

- Run quota snapshot and rate-limit check together (`Promise.all`); both are
  independent gates with no data dependency between them.
- Fold the active-draft ownership recheck into the overlapped workspace phase
  (it depends only on parsed input + userId).
- Keep strict ordering only where correctness requires it: dupes rejected
  before usage increments; conversation verified before message persist.

Expected win: 2-3 fewer serial RTs (~100-250ms typical).
Risk: low. Verification: existing runtime tests + manual message trace.

### SLICE 2 - Execute agent reads concurrently
File: `agent.ts` (loop body, lines ~1288-1360).

- Today up to 3 read-tool calls per round await sequentially. They are
  independent RLS-scoped queries. Run them via `Promise.all`, then push tool
  messages in original call order (transcript order must match tool_call ids).
- Each read keeps its own try/catch -> `retrievalUnavailable` envelope.
- Status labels emit as each promise settles, not strictly in order.

Expected win: 100-400ms per reading round; multiplies with round count.
Risk: low-medium (Supabase client concurrency is safe; watch connection pool
under load). Verification: new eval pinning envelope-per-call mapping, plus
manual multi-read turn.

### SLICE 3 - Kill the model round for pure list requests
Files: `conversation-actions.ts` (new pre-model route), reuse
`listDecision()` from `runtime-planner.ts:160`.

- "Show my invoices", "list pending contracts", "show clients" and friends
  currently burn 1-4 Groq rounds to produce a `show_records` decision.
- Promote them to the same deterministic pre-model lane meetings already use
  (conversation-actions.ts:1428): parse once, return the list decision, zero
  model calls. Emit a short canned `say` line plus `[chips]` follow-ups so the
  reply does not feel robotic.
- Guard rails: only when no pendingField, no activeDraft, general mode;
  ambiguous phrasing falls through to the agent unchanged.

Expected win: 1-3s eliminated on one of the most common intents.
Risk: medium (routing false positives). Mitigation: port the existing
`planner.eval.ts` list cases to pin the pre-model boundary; conservative
regexes reused verbatim, nothing new invented.

### SLICE 4 - Slim the per-round prompt (measurement first)
Files: `agent.ts:1056` buildSystemPrompt, ops queries against `ivo_runs`.

- Step A (this slice): record baseline. `prompt_tokens` per round is already
  in the run ledger; pull p50/p95 for real workspaces before touching
  anything. Document the query in this file.
- Step B: cap embedded client/project index lines (today 120 + 120) based on
  measured distribution, and instruct the model to resolve anything beyond the
  index via `list_records` / `get_client_profile` (tools it already has).
- Entity resolution quality must not drop: extend `nlu.eval.ts` with
  beyond-index cases before flipping the cap.

Expected win: proportional token cut on every agent round; faster TTFB and
lower cost. Risk: medium-high (grounding quality). Gate: evals + staged
rollout behind env flag if Step B numbers look risky.

### SLICE 5 - Dead-air elimination
Files: `agent.ts`, panel status wiring.

- Emit a "Thinking..." status event immediately after gates pass, before the
  first Groq call, so round-1 TTFB never renders as silence.
- Verify final-answer deltas actually reach the panel for plain-text replies
  (readGroqStream path) and that tool-round statuses render between rounds.

Expected win: perceived latency; users see motion within ~200ms.
Risk: trivial. Verification: manual SSE trace.

## Explicitly out of scope

- History compression / summarization (quality track, later).
- Model swap or golden-set harness (Phase 8 track).
- Panel refactor (168KB component) - report-only concern.
- Any governance, registry, or schema changes.

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 23 Aug 2026 | Focus = latency + responsiveness | User-selected direction; quality/evals tracks queued behind it |
| 23 Aug 2026 | Plan-first workflow per gstack | Slices ship independently, each with evals green |

## Baseline capture (fill during Slice 4 Step A)

- [ ] p50/p95 `duration_ms` for agent-succeeded runs
- [ ] p50/p95 `prompt_tokens` per operation
- [ ] Round-count histogram (`metadata->>'rounds'`)
