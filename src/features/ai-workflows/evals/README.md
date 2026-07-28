# Ivo evaluation suite

Run with `npm run eval`.

## What this covers

Deterministic behaviour only — the pure functions that decide things. No model
call, no database, no network, so it is fast and its failures are always real.

| Suite | Protects |
| --- | --- |
| `retrieval.eval.ts` | A failed read can never reach the model looking like an empty one; a truncated payload always still parses. |
| `knowledge.eval.ts` | Product and policy questions reach the right article; unrelated questions return `empty` so the model declines instead of answering from loosely-matched text. |
| `planner.eval.ts` | One server-owned routing decision. A bulk external send is always proposed, never executed directly from a message. |
| `nlu.eval.ts` | Intent routing, entity resolution, Indian money formats, and multi-turn follow-ups. |
| `workflow.eval.ts` | Field sequencing terminates without looping or re-asking; export invoices are never told GST applies. |
| `tool-registry.eval.ts` | Every executed tool is declared; nothing that reaches a client or moves money is exempt from approval. |
| `receipts.eval.ts` | Every tool produces a receipt; links never dangle; an unrecognised ledger status never reads as success. |

## Running against the model

By default there is no `GROQ_API_KEY`, and `generateStructuredJson` returns
`null` without attempting a request — so `nlu.eval.ts` exercises the
deterministic fallback. That path is not a curiosity: it is what every user hits
whenever the provider is down, rate-limited, or returns unparseable JSON, so it
is worth testing on its own terms.

Export a real key to run the same cases against the model:

```
GROQ_API_KEY=... npm run eval
```

The suite prints which path it took. Expectations are written to hold for both.
Where the model should do strictly better than the fallback, add a separate
provider-gated case rather than weakening the shared one.

## Why these cases exist

Two of them come from defects found in review, and both are worth keeping
pinned:

- **Truncation corrupted the payload.** The old `clip()` stringified a tool
  result and sliced it at 6000 characters, so anything larger arrived as
  syntactically invalid JSON and whatever the model "read" past the cut was
  invention — in the one path whose job is grounding answers in real figures.
- **Common words matched every knowledge article.** "what is the capital of
  France" scored on every article because "what" and "the" appear in most
  bodies, so the model received irrelevant product text as though it answered
  the question.

## What this does *not* cover

Be aware of the gap before trusting a green run:

- No model-backed cases. Intent classification, extraction quality, grounding
  faithfulness, and tone all still need a golden set run against the real
  provider. That is Phase 8 and needs API credentials plus seeded workspaces.
- No database. Ownership and RLS enforcement are asserted by the tools
  themselves, not here.
- No UI. Panel rendering, tool dispatch, and the agent loop are untested.

Prompt-injection cases here only prove the *deterministic* layers cannot be
steered — lexical retrieval and regex routing. They say nothing about whether
the model honours its instructions, which is a separate, model-backed test.

## Adding a case

Suites are plain `node:test`. Files must end in `.eval.ts` to be picked up.

The runner uses Node's native type stripping plus a small resolver hook
(`scripts/eval-resolve.mjs`) that adds the `.ts` extension the app's `bundler`
module resolution lets us omit, and maps the `@/` alias. `--conditions=react-server`
makes `import "server-only"` resolve to a no-op so server modules load directly.
No test framework, no build step, no new dependencies.
