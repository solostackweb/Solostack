# Stackivo AI — Monetization, Usage Tracking & Plan Gating Plan

A concrete implementation plan that reuses the **existing** subscription /
entitlements system (`src/features/subscription`). Nothing here invents a new
billing mechanism — it adds AI as a new metered capability inside the system you
already have (`UsageMetric`, `usage_counters`, `withinLimit`, `requireWithinLimit`,
per-plan `limits`).

---

## 1. The moat — how AI becomes a reason to pay, not a checkbox

**Principle:** keep every *manual* flow free and complete. AI is the
**accelerant and the proactive layer**, never a paywall on basic function.

Three layers of differentiation, increasing in defensibility:

1. **Speed (table stakes):** "Invoice Acme 50k for a landing page" → a
   GST-correct, client-linked draft in one sentence. Nice, but copyable.
2. **Wired into the workflow (real moat):** the assistant doesn't just chat —
   it drafts → links to the right client/project → routes to send, using your
   data model (GST states, invoice numbering, contract templates). A standalone
   chatbot can't do this.
3. **Proactive on the user's own data (durable moat):** "3 invoices overdue —
   draft reminders?", "this client has 4h unbilled time — invoice it?",
   "contract X is unsigned after 7 days — nudge them?". This requires the user's
   accumulated Stackivo history, so it **cannot be replicated** by an external
   tool. This is the upgrade hook and the thing worth marketing.

**Monetization shape:** Free users feel the speed (capped). Pro unlocks
generous usage **and** the proactive layer. That converts.

---

## 2. Usage tracking (foundation) — `ai_actions` metric

### New `UsageMetric`
Add to `src/features/subscription/types.ts`:
```
| "ai_actions"
```

### Counting strategy — reuse `usage_counters`
The codebase already has a generic `usage_counters (user_id, metric,
period_start, count)` table read in `getUsageSnapshot`. AI actions don't map to
a domain table (unlike invoices), so they use this counter directly — same path
as the fallback branch already in `server.ts`.

- **Increment** on each *model-backed* AI action (one call = one unit):
  - `interpretAiMessageAction` (the NLU call)
  - `answerFromDocsAction`
  - the create/refine actions that call Groq (`createContract`, `refineContract`,
    `createWelcomeDoc`, `refineWelcomeDoc`, custom-path welcome, etc.)
  - **Do NOT count** the local short-circuits (skip / chit-chat / abandon /
    button picks) — they never hit Groq, so they're free.
- **Where:** a single helper `incrementAiUsage(userId)` that upserts
  `usage_counters` for the current period. Call it right after a successful Groq
  response.

### Cost/quality logging (separate, lightweight)
New table `ai_usage_log` for observability (not for gating):
```
ai_usage_log(
  id, user_id, created_at,
  action            text,     -- 'interpret' | 'docs' | 'contract_draft' | ...
  model             text,
  latency_ms        int,
  prompt_tokens     int,
  completion_tokens int,
  ok                boolean,
  fallback          boolean   -- true when we fell back to local/deterministic
)
```
Groq returns `usage: { prompt_tokens, completion_tokens, total_tokens }` in the
response body — capture it in `generateStructuredJson` and pass back alongside
the parsed JSON so callers can log it. This gives you **real cost per user** and
a fallback-rate signal (quality/health) with no guessing.

> Privacy: log token **counts and metadata only**, never the message content.

---

## 3. Cost control — making sure it never costs more than planned

Three independent guards, cheapest first:

1. **Local short-circuits (already shipped):** skip/chit-chat/abandon/button
   picks never call Groq. Free.
2. **Per-minute rate limit (already shipped, abuse guard):** in-memory, 20/min.
   Keep for burst protection. *Note: per-instance — see "Scaling" below.*
3. **Monthly cap per plan (NEW, the real cost ceiling):** enforced via the
   existing `requireWithinLimit("ai_actions")` before any Groq call. When a user
   hits their plan's monthly cap, the action returns a friendly
   "you've used your AI actions for this month — upgrade for more" instead of
   calling the model. **This is the hard spend ceiling.**

**Worst-case math to set caps by:** with `llama-3.3-70b-versatile`, a typical
action is roughly a few thousand tokens. Pick caps so that
`max_users × monthly_cap × avg_tokens × price_per_token` stays inside your AI
budget. Caps below are a starting point — tune against the `ai_usage_log` data
after a few weeks.

---

## 4. Per-user limits (server-enforced)

Add `ai_actions` to each plan's `limits` in `src/features/subscription/plans.ts`:

| Plan      | `ai_actions` / month | Rationale |
|-----------|----------------------|-----------|
| Free      | **25**               | Enough to feel the magic, then hit a wall → convert. |
| Pro       | **600**              | Covers heavy normal use; effectively unlimited for a solo freelancer. |
| Business  | **3000** (or `Infinity`) | Power users / small teams. |

Enforcement (mirrors how invoices/clients are capped today):
```ts
// at the top of each model-backed AI action, before calling Groq:
const within = await requireWithinLimitSoft("ai_actions"); // returns ok|exceeded
if (!within.ok) return { ok:false, error: UPGRADE_MESSAGE, upgrade:true };
// ... call Groq ...
await incrementAiUsage(userId);
```
Use a **soft** variant (return an error object) rather than `requireWithinLimit`'s
redirect, because the assistant is a panel — we want an in-chat upgrade message,
not a navigation. The chat surfaces it as an assistant message with an "Upgrade"
chip linking to `/dashboard/settings/billing`.

**UI:** show "X / 25 AI actions used this month" in the AI panel footer for Free
users (reuse `toUsageSnapshot` → already returns `used/limit/remaining`). Quiet
for Pro/Business unless near the cap.

---

## 5. Plan gating — what each plan gets

Two AI capabilities, gated separately:

### a) AI usage (metered) — all plans, different caps
The assistant itself (draft invoices/contracts/welcome docs, log time, support
Q&A) is available on **every** plan, capped by the `ai_actions` limit above.
Rationale: gating it off entirely on Free kills the "wow" that drives upgrades.

### b) Proactive AI (the moat) — Pro+ only, new `FeatureKey`
Add to `FeatureKey` in `types.ts`:
```
| "ai.proactive"
```
Set `true` in `pro` and `business` feature maps. Gate the proactive features
(overdue-invoice reminders, "invoice unbilled time", contract nudges, the
in-panel "you have N items to act on" prompt) with the existing
`hasFeature(sub, "ai.proactive")` / `requireFeature("ai.proactive")`.

Optional third lever: **support/docs answers uncounted on all plans** — they're
cheap (cached context) and drive retention/deflection of real support tickets.
Decision point for you; I'd lean toward counting them but with a higher Free cap.

### Summary table
| Capability | Free | Pro | Business |
|---|---|---|---|
| AI assistant (draft/create/log) | ✅ 25/mo | ✅ 600/mo | ✅ 3000/mo |
| Support / docs Q&A | ✅ (counts toward cap) | ✅ | ✅ |
| Proactive AI (`ai.proactive`) | ❌ | ✅ | ✅ |
| Usage meter in panel | shown | near-cap only | hidden |

---

## Build order (when you approve)

1. **Schema + logging:** add `ai_actions` metric, `ai_usage_log` table; capture
   Groq `usage` in `generateStructuredJson`. *(no behaviour change yet)*
2. **Increment + read:** `incrementAiUsage` after each Groq success; wire
   `ai_actions` into `getUsageSnapshot`.
3. **Caps:** add `ai_actions` limits to `plans.ts`; soft-limit guard + in-chat
   upgrade message; usage meter in the panel footer for Free.
4. **Proactive feature flag:** add `ai.proactive`, gate the (future) proactive
   surface to Pro+.

Steps 1–3 are the cost/usage safety net and can ship first. Step 4 is the moat
and pairs with building the proactive features themselves.

---

## Scaling note (be honest about current limits)
- The **per-minute rate limit** and **docs-context cache** are in-memory /
  per-serverless-instance. Fine at preview scale; at high traffic across many
  instances the rate limit becomes approximate. The **monthly cap** above is
  DB-backed (via `usage_counters`), so *that* is accurate regardless of
  instances — it's the one that actually protects spend. Move the per-minute
  limiter to Upstash/Redis only if/when you scale out.
