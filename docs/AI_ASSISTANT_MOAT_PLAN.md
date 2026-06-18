# Stackivo AI Assistant — Moat Plan

**Status:** Planning (no code yet)
**Goal:** Turn the assistant from a capable "do things for me" agent into a true business
co-pilot that also **knows your numbers** and **tells you what to do next** — the durable
moat against competitors.

---

## Current state (already strong)

- **Intelligence layer** (`nlu.ts` + `groq.ts`): Groq-powered intent + field extraction with
  normalization (money/dates/duration/state), a deterministic local fallback, fuzzy
  client/project resolution, and conversation memory.
- **Action breadth** (`global-actions.ts`, ~2.2k lines): create + refine + send across
  **invoices, contracts, welcome docs, clients, projects, time entries**; approve/email/
  WhatsApp; product-docs Q&A.
- **Guided UX**: one-field-at-a-time collection, quick-reply chips, skip sentinels.

## The gaps (the moat)

1. **It doesn't know the user's own data.** Intents are create/send + product "support".
   There is **no "ask my business" capability** — the docs assistant literally tells users
   to "find or do it themselves" for their own numbers. Competitors don't have this.
2. **No proactive intelligence.** Suggestions exist only as field chips mid-workflow. The
   assistant never says "₹X is overdue — want me to chase it?" based on real state.
3. **Action breadth has holes** for the most common asks: mark paid, send a reminder,
   "invoice Acme's unbilled time", list/search with action chips, and multi-step chains.

---

## Phase AI-1 — Data-aware Q&A ("ask your business anything")  *(headline moat)*
Let the assistant answer questions about the user's **own** records, grounded in real data.
1. **Business-facts service** `ai-workflows/business-context.ts` — assembles a compact,
   structured snapshot on demand by **reusing engines we already built**: Pulse
   `getPulseAnalytics`/`getPulseInsights` (revenue, receivables/aging, collection rate,
   GST, top clients, concentration), Time `getTimeAnalytics`/`getUnbilledTime`, plus
   invoice/client/project lookups. Scoped + RLS-safe; only the facts a question needs.
2. **New `query` intent** in the NLU (e.g. "how much did Acme pay me?", "what's overdue?",
   "revenue this month", "who hasn't paid?", "unbilled hours on X", "GST collected this
   quarter"). Routed to a grounded LLM answer over the facts snapshot — **never invents
   numbers**; if a fact isn't available it says so.
3. **Answers carry action chips** — "Send reminders", "Create invoice", "Open Pulse" — so a
   question turns into a one-tap action.

## Phase AI-2 — Proactive intelligence (suggestions, reminders, nudges)
1. **`getAssistantSuggestions`** — computes real, ranked nudges from state: overdue
   invoices (→ send reminders), unbilled time per client (→ invoice it), sent-but-unsigned
   contracts (→ nudge), drafts sitting idle, renewals/expiries, clients gone quiet.
2. **Surface them**: starter chips on the assistant home ("what should I do today?") and a
   compact "Today" panel — each is a one-tap action, not just text.
3. Optional: a scheduled morning digest (reuse the GitHub Actions cron) summarising the
   same nudges by email/push — opt-in.

## Phase AI-3 — Action breadth + chaining
1. High-frequency actions the assistant can't do yet: **mark invoice paid**, **send a
   reminder** to a named client, **invoice all unbilled time** for a client, **cancel**,
   and **list/search** ("show overdue invoices") rendered with per-row action chips.
2. **Multi-step chains** ("invoice Acme's unbilled time and send it") with a single
   confirmation, executed step by step with clear progress.

## Phase AI-4 — Reliability, safety & polish
1. **Confirmation before mutating/sending** (esp. money + outbound email/WhatsApp), with a
   clear preview; **undo** where feasible.
2. Guardrails: grounded-only answers, graceful Groq-down fallback (already partly there),
   honest "I can't do that yet" instead of hallucinating.
3. Suggested **follow-ups after each action**, streaming/typing feedback, mobile-first.
4. Verification: esbuild + null scan, contract checks, and prompt-injection / no-hallucination
   spot checks.

## Cross-cutting
- **Reuse, don't rebuild**: the Pulse + Time analytics engines are the data backbone for
  AI-1/AI-2 — this is why those phases are tractable.
- **Privacy/safety**: every fact is RLS-scoped to the user; the assistant only ever sees
  the requesting user's data; never fabricates figures.
- Each phase: esbuild parse + null scan + cross-file checks (full build runs locally).

## Recommended order
**AI-1 first** (data Q&A is the single biggest differentiator and reuses existing engines)
→ AI-2 (proactive) → AI-3 (action breadth) → AI-4 (reliability + polish).
