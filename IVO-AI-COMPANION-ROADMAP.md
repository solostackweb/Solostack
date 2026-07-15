# Ivo AI Companion: Audit and Delivery Roadmap

Status: Phase 0 observability foundation complete; Phase 1 persistence foundation in progress as of 2026-07-15  
Scope: authenticated freelancer workspace, contextual Ask Ivo surfaces, proactive suggestions, and automations

## Implementation progress

- Phase 0: capability-labelled provider telemetry now records latency, retry/failure class, selected model, and token usage without prompt or workspace content.
- Phase 1 slice 1: migration `0072_ivo_conversation_runtime.sql` adds RLS-protected conversations, messages, model runs, and action attempts.
- Phase 1 slice 1: the current panel creates/resumes one active conversation, restores textual history and pending workflow state, serializes message writes, and archives the old thread when the user starts a new conversation.
- Phase 1 slice 2: model-routed messages now enter through one authenticated server action that idempotently persists the input, applies quota and rate policy, performs intent extraction, and records provider outcome, model, latency, attempts, and token usage in the durable run ledger.
- Phase 1 slice 3: client, project, and time-entry creation now use authenticated typed tools backed by durable action attempts. Approval is bound to the exact previewed input hash, retries return the stored result, concurrent confirmations are claimed atomically, and rejection is recorded.
- Phase 1 slice 4: invoice, contract, and welcome-document creation now use retry-safe internal-draft tools. The ledger stores only an input hash, safe policy metadata, and the created entity id; previews are reconstructed from owned domain records so prompts, contacts, and document bodies are not copied into operational audit rows.
- Phase 1 slice 5: invoice approval, invoice paid-status changes, and welcome-document publishing now use explicit-user-action tools with deterministic per-entity idempotency, atomic execution claims, safe retries, and durable outcomes.
- Phase 1 slice 6: invoice, contract, and welcome-document email delivery now uses explicit external-delivery tools. Concurrent UI clicks share a request id, the Ivo ledger atomically claims it, and the canonical email dispatcher receives a user-scoped idempotency key as a second duplicate-send barrier.
- Phase 1 slice 7: invoice, contract, and welcome-document WhatsApp preparation now uses explicit share-preparation tools with deterministic per-entity attempts; links are reconstructed from owned records and are not copied into the ledger. Confirmed overdue-reminder batches now use an explicit bulk-delivery attempt, while the canonical dispatcher retains its per-invoice, per-day idempotency barrier.
- Phase 1 slice 8: invoice, contract, and welcome-document refinements now use retry-safe internal-draft tools keyed to the durable user message. The ledger stores only the instruction hash and length, policy, and entity id; successful replays rebuild the current preview from owned canonical records instead of rerunning generation or mutation.
- Phase 1 slice 9: unbilled-time invoicing now uses a message-idempotent internal-draft tool, and an optional email send reuses the same durable request id through the separate external-delivery tool. Multi-client ambiguity is now a remembered choice with deterministic client suggestions instead of a forgotten plain-text question.
- Phase 1 slice 10: explicitly approved support forwarding and welcome-template saving now use atomic, retry-safe creation tools. The action ledger retains hashes and safe structural metadata rather than support text or template content, and successful retries verify the owned ticket or template. Support ticket creation now rolls back the ticket if its first message cannot be stored.
- Phase 1 slice 11: actionable invoice, contract, and welcome-document preview/delivery cards now persist only a typed entity reference and textual fallback. Conversation resume rereads the current owned domain record, reconstructs the card server-side, restores suggestions and tips, and reopens refinement context only when the canonical entity is still a draft.
- Phase 1 slice 12: picker, entity-list, creation-result, and confirmation cards now use validated persistence descriptors. Pickers and lists reread current owned workspace records, deleted records disappear on resume, creation results are rebuilt from their canonical entity, and only the confirmation request currently bound to resumable workflow state can regain approval controls. Client, project, and time-entry approvals now survive reload with the same idempotency key and previewed fields.
- Phase 1 slice 13: the authenticated message runtime now returns a Zod-validated server decision alongside interpretation and records its route class in the durable run. Entity-list requests, grounded business questions, support questions, and target-workflow switching consume that decision directly; the panel's duplicate keyword fallback and second routing branches for those capabilities have been removed.
- Phase 1 slice 14: draft-refinement selection is now server-owned and only returned after the referenced invoice, contract, or welcome document is reread as an owned canonical draft. Overdue reminders now require a resumable pending proposal before an affirmative reply can execute the bulk-delivery tool; unrelated replies expire the proposal. Unbilled-time invoice routing also moved server-side so it cannot be mistaken for refinement of an open invoice.
- Phase 1 slice 15: the server runtime now returns the canonical merged field state for each workflow turn, including normalized direct answers, optional-field skip state, validated amount/duration/date/email input, workflow-switch resets, and resolved client/project carry-over. Invalid field answers return a typed validation decision, and the panel's duplicate merge, skip, validation, and entity-resolution branches have been removed.
- Phase 1 slice 16: missing-field progression is now planned before mutation. The validated message decision identifies the canonical next question, and picker continuations use an authenticated read-only preflight against the same shared question catalogue. Invoice currency-aware prompts, optional skip state, welcome template branching, and deliberate client/project omission are preserved; create tools retain independent missing-field checks as a safety boundary.
- Phase 1 slice 17: the validated runtime decision now sequences one explicit next action: ask a typed field, answer support, or invoke a named typed tool. Message-driven tool requests use the durable run id as their idempotency key; picker continuations receive a server-issued request id from authenticated preflight. The panel dispatches on the server tool identifier rather than choosing a mutation from the local workflow, and resumable confirmations retain the exact selected tool and request id.
- Phase 1 slice 18: field-prompt block assembly is now server-owned. Each `ask_field` instruction carries a validated question or picker descriptor with the exact label, picker type, skip policy, placeholder, suggestions, and tip. The panel renders that descriptor and supplies callbacks, but no longer decides which missing fields become pickers or generates workflow-specific prompt copy and skip chips.
- Phase 1 slice 19: runtime-sequenced creation tools now return their own typed persistence descriptors. Invoice, contract, and welcome-document drafts return canonical entity-preview references; client, project, and time-entry successes return canonical entity-result references; confirmation proposals return the exact durable request reference. The panel renders the canonical tool data but no longer invents message kind, fallback text, entity type, variant, or block identity for these outcomes.
- Still required for Phase 1 completion: add the retention job, finish moving non-core/refinement and delivery response descriptors out of the panel, then remove the remaining UI domain-orchestration branches.

## Product promise

Ivo should feel like a careful operating partner inside Stackivo. It should understand the freelancer's current workspace, answer from real records, prepare useful work, remember approved preferences, surface timely next steps, and never perform an external or destructive action without the right approval.

The success test is not “the model replied.” The success test is “the freelancer completed the right workspace outcome with less effort and could trust what happened.”

## Audit summary

### What already exists

- A global Ivo panel mounted in the dashboard shell.
- Natural-language intent extraction with a deterministic fallback.
- Draft/create flows for invoices, contracts, welcome documents, clients, projects, and time entries.
- Read-only business Q&A grounded in Pulse and Time aggregates.
- Contextual Ask Ivo buttons across multiple workspace pages.
- Approval UI for some record and delivery actions.
- Plan quotas and rate limiting.
- Database tables for automation recipes and suggestions.

### Why it currently feels like a placeholder

1. **The assistant is a client-side state machine, not a durable agent runtime.** The main panel owns routing, collection, confirmation, previews, lists, refinements, and delivery behavior in one component. Conversations and pending work are lost on reload and are difficult to resume or inspect.
2. **Routing logic is duplicated.** Intent decisions exist in local regexes, the NLU prompt, helper functions, and UI branches. The same message can take different paths depending on panel state.
3. **Workspace context is narrow and eager.** Every dashboard render loads up to 200 clients and 200 projects for the panel, while most other entities are fetched only through special-case actions. There is no uniform context/tool contract.
4. **“Automation” is currently a computed suggestion list.** Recipes are seeded, but evaluations are not scheduled, suggestions are not persisted or lifecycle-managed, and approvals do not execute a typed automation job. A card injects a handcrafted prompt into Ivo.
5. **Action safety is inconsistent.** Client, project, and time creation have explicit pre-create confirmation. Invoice, contract, welcome-document, and unbilled-time paths create database drafts earlier in the conversation. Prompts that say “ask before creating” are not a security boundary.
6. **Provider failures were opaque.** Model rejection, timeout, invalid JSON, empty content, quota, and deterministic fallback were largely collapsed into generic responses. Phase 0 has started adding non-PII provider telemetry.
7. **No AI evaluation suite exists.** Type checking and linting pass, but there are no repeatable intent, extraction, grounding, tool-selection, approval, or regression evaluations.
8. **Suggestions are duplicated.** `ai-workflows/suggestions.ts` and `automation/server.ts` independently compute overlapping cash-flow nudges with different contracts.
9. **Knowledge answers are a special-case document dump.** Product docs are read from source files and paired with hard-coded answers. There is no versioned knowledge index, citation/provenance contract, or freshness check.
10. **There is no durable memory model.** Ivo receives a short in-memory transcript and user/profile basics, but has no user-approved working preferences, entity memory, or resumable tasks.

## Target architecture

```text
Ivo surfaces
  -> server conversation runtime
      -> intent + plan
      -> workspace context builder
      -> typed tool registry
      -> policy / approval gate
      -> execution + idempotency
      -> durable conversation and run log
  -> response, preview, next actions

Domain events
  -> automation evaluator
      -> durable suggestion / scheduled job
      -> notification or Ivo inbox
      -> user approval when required
      -> same typed tool registry
      -> execution log and outcome
```

The conversational assistant and automations must share the same tools, policy checks, schemas, and audit log. Automations must not be a second prompt-routing system.

## Non-negotiable contracts

- Models may propose a plan; only server-owned typed tools may read or mutate workspace data.
- Every tool validates authentication, ownership, input schema, entitlements, and idempotency.
- Read-only actions can run immediately. Draft creation requires a clear preview policy. Sending, publishing, deleting, marking paid, or contacting a client requires explicit approval unless the user has enabled a narrowly scoped automation policy.
- UI prompt text is never treated as an authorization mechanism.
- Every answer based on workspace data carries internal provenance and an `asOf` timestamp.
- Provider failure must be distinguishable from no data, unsupported capability, quota exhaustion, and validation failure.
- No raw prompts, document bodies, emails, phone numbers, or client names are written to operational logs.
- Every proactive suggestion must explain why it appeared, what will happen, and whether approval is required.

## Delivery phases

### Phase 0 — Baseline, observability, and safety inventory

Goal: make current behavior measurable before changing orchestration.

Deliverables:

- Provider telemetry by stable operation: latency, status, model, attempt, token usage, invalid JSON, timeout, and fallback reason.
- A capability/action matrix covering reads, draft writes, external sends, destructive actions, and confirmation behavior.
- Golden evaluation cases for common freelancer language, Indian money/date formats, entity resolution, follow-ups, corrections, and prompt injection.
- A production dashboard for success, fallback, error, latency, token, confirmation, abandonment, and completed-outcome rates.
- Truthful product copy: call current dashboard items “suggestions” until the automation engine is live.

Exit criteria:

- At least 95% of AI runs have a classified outcome and operation label.
- No sensitive prompt or workspace content appears in logs.
- Baseline evaluation results are recorded and reproducible.
- Every mutating path has a documented approval rule.

### Phase 1 — Durable Ivo conversation runtime

Goal: replace scattered UI routing with one server-owned orchestration contract.

Deliverables:

- `ivo_conversations`, `ivo_messages`, `ivo_runs`, and `ivo_action_attempts` persistence with RLS and retention rules.
- One `sendMessage` server entry point returning typed response blocks: text, question, picker, preview, list, confirmation, or error.
- A workflow state schema that can be resumed after reload/navigation.
- One intent taxonomy and one validated planner output.
- Idempotency keys for every action attempt.
- Split the current client and server monoliths into runtime, tools, policies, context, and presentation modules.

Exit criteria:

- A conversation survives reload and navigation.
- Replaying a request cannot duplicate a record or delivery.
- All existing Ivo entry points use the same runtime.
- UI contains no domain mutation logic and no independent intent router.

### Phase 2 — Workspace context and knowledge layer

Goal: make answers consistently aware of the right workspace facts without sending the whole workspace to the model.

Deliverables:

- A context builder with scoped packs: user/business preferences, current page/entity, clients, projects, invoices, contracts, proposals, time, meetings, leads, documents, and notifications.
- On-demand retrieval tools with strict result limits, ownership filters, and `asOf` metadata.
- A versioned Stackivo help/policy knowledge source with citations or source labels.
- Context freshness rules and cache invalidation from domain events.
- Clear “I do not have that data” responses instead of plausible guessing.

Exit criteria:

- Data questions are grounded in retrieved records or aggregates with provenance.
- Entity references and follow-ups work across at least two turns.
- Cross-user access and prompt-injection tests pass.
- Dashboard layout no longer eagerly serializes large client/project lists solely for Ivo.

### Phase 3 — Typed action engine and approval UX

Goal: let Ivo reliably complete work while remaining predictable and safe.

Deliverables:

- A registry of typed tools for all supported read and write actions.
- Standard lifecycle: propose -> validate -> preview -> approve -> execute -> verify -> report.
- Consistent approval policy for draft creation, send/publish, money/status changes, and destructive actions.
- Editable previews and field-level validation for every create flow.
- Compensating/retry behavior for partial failures.
- Execution receipts linking to the affected record.

Exit criteria:

- 100% of external sends and destructive or financial mutations pass a server policy gate.
- Every successful action is verified by rereading canonical data.
- Cancellation before approval creates no unintended records.
- Duplicate clicks or retries do not duplicate records, notifications, or messages.

### Phase 4 — Real automation engine

Goal: turn the existing recipe tables into reliable event/time-driven workflows.

Deliverables:

- Domain-event outbox for invoice, proposal, contract, project, lead, meeting, and time events.
- Scheduled evaluator for date-based conditions such as overdue, due soon, quiet proposals, expiring contracts, and unbilled time.
- Durable automation runs with `queued/running/waiting_for_approval/succeeded/failed/cancelled` states.
- Recipe configuration: enabled state, thresholds, channel, quiet hours, frequency, cooldown, and approval mode.
- Deduplication keys, retry policy, expiry, failure visibility, and run history.
- Typed execution through the Phase 3 tool registry.

Exit criteria:

- A recipe produces at most one active suggestion/job for the same condition.
- Disabling a recipe prevents future evaluations.
- Every run has a visible reason, state, inputs summary, and outcome.
- Failures retry safely and never double-send.

### Phase 5 — Proactive companion and notification experience

Goal: make Ivo present at useful moments without becoming noisy.

Deliverables:

- Ivo inbox / Today view combining suggestions, approvals, failed jobs, and completed outcomes.
- In-app and optional push/email delivery honoring notification preferences, batching, and quiet hours.
- Ranked suggestions based on urgency, cash impact, deadline, confidence, and recent dismissal.
- “Why am I seeing this?”, dismiss, snooze, approve, edit, and disable-recipe controls.
- Daily/weekly brief generated from deterministic facts, with AI only shaping the explanation.

Exit criteria:

- Users can control every proactive channel and recipe.
- Dismissed/snoozed suggestions do not immediately return.
- Notifications deep-link to the exact Ivo task or workspace entity.
- Suggestion usefulness and notification opt-out rates are measurable.

### Phase 6 — Embedded generation and smart fields

Goal: make Ivo useful inside the work, not only inside a chat panel.

Deliverables:

- Shared “generate / improve / shorten / change tone / fill from workspace” field component.
- Context-aware drafting for proposals, contracts, emails, reminders, welcome docs, scope, milestones, meeting summaries, and follow-ups.
- Placeholder resolution from canonical workspace facts with a visible source and easy undo.
- Diff-based apply/reject controls rather than silent replacement.
- Reusable brand voice and document preferences.

Exit criteria:

- Generated content never overwrites user content without explicit apply.
- Every filled field can show its source and be undone.
- Tone/brand preferences are reused consistently across surfaces.
- Output quality passes the relevant golden evaluations.

### Phase 7 — User-approved memory and personalization

Goal: let Ivo learn stable working preferences without creating hidden or surprising memory.

Deliverables:

- Explicit memory categories: business defaults, communication style, payment terms, workflow preferences, and client-specific notes.
- “Remember this” and memory review/delete controls.
- Confidence, source, updated-at, and scope on every memory item.
- Conflict resolution when workspace canonical data changes.

Exit criteria:

- Ivo never treats inferred memory as canonical business data.
- Users can inspect, correct, export, and delete remembered preferences.
- Client-specific memory cannot leak into another client context.

### Phase 8 — Evaluation, rollout, and continuous improvement

Goal: release Ivo based on measured reliability, not demos.

Deliverables:

- Offline regression suite and seeded test workspaces.
- Production feedback controls on answers, suggestions, and actions.
- Shadow/canary rollout for router, prompts, models, and automation recipes.
- Quality dashboard by capability, provider/model, plan, and failure class.
- Incident playbook and provider kill switches.

Exit criteria:

- Critical action scenarios meet 100% policy/approval compliance.
- Intent and tool selection meet agreed thresholds on the golden set.
- Grounded numeric answers meet 100% factual consistency on seeded workspaces.
- Rollback can disable a capability without disabling the entire assistant.

## Initial capability matrix

| Capability | Current behavior | Required policy |
| --- | --- | --- |
| Business Q&A | Read-only aggregate snapshot | Run immediately; cite internal source/as-of |
| Lists/search | Special-case server actions | Run immediately; ownership and pagination |
| Create client/project/time | Pre-create confirmation | Keep; add idempotency and execution receipt |
| Create invoice/contract/welcome doc | Draft record is created before final approval/send | Define a consistent draft policy; disclose draft creation and support cancellation cleanup |
| Mark invoice paid | One-tap row action | Explicit confirmation because it changes financial state |
| Email/WhatsApp/send/publish | Mixed confirmation flows | Always server-gated explicit approval or narrow recipe policy |
| Bulk overdue reminders | Conversational yes/no then send | Preview recipients/count, dedupe, approval receipt, partial-failure report |
| Automation suggestions | Computed on dashboard load; prompt injection on click | Persist/evaluate/dedupe; execute a typed plan through the action engine |

## Recommended implementation order

Complete Phase 0 before expanding features. Then deliver Phases 1–3 as the core runtime, context, and action foundation. Build real automations in Phase 4 only after typed tools and approval policies exist. Phases 5–7 should reuse that foundation. Phase 8 runs throughout and becomes the release gate.

Do not add more page-specific regex routes or prompt-only automation actions during this rebuild; each one increases divergence from the target runtime.
