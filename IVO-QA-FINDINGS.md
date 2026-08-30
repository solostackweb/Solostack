# Ivo QA Campaign — Findings Ledger

Live campaign, started 24 Aug 2026. Model path live (local Groq key).
Account: Akshat's real workspace. Test-created records prefixed `[QA]`.

Verdicts: BUG (broken behavior) · GAP (missing/unfinished) · IMPROVE (works, could be better) · PASS

| # | Area | Input / Surface | Expected | Actual | Verdict | Severity |
|---|---|---|---|---|---|---|

| A1-T1 | List lane | "Show my clients" | Client list card | Lane + C1 variant + card actions | PASS | - |
| A1-T2 | List lane | "Show active projects" | Active projects | "Here's what's currently in flight." + cards | PASS | - |
| A1-T3 | List lane | "Show all contracts" | All contracts | Works | PASS | - |
| A1-T4 | List lane empty | "Show pending proposals" | Honest empty | "haven't had a reply yet" + "No proposals need attention." | PASS | - |
| A1-T5 | Meeting lane | "What meetings do I have coming up?" | Honest empty | Correct | PASS | - |
| A1-T6 | Business query | "How much am I owed right now?" | Grounded figure | ?2,90,000/6 invoices, actionable | PASS | - |
| A1-T7 | Business query | "What should I focus on today?" | Prioritized focus | Named user, 2 priorities, real data | PASS | - |
| A1-T8 | Unbilled analysis | "What unbilled time should I invoice?" | Honest empty | Correct | PASS | - |
| A1-T9 | Concentration | "Who are my top clients..." | Real split | 79%/21% + advice | PASS | - |

## A2 � Creation workflows

| A2-T1 | Client creation | "Add a client called QA Test Industries..." then "skip" at optional phone | Skip optional field, continue workflow | Model cancelled the entire workflow twice: "Got it�cancelling the client creation" | BUG | HIGH |
| A2-T1b | Client creation | "skip" at optional phone (after prompt fix) | Skip + advance | Advanced to address correctly | PASS (fixed) | - |
| A2-T1c | Client creation | "skip" at REQUIRED billingAddress | Re-ask cleanly | Model stored literal "skip" as value; workflow advanced, create tool's independent check rejected it, panel said "Creating client..." while server re-asked address; no client.create ledger row ever | BUG (fixed server-side) | HIGH |

## B — Panel-direct regression sweep (26 Aug 2026, Playwright E2E, live Groq)

| B1 | Panel trigger | Top-bar "Ask Ivo" click | Panel opens docked | Opens, `data-open=true` | PASS | - |
| B2 | List lane | "Show my clients" | Client list card | 4 clients + per-card actions (Invoice/Contract/Meeting) | PASS | - |
| B3 | Meeting lane | "What meetings do I have coming up?" | Honest empty | "no upcoming or awaiting meetings right now." | PASS | - |
| B4 | Business query | "How much am I owed right now?" | Grounded figure | ₹2,90,000 across 6 invoices, overdue called out first | PASS | - |
| B5 | Suggestion chips | Click chip "Show unpaid invoices" | Sends chip as follow-up | User echo + invoice cards reply | PASS | - |
| B6→C1 | @ mention attach | Type "@" in composer | Resource picker lists clients/projects/invoices/WDs | "No matching clients…" forever. `ensurePickerOptions()` ran on open but the `listIvoPickerOptionsAction` server-action promise never settled (no resolve/reject despite HTTP 200 + valid payload on the wire; nondeterministic). **FIXED**: picker read now travels over plain `GET /api/ivo/picker-options` (route handler) inside a retrying single-flight loader (5 attempts, 6s watchdog) plus a load trigger on first "@". Verified: options render in 0.0–1.4s across repeated rounds; full pick → `@[Client]` token inserted | BUG (fixed) | HIGH |
| B7→C2 | Client creation E2E | Full flow incl. confirm | Client row inserted | Insert failed: `null value in column "locale"` — raw DB error surfaced verbatim. Root cause: AI path sent no locale and `createClientAction` wrote explicit NULL past the `en-IN` default. **FIXED**: `localeForCountry()` fallback in clients actions (+ friendly error surface instead of raw SQL). Verified E2E twice: client created via full conversational flow incl. confirm | BUG (fixed) | HIGH |
| B8 | History | Close + reopen panel | Transcript retained | 11 rows retained | PASS | - |

## C — Server-side noise observed during runs

| C-N1 | Usage metering | Every AI message | usage_counters incremented | `increment_usage(ai_messages)` → 42501 RLS violation on every single call (usage silently never counts; could break plan limits). **Fix written**: `0076_usage_counters_write_policies.sql` adds owner INSERT/UPDATE policies — needs `npx supabase db push` to take effect | BUG (fix pending push) | HIGH |
| C-N2 | Intent extraction | Long prompts | Normal routing | Groq returns 413 on intent_extraction for large prompts; retried/fell back each time | IMPROVE | LOW |

## E — Entry-point campaign ("Ask Ivo" buttons from every page)

All: click page-level button → panel opens → prompt auto-sends (~80ms) → grounded reply.

| E01 | /dashboard header | "What should I focus on today?" | Focus answer | Priorities with real figures | PASS | - |
| E02 | /dashboard/pulse | "Give me a business summary from Pulse…" | Pulse-grounded summary | Reply identical to generic daily-focus answer; no Pulse-specific metrics surfaced | IMPROVE | MED |
| E03 | /dashboard/clients | "Show my clients and tell me who I should follow up with." | List + follow-ups | Cards + actions | PASS | - |
| E04 | /dashboard/invoices | "Show my unpaid invoices…" | Unpaid list | Overdue INV cards + actions | PASS | - |
| E05 | /dashboard/projects | "Review my active projects…" | Active review | Project cards w/ status | PASS | - |
| E06 | /dashboard/contracts | "Show contracts awaiting signature…" | Awaiting-signature list | Contract cards (Draft/Live) | PASS | - |
| E07 | /dashboard/proposals | Empty-state "Ask Ivo" CTA | Draft flow starts | ClientPicker rendered correctly | PASS | - |
| E08 | /dashboard/meetings | Header "Ask Ivo" | Button visible & wired | Never rendered: `<Header calendar gated />` hardcodes `gated` (meetings-hub-view.tsx:188) hiding IvoEntryPoint + availability link — dead code | GAP | MED |
| E09 | /dashboard/time | "Review my unbilled time… don't create an invoice yet." | Unbilled-time analysis | Replied with UNPAID INVOICE cards instead of time analysis — misroute/misleading grounding when no time entries exist | IMPROVE | MED |
| E10 | /dashboard/questionnaires | Empty-state ghost CTA | Brief-questions advice | Good checklist reply | PASS | - |
| E11 | /dashboard/notifications | "Look at my recent notifications…" | Notification-grounded advice | Same as generic focus answer; notification items not visibly referenced | IMPROVE | LOW |
| E12 | /dashboard/documents | "What documents should I send a new client, and in what order?" | Advisory ordering answer | Routed into welcome-doc CREATION workflow (client picker) instead of answering | IMPROVE | MED |
| E13 | /dashboard/welcome | "Review my welcome documents…" | WD review | WD cards w/ views/status | PASS | - |

### Campaign notes
- Harness: Playwright (repo dep) + saved auth state, scripts in `%TEMP%\opencode\ivo-qa\`. Login via email/password form (Google OAuth button is broken/deleted client — clicking it goes to Google's deleted-client error).
- Dead Groq key in `.env.local` produced silent failures: every reply errored while UI kept asking field questions; replaced key mid-campaign.
- Entry-point auto-send contract verified on all 12 visible entry points: panel opens + prompt fires without extra clicks.

### Fix round (26 Aug 2026)
| File | Change |
|---|---|
| `src/features/clients/actions.ts` | `localeForCountry()` fallback on insert/update; friendly DB-error messages |
| `src/app/api/ivo/picker-options/route.ts` | NEW — GET route handler for picker options (plain JSON, no-store) |
| `src/features/ai-workflows/components/stackivo-ai-assistant.tsx` | Picker loader: single-flight with 5× retry + 6s watchdog over the GET; load also triggered on first "@" |
| `src/features/ai-workflows/evals/picker-loading-integrity.eval.ts` | Transport assertion updated to the GET endpoint (single-flight intent unchanged) |
| `supabase/migrations/0076_usage_counters_write_policies.sql` | NEW — owner INSERT/UPDATE RLS policies for usage_counters (**apply via `npx supabase db push`**) |

Verification: `tsc --noEmit` clean · eslint clean · 286/286 evals pass · E2E re-runs green for mention attach and full client creation.
