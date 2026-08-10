# Ivo AI Companion: Audit and Delivery Roadmap

Status: durable runtime, grounded retrieval, enforced tool policy, execution receipts, and embedded-generation foundations are implemented; automation and proactive-companion phases remain

Current slice: action confirmations now preserve the exact prompt that produced their preview, so clicking the card button or typing “Confirm” executes the same immutable action instead of tripping the preview-hash guard. Saved conversations from before this change recover the originating user instruction, confirmation cards are persisted canonically from their first render, and consumed or superseded cards become visibly inert. This applies to every approval-gated creation flow, including meetings, clients, projects, and time entries.

Conversation history: the panel now lists the user's 20 most recent Ivo conversations and can safely reactivate an archived thread. Switching flushes the current workflow state, waits for queued message writes, rereads the selected conversation's canonical blocks, and resets all transient draft and approval state before restoration.

Activity timeline: each conversation now exposes a user-owned audit view combining model read provenance with mutation receipts. It shows empty and unavailable reads honestly, distinguishes approval waits from execution, links completed actions to canonical records, and never treats an unknown ledger state as success.

Proactive companion: Ivo now detects high-value moments and prepares bounded email drafts for overdue or due-soon invoices, stale proposals, expiring contracts, and fresh leads. Drafts are previewed in the Today surface; sending and dismissal are conversation-bound audited tools, delivery requires the explicit “Approve & send” control, retries are idempotent, and every source query is explicitly owner-scoped in addition to RLS.
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
- Phase 1 slice 20: refinement, delivery, status-change, share-preparation, and template-save tools now return their own typed response descriptors. `IvoToolResponseDescriptor.block` is optional so a completed send or share prepares no resumable card and cannot be replayed into a duplicate delivery on reload. Proposal-vs-contract wording and the delivery recipient are read from the canonical contract at send time rather than inferred from a preview the panel may have been holding since before the document was edited. The panel now renders cards and supplies callbacks, but authors no message kind, copy, or block identity for any tool outcome.
- Phase 1 slice 21: `global-actions.ts` is gone. Every export in a `"use server"` module is a publicly reachable endpoint, so all 33 of its exports — including `createInvoiceFromAiAction`, `emailInvoiceFromAiAction`, and `markInvoicePaidFromAiAction` — were reachable directly by any authenticated client, bypassing the action ledger, idempotency keys, and the approval gate entirely. The module is now `domain-operations.ts`, marked `server-only` with no `"use server"` directive, so its functions are reachable only through the typed tools. Two dead endpoints (`consumeAiMessageQuotaAction`, `interpretAiMessageAction`) were deleted. The nine read-only actions the panel genuinely calls are re-exposed through `read-actions.ts`, which documents the rule that mutations must not be added to it. Net effect: 22 unguarded mutation endpoints closed, and Ivo's public surface is now 9 read endpoints plus the 25 audited tools.
- Phase 1 slice 22: tool invocation moved out of the panel into `components/use-ivo-tools.ts`. Every approval, delivery, status, share-preparation, and template call previously repeated the same four steps inline — resolve the conversation, read the run id, mint or reuse a per-scope request id, release it in a `finally` — ten times over. A delivery tool invoked without a request id loses its idempotency barrier, so each copy was a place where a double-click could email a client twice; the barrier is now structural rather than remembered. The panel's `handle*` callbacks are reduced to a tool call plus rendering and hold no conversation, run, or idempotency plumbing. `stackivo-ai-assistant.tsx` is down from 3280 to 3101 lines.
- Phase 1 slice 23: `ai-workflows/actions.ts` is now `generation.ts`, marked `server-only`. Its two draft generators were `"use server"` form actions with no form callers left, so every call built a `FormData`, JSON-stringified a plain object, and had it parsed straight back out; they now take typed input directly and five round-trips are gone. Invoice delivery is sequenced server-side by a new `invoice.deliver` tool that composes the audited email and WhatsApp-share tools, so each channel keeps its own ledger attempt while a failed email stops the sequence instead of leaving the panel to report a half-completed send. The client's only remaining job is opening the share window.
- Phase 1 slice 24: project cards now continue into a grounded questionnaire chooser and an explicit client-send action. `questionnaire.send` is classified as external delivery, runs through the approval-gated Ivo ledger, binds the selected project into the attempt hash, and calls the canonical questionnaire sender. The sender independently rechecks ownership and project-client consistency, snapshots the questions into one client link, records email through the shared delivery log, and uses unique request keys at both boundaries so retries and double-clicks cannot create duplicate links or emails. The ordinary questionnaire send surfaces use the same duplicate-send protection.
- Phase 1 slice 25: questionnaire drafting is now a reviewable internal Ivo tool. From a project card, Ivo grounds a six-to-ten-question brief in the owned project and client, validates Groq's structured output, and falls back deterministically when the provider is missing or invalid. Draft creation is idempotent in both the Ivo ledger and canonical questionnaire table, consumes the normal Ivo usage budget, and persists a context-bound result card that rereads the owned questionnaire and project on resume. The card displays every question, links to the editor, and keeps external delivery behind the separate `questionnaire.send` action.
- Phase 1 slice 26: questionnaire refinement now uses a genuine preview/apply boundary. The preparation endpoint is read-only, bound to the owned Ivo run that already consumed quota, schema-validates the complete Groq proposal, and provides deterministic handling for common optional/required/remove/budget edits when the provider is unavailable. The review card renders the full before and after question sets. `questionnaire.refine` runs only after the explicit Apply control, hashes both the original and proposal, refuses stale drafts, stores no question content in the action ledger, rereads ownership, and never sends to the client.
- Phase 1 slice 27: requests such as “help me prepare a questionnaire” now short-circuit into a validated `questionnaire` runtime decision before Groq is called, preventing generic advice from replacing a workspace action. The decision is owner-grounded, selects an already attached project when valid, otherwise renders active project cards, and then reuses the audited questionnaire draft/refine/send journey. The agent contract forbids Markdown tables and HTML in plain replies, while a shared display normalizer safely cleans legacy or non-compliant output. Five focused assertions pin the exact reported phrase, distinguish creation from informational questions, verify the pre-model route, and cover artifact-free rendering.
- Phase 1 slice 28: the shared conversation renderer now distinguishes structured assistant output from ordinary prose. Component-backed and persisted blocks receive `w-full` with a 94% assistant-column cap, so client, project, invoice, contract, proposal, questionnaire, picker, confirmation, and future data cards no longer collapse to their intrinsic button width. Plain assistant replies and user bubbles keep their existing compact 88% maximum, avoiding oversized empty chat bubbles.
- Phase 1 slice 29: assistant prose now passes through a dependency-free, safe rich-text renderer rather than appearing as raw Markdown or being flattened into an undifferentiated paragraph. The parser accepts only a bounded presentation subset and strips HTML: paragraphs, headings, emphasis, code, numbered and bulleted lists, and pipe tables. Tables are intentionally rendered as stacked data cards for the narrow companion panel instead of horizontally scrolling grids; their first field becomes the record title and remaining fields become labelled facts. Streaming output retains a cleaned plain-text fallback until the complete response can be structured. Regression coverage pins the exact project-review table and priority-list pattern reported from the live UI.
- Phase 1 slice 30: “Send reminder to Priya” and equivalent non-payment follow-up requests are intercepted before the general Groq reply path and routed into a `project_followup` decision. The server uses the named client plus recent conversation context to select the owned project, then independently rereads client ownership, project/client consistency, active status, due date, and email before creating a request-idempotent prepared action. Migration `0078_project_followup_prepared_actions.sql` adds the new artifact kind. The chat stores only its prepared-action reference and reconstructs the current ready draft on resume; resolved drafts do not regain controls. Delivery and dismissal reuse the existing approval-gated action ledger, and failed email sends release their claim for a safe retry. Payment wording remains routed separately to invoice-reminder flows.
- Phase 1 slice 31: meetings are now a first-class list entity in the runtime, persistence schema, authenticated read facade, resume hydrator, and panel renderer. “Check/show/list/review my meetings” bypasses Groq and support lookup; upcoming returns proposed meetings plus future confirmed calls, awaiting returns only meetings whose client still needs to choose a time, and all includes history. Both the initial read and conversation-resume read explicitly filter by the signed-in owner. Empty states never invent a Calendar section: they report the actual absence and offer scheduling. Proposed cards can copy the canonical booking link, confirmed cards expose the stored join link, and all cards open the real meeting record. Three focused assertions pin the reported phrase, filter variants, pre-model routing, owner scope, and card rendering.
- Phase 1 slice 32: approval integrity now survives every confirmation path. The assistant persists the exact prompt used to hash the preview and reuses it for both card-button and typed approvals, preventing a valid meeting or other create action from being rejected as changed merely because confirmation previously supplied an empty prompt. Older saved pending confirmations reconstruct that prompt from the user turn preceding their confirmation card. Cards are canonical persisted blocks immediately, and once consumed, cancelled, or superseded their controls are disabled instead of allowing stale repeat attempts. Three focused assertions cover prompt continuity, legacy recovery, and stale-card behavior.
- Phase 2 slice 1: the dashboard group layout no longer loads 200 clients and 200 projects on every authenticated page render. Those lists existed solely to populate Ivo's pickers, but a picker cannot appear until the panel is opened and a message is sent, so every navigation paid two queries and shipped the serialised lists in HTML that most page views never used. `listIvoPickerOptionsAction` fetches them once on first open and returns an `asOf` stamp; `DashboardShell`, `TopNav`, and `StackivoAiAssistant` all shed the props. The tool consuming a picked id still rechecks ownership, so a record deleted after the read fails there rather than silently succeeding.
- Phase 2 slice 2: every agent read tool now returns a `retrieval.ts` envelope carrying `status`, `source`, `scope`, `asOf`, `count`, and `truncated`. Two defects were closed. First, a failed read used to hand the model a bare `{ error }` while "no rows" handed it `{ rows: [] }`, with nothing forcing the distinction — a model reading a timeout as "you have no overdue invoices" gives a confident, wrong, financially material answer. `ok` / `empty` / `unavailable` are now mutually exclusive and the system prompt states that `unavailable` must never be reported as absence. Second, `clip()` stringified the payload and sliced it at 6000 characters with an ellipsis appended, so any result over the budget reached the model as syntactically invalid JSON (verified: `Unterminated string in JSON at position 6012`) and anything "read" past the cut was invention. Truncation now drops whole records, keeps the payload parseable, and reports the loss via `truncated` so the model offers to narrow the search. Covered by 13 assertions over the envelope's size, status, and provenance behaviour.
- Phase 2 slice 3: grounded numeric answers now fail honestly. `getBusinessFacts` carries an `asOf` timestamp (a date alone cannot express how current a live receivables figure is), and `answerBusinessQuestionAction` no longer lets a failed analytics read propagate as an opaque error or, worse, answer anyway from a partial snapshot — every figure in that reply is supposed to come from it. `getAssistantSuggestions` degrades to no chips rather than throwing, since each chip quotes a real number.
- Phase 2 slice 4: product/policy answers are served from `knowledge.ts`, a versioned index of structured articles, replacing the runtime read of `.tsx` page sources and the regex chain that stripped JSX out of them. That approach depended on `src/**` being present in the deployed bundle — on serverless it usually is not, so the documented "fallback" was in practice the primary path, and nobody could see what the regexes did to the prose. Articles carry `id`, `title`, `url`, and `section`; the set carries `KNOWLEDGE_VERSION`; retrieval returns the standard envelope so "no article covers this" is distinguishable from a failed lookup. The model is instructed that on `empty` or `unavailable` it must not state a Stackivo feature, price, refund term, tax position, or data-handling claim from memory. Returned citations are filtered against what was actually retrieved, so a hallucinated article id cannot become a source label the user is unable to verify. Covered by 20 assertions including off-topic questions declining rather than surfacing loosely-related product text.
- Phase 8 slice 1: `npm run eval` runs 53 deterministic cases across 13 suites, covering the retrieval envelope, knowledge routing, and the runtime planner. The harness adds no dependencies — Node's built-in `node:test` and native type stripping, plus a small resolver hook in `scripts/` that supplies the file extension the app's `bundler` module resolution lets us omit and maps the `@/` alias. `--conditions=react-server` makes `import "server-only"` a no-op so the real server modules load unchanged. These are the pure decision functions only: routing, retrieval shaping, and knowledge lookup run with no model call, no database, and no network, so a failure is always real. Two of the cases exist because the behaviour they pin was broken in review (payload truncation corrupting JSON; common words matching every knowledge article). Injection cases here prove only that the deterministic layers cannot be steered — whether the model honours its instructions is a separate, model-backed test that still needs credentials and seeded workspaces.
- Phase 8 slice 2: `nlu.eval.ts` covers intent routing, entity resolution, Indian money formats, and multi-turn follow-ups through the public `interpretMessage`. Because `generateStructuredJson` returns null without attempting a request when no provider key is set, a default run exercises the deterministic fallback — the path every user hits whenever the provider is down, rate-limited, or returns unparseable JSON, and which until now had no coverage at all. `GROQ_API_KEY=... npm run eval` runs the same cases against the model. 70 cases total.
- **Bug found by slice 2**: the deterministic fallback routed "draft a proposal" to the **contract** workflow. `matchWorkflowKeyword` grouped `proposal` into the contract family, so a provider outage silently downgraded a proposal request into a contract — wrong document type, wrong template, sent to a client. The agent's system prompt has always instructed the model that "a proposal is its OWN task", but the fallback contradicted it. Proposals now match first, and also recognise "quote", "quotation", and "estimate".
- Phase 8 slice 3: `workflow.eval.ts` covers field sequencing — the logic that decides which question Ivo asks next and when it stops asking and invokes the create tool. Every workflow is walked to completion under a loop guard, so a sequence that re-asks a field or never terminates fails loudly rather than stranding a user mid-conversation. Also pinned: the deliberate no-client and no-project sentinels are not re-asked, a time entry still demands a project after its sequence completes, zero and unparseable amounts count as unanswered while Indian shorthand ("50k", "2.5 lakh", "1 crore") does not, export invoices are told they are zero-rated rather than shown a GST note, and a sequenced tool call carries the caller's request id as its idempotency key. 94 cases total across 5 suites.
- Phase 3 slice 1: `tool-registry.ts` declares all 22 tools in one table — risk class, approval requirement, ledger policy label, and whether success must be verified by rereading canonical data. Previously a tool's policy was implied by which runner it happened to call, so answering "which tools can send something to a client?" meant reading 2,000 lines and inferring from call sites; a safety property that cannot be enumerated cannot be audited. The table is load-bearing rather than documentation: the runners now read `policy` from it instead of hardcoding a string, `ivoToolSpec` throws on an unknown key rather than defaulting, and `runApprovedStatusTool` no longer takes a policy argument at all. `tool-registry.eval.ts` asserts that every key the runtime executes is declared, that no declared key is stale, that everything classed `external_delivery` or `financial` requires explicit approval, that only draft creation and refinement are exempt, and that each risk class uses one ledger label. The completeness check reads the identifier each runner is called with rather than filtering by the registry — filtering would have made it vacuous, since an undeclared key would simply not match. 106 cases total across 6 suites.
- Phase 3 slice 2: the registry is now enforced, not just consulted. `approval_state` on every ledger insert is derived via `ivoToolApprovalState` instead of being hardcoded per runner, and each of the six runners calls `assertIvoToolPath` before writing anything — so a tool whose declared risk disagrees with the path it is executing on throws rather than recording an audit row that misdescribes what happened. The realistic failure this catches is not someone deciding to skip approval; it is a new delivery tool being added alongside the draft helpers because they looked similar. Six further eval cases assert the enforcement itself: every approval-required tool is rejected on the draft path, every draft tool is rejected on the approved path, each is permitted on its own, every runner is wired to the guard, and no ledger insert carries a hardcoded approval state. Updates are deliberately exempt — the confirmation path legitimately transitions a row from `required` to `approved` once the user confirms. 112 cases across 6 suites.
- Phase 3 slice 3: execution receipts. `receipts.ts` renders a ledger row as something the user can actually read — what was done, whether it needed their approval, and a link to the affected record. The link is the point: an assistant that says "done" and cannot show you what it touched is asking to be trusted, while one that hands you the record is letting you check, and for anything financial or externally delivered only the second is acceptable. `listIvoReceiptsAction` reads them user-scoped, and reports a failed read distinctly so the caller never renders an empty audit trail when the query broke. Entities with no detail page resolve to `null` rather than a dead link, and an unrecognised ledger status reports as `failed` rather than defaulting to success — defaulting the other way would let a corrupted state read as "done" in the one place the user goes to verify. 124 cases across 7 suites.
- Phase 3 slice 4: proposal and meeting creation now enter the same enforced tool engine as every other workspace mutation. Proposal drafts are claimed idempotently, verified by rereading the canonical proposal, persisted as resumable result cards, and rolled back if their required first line item fails. Meeting creation is classified as external delivery because the underlying operation immediately attempts to email the booking link; Ivo now shows the topic, client, duration, and delivery destination and waits for explicit approval before creating or emailing anything. Both actions produce execution receipts, and the completeness eval now compares the planner's full executable tool list against the registry so a future bypass cannot hide behind a bespoke action wrapper.
- Phase 6 slice 1: the embedded-generation core. `text-diff.ts` is a word-level LCS diff, and `field-generation.ts` is the shared contract behind smart fields — six operations (generate, improve, shorten, expand, soften, sharpen) across eight field kinds, each with its own drafting guidance and length budget. One rule shapes the design: generation never mutates. Every call returns a proposal carrying the original, the suggestion, and the diff between them; there is deliberately no applied value on the result, because a field component handed a replacement string has already lost the ability to honour "never overwrite without explicit apply". Untrustworthy output is refused rather than shown — empty responses would blank the field, over-budget responses would be truncated mid-sentence, and "shorten" on an empty field would silently become "generate". Every instruction forbids inventing figures, dates, and commitments, and tells the model to treat field content as material to work on rather than instructions to follow, since a client's brief is routinely pasted into these fields.
- **Bug found while building slice 1**: the first diff tokenizer kept whitespace attached to words, so `"three"` and `"three "` were different tokens and appending text marked the preceding word as changed. Round trips were still exact, but the user was shown more red and green than had actually changed — which quietly erodes the point of reviewing a diff at all. Whitespace is now its own token.
- Phase 6 slice 2: `generateFieldAction` and the `SmartField` component. The action is read-and-draft only — it never writes to a workspace record, which is what keeps this surface outside the tool registry's approval machinery; nothing here can send, publish, or change money, and a future field operation that needs to persist belongs behind the policy gate instead. Brand voice is derived from the business's own tagline and intro rather than a tone setting nobody fills in, and client/project ids are ownership-filtered before any name reaches a prompt. Only names are passed as context — never amounts, dates, or document bodies — so the model cannot restate a figure it was never asked about. The component renders the proposal as tracked changes with removed text struck through rather than hidden, since the user is deciding whether to lose it, and Undo restores the exact prior text so an applied suggestion is never a one-way door.
- **Smart fields are live in the work**: welcome-document content and every contract clause now expose generate, improve, shorten, expand, warmer, and sharper controls. Suggestions render as tracked changes, apply only after explicit review, and can be undone; client/project ids are ownership-checked before they are used as drafting context.
- **Phase 1 exit criteria met.** A conversation survives reload and navigation; replaying a request cannot duplicate a record or delivery; all Ivo entry points use the same runtime; the UI contains no domain mutation logic and no independent intent router. Ivo's public surface is 9 read endpoints, 26 audited tools, and 12 conversation/memory/prepared-action endpoints — down from a surface that also included 33 ungated domain actions and 2 generation actions.

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
