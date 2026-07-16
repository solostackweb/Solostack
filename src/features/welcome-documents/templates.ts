import type { WelcomeDocumentTemplate } from "./types";

/**
 * Built-in, ready-to-send welcome/onboarding templates.
 *
 * These are written as polished, human, client-facing prose so a freelancer
 * can pick one, fill the few [bracketed] placeholders, and send it the moment
 * a client is onboarded. They are deliberately TWO-SIDED — they reassure the
 * client (what they get, who to contact, what happens next) while quietly
 * protecting the freelancer (scope, revisions, payment terms, boundaries).
 *
 * Placeholders use [square brackets] so they're easy to spot and replace.
 * Bodies are Markdown (the renderer supports bold/italic/lists/links).
 *
 * Shared between the manual "New document" template grid and the AI assistant.
 */
export const BUILTIN_WELCOME_TEMPLATES: WelcomeDocumentTemplate[] = [
  {
    id: "__builtin_freelancer",
    title: "Freelancer Onboarding",
    description:
      "A warm, complete onboarding pack for a new freelance client — what to expect, how you'll communicate, timeline, feedback rules, payment terms, what you need from them, and next steps.",
    intro:
      "Welcome aboard, and thank you for trusting me with your project — I'm genuinely excited to get started! I've put together this short guide so you know exactly how we'll work together, what to expect from me, and what I'll need from you. A few minutes now will save us both time later. If anything here isn't clear, just reply and ask.",
    category: "Freelancing",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "What You Can Expect From Me",
        body: "My job is to make this easy and get you results you're proud of. That means:\n\n- **Clear communication** — you'll never be left wondering where things stand.\n- **Reliable delivery** — I treat your deadlines as my own.\n- **Honest advice** — if I think there's a better approach, I'll say so.\n- **Quality work** — delivered to the standard we agreed, on time.",
      },
      {
        id: "s_2",
        heading: "How We'll Communicate",
        body: "Good communication keeps a project calm and on track. Here's how I keep us in sync:\n\n- **Main channel:** [email / WhatsApp / Slack — your choice]\n- **My working hours:** [e.g. Mon–Fri, 10am–6pm IST]\n- **Response time:** I reply within [one business day], usually sooner.\n- **Progress updates:** A short note from me at each milestone, so there are no surprises.\n\nFor anything urgent, [message me on WhatsApp and mark it urgent].",
      },
      {
        id: "s_3",
        heading: "Project Scope & Deliverables",
        body: "Here's what this engagement covers, so we're aligned from day one:\n\n- **Deliverables:** [list the key deliverables — e.g. 5-page website, logo, 3 social templates]\n- **Format:** [final files in Figma, PDF, source files, etc.]\n- **Not included:** [anything explicitly out of scope, e.g. copywriting, hosting]\n\nIf you'd like something added later, no problem at all — I'll simply quote it before starting so your budget stays in your control.",
      },
      {
        id: "s_4",
        heading: "Timeline & Milestones",
        body: "Once we've confirmed the scope, here's how the work will flow:\n\n1. **Kickoff** — [date] — we align on goals and I collect what I need.\n2. **First draft / concept** — [date or “within X days”].\n3. **Review & revisions** — your feedback, then refinements.\n4. **Final delivery** — [date].\n\nTimelines depend on getting feedback and materials on time — if something slips on either side, let's flag it early so we can adjust together.",
      },
      {
        id: "s_5",
        heading: "Feedback & Revisions",
        body: "Your feedback is what makes the work great, so I build review rounds into the process.\n\n- **Revisions included:** [2] rounds per deliverable.\n- **For the best result:** gather your feedback into a single, consolidated message rather than sending it piecemeal — it's faster and keeps the work consistent.\n- **Be specific:** “make the headline bolder and warmer” helps more than “make it pop.”\n- **Bigger changes:** anything beyond the agreed direction is quoted separately first — never a surprise.",
      },
      {
        id: "s_6",
        heading: "Payments & Invoicing",
        body: "I like to keep the money side simple and predictable:\n\n- **Fee:** [amount and currency or rate]\n- **Schedule:** [e.g. 50% upfront to book the work, 50% on delivery]\n- **Invoices:** sent through Stackivo so you always have a clean record.\n- **Payment terms:** due within [14] days of the invoice date.\n- **Methods:** [UPI / bank transfer / Wise / PayPal / card link].\n\nWork on the next stage begins once the relevant payment is received. If an invoice ever needs explaining, just ask.",
      },
      {
        id: "s_7",
        heading: "What I'll Need From You",
        body: "To keep things moving quickly, it helps to have these early:\n\n- [Brand assets — logo, fonts, colours]\n- [Content, copy, images, or product details]\n- [Logins or access to any tools/accounts I'll need]\n- [A single point of contact for approvals]\n\nThe sooner I have these, the smoother (and faster) everything goes.",
      },
      {
        id: "s_8",
        heading: "Files, Ownership & After Delivery",
        body: "Once the project wraps and final payment is received:\n\n- **You own** the final approved deliverables for the agreed use.\n- **Source files:** [included / available on request / quoted separately].\n- **Backups:** please save your own copy — I archive completed projects [90] days after delivery.\n- **Support:** [X days] of minor tweaks are included after delivery; ongoing support is available on a [retainer / hourly] basis.",
      },
      {
        id: "s_9",
        heading: "Next Steps",
        body: "Let's get started:\n\n1. Have a quick read through this guide and reply with any questions.\n2. Send over the items listed in **“What I'll Need From You.”**\n3. Confirm our kickoff date: [date].\n\nThank you again for the opportunity — I'm looking forward to doing great work together. 🙌\n\n— [Your name]",
      },
    ],
  },
  {
    id: "__builtin_agency",
    title: "Agency Client Welcome",
    description:
      "For an agency onboarding a new retainer or project client — introduces the team and points of contact, the process, approvals, scope control, billing, and the first sprint.",
    intro:
      "Welcome to [Agency Name] — we're genuinely excited to get started! This guide explains how we run engagements so the work feels smooth, transparent, and productive from day one. It covers who you'll be working with, how we communicate, how approvals and billing work, and what happens next. Your account lead is always one message away if anything needs clarifying.",
    category: "Agency",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "Welcome Aboard",
        body: "Thank you for choosing [Agency Name]. You're now working with a team that takes ownership, communicates openly, and is genuinely invested in your results.\n\nThis document sets out the essentials so everyone starts aligned — please share it with anyone on your side who'll be involved.",
      },
      {
        id: "s_2",
        heading: "Your Team & Points of Contact",
        body: "You'll have a single, dedicated **account lead** as your main point of contact, supported by our specialists:\n\n- **Account lead:** [name] — [email] — day-to-day contact and updates.\n- **Specialists:** [design / development / content / ads] as your project needs.\n- **Escalation:** for anything urgent or sensitive, reach [name/role] directly.\n\nNo gatekeeping — you'll always know who to talk to and how fast to expect a reply.",
      },
      {
        id: "s_3",
        heading: "How We Communicate",
        body: "We keep everything visible and easy to follow:\n\n- **Project tool:** [shared board link] — track progress in real time.\n- **Weekly update:** a status summary every [Friday].\n- **Meetings:** [a fortnightly check-in call — link to follow].\n- **Response time:** within [one business day] on your chosen channel.\n- **Decisions in writing:** key decisions are recorded so there's always a clear trail.",
      },
      {
        id: "s_4",
        heading: "Scope of Work",
        body: "Here's what this engagement covers:\n\n- **Included:** [list the core deliverables / channels / monthly outputs]\n- **Retainer hours:** [X hours per month, if applicable]\n- **Not included:** [anything explicitly out of scope]\n\nThis is our shared map. If priorities shift, we'll adapt — and anything new is handled transparently (see the next section).",
      },
      {
        id: "s_5",
        heading: "Approvals & Feedback",
        body: "We batch feedback into clearly defined rounds to keep momentum high and the work consistent:\n\n1. We share a draft deliverable.\n2. You consolidate feedback into a single response.\n3. We incorporate it and return for final sign-off.\n\n- **Turnaround:** please allow [X business days] for our drafts and aim to return feedback within [X days].\n- **Approver:** [name] has final sign-off, so we always know whose word is final.\n\nPrompt approvals are the single biggest factor in hitting deadlines.",
      },
      {
        id: "s_6",
        heading: "Change Requests & Extra Work",
        body: "Anything outside the agreed scope — new deliverables, extra revision rounds, rush turnarounds — is quoted and approved **in writing before work begins.**\n\nThis keeps your budget predictable and avoids any awkward surprises on the invoice. We'll always tell you the cost and timeline impact up front.",
      },
      {
        id: "s_7",
        heading: "Billing & Reporting",
        body: "We keep billing clean and easy for your finance team:\n\n- **Retainers:** invoiced on the [1st] of each month, with a detailed activity report attached.\n- **Project work:** billed at agreed milestones.\n- **Payment terms:** net [15] days via [UPI / bank transfer / Wise / PayPal / card link].\n- **Breakdown:** every invoice includes a line-by-line summary.\n\nQuestions about any invoice? Your account lead will walk you through it.",
      },
      {
        id: "s_8",
        heading: "First 30 Days & Next Steps",
        body: "Here's how we'll start strong:\n\n1. **Kickoff call** — [date] — align on goals, success metrics, and priorities.\n2. **Access & assets** — you share [brand guidelines, logins, prior materials].\n3. **First sprint** — we deliver [the first milestone] by [date].\n4. **Review** — we present, gather feedback, and plan the next cycle.\n\nTo begin, please review this guide and confirm the kickoff date. Welcome again — let's build something great together.",
      },
    ],
  },
  {
    id: "__builtin_consultant",
    title: "Consultant Welcome Pack",
    description:
      "A polished welcome guide for consultants and advisors — sets context on objectives, ways of working, confidentiality, deliverables, decision-making, fees, and kickoff.",
    intro:
      "Thank you for bringing me on board — I'm looking forward to a focused, productive engagement. This short pack explains how I structure my work so we reach a strong outcome efficiently and with no ambiguity. It covers our objectives, how we'll work together, confidentiality, deliverables, and fees. Please skim it and flag anything you'd like to adjust before we begin.",
    category: "Consulting",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "Engagement Overview",
        body: "My role is to help you achieve [the objective set out in the proposal] with clear thinking, candid advice, and practical recommendations you can act on.\n\nI keep engagements tightly focused on the outcomes that matter most to you — and I measure success by the decisions and results they enable, not the volume of slides produced.",
      },
      {
        id: "s_2",
        heading: "Objectives & Success Criteria",
        body: "So we both know what “done well” looks like, this engagement aims to:\n\n- [Objective 1 — e.g. a validated go-to-market plan]\n- [Objective 2 — e.g. a prioritised roadmap for the next two quarters]\n- [Objective 3]\n\n**Success looks like:** [the specific, measurable outcome you want]. If your priorities shift during the work, we'll revisit these together.",
      },
      {
        id: "s_3",
        heading: "How We'll Work Together",
        body: "A simple, predictable rhythm keeps things on track:\n\n- **Cadence:** [weekly] working sessions of [60 minutes], plus async updates.\n- **Access:** I'll request any data, systems, or stakeholder time I need in writing, ahead of time.\n- **Decisions:** [name] is my primary point of contact and decision-maker.\n- **Blockers:** I surface risks and dependencies early — never at the last minute.",
      },
      {
        id: "s_4",
        heading: "Confidentiality & Independence",
        body: "Everything shared during our engagement is treated as strictly confidential. I operate under NDA terms and never share your information with third parties.\n\nMy advice is independent and in your best interest — if I have any conflict or commercial relationship relevant to the work, I'll disclose it. I'd ask for the same discretion in return, particularly around unreleased strategy or financial data.",
      },
      {
        id: "s_5",
        heading: "Deliverables & Timeline",
        body: "The specific deliverables and dates are set out in the proposal. At a glance:\n\n- [Deliverable 1] — [date]\n- [Deliverable 2] — [date]\n- **Final readout / recommendations** — [date]\n\nI'll confirm receipt of any inputs I need from you and keep you updated as each milestone approaches. If a date is ever at risk, you'll hear it from me early, with options.",
      },
      {
        id: "s_6",
        heading: "Fees & Invoicing",
        body: "Fees follow the structure agreed in the proposal:\n\n- **Fee / rate:** [amount and currency — fixed fee / day rate / retainer]\n- **Schedule:** [e.g. 50% to commence, 50% on final delivery]\n- **Invoices:** sent through Stackivo; payment terms net [14] days.\n- **Expenses:** [pre-approved expenses billed at cost, if applicable].\n\nQuestions about any invoice are always welcome.",
      },
      {
        id: "s_7",
        heading: "Next Steps",
        body: "To get underway:\n\n1. Review this welcome pack and flag any edits.\n2. Book our kickoff call: [link / date].\n3. Share the background documents and access listed in the brief.\n\nI'll send a short agenda 24 hours before we meet so the first session is productive. Looking forward to getting started.\n\n— [Your name]",
      },
    ],
  },
  {
    id: "__builtin_designer",
    title: "Designer onboarding",
    description:
      "A premium welcome packet for design clients - covers process, communication, revisions, and approvals.",
    intro:
      "Welcome aboard! I'm thrilled we're working together on your project. This guide walks you through how I work, what to expect at each stage, and how we'll communicate. Read this once at the start - it answers the questions clients usually ask along the way.",
    category: "Designer",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "How we'll work together",
        body: "Every project follows the same four phases: Discovery, Design, Refinement, and Delivery. You'll always know which phase we're in and what comes next. I block focused design time in the mornings and reserve afternoons for client communication and reviews.",
      },
      {
        id: "s_2",
        heading: "Communication & response times",
        body: "Email is the primary channel for anything that needs a paper trail. For quick questions, the Client Portal comments thread is faster. I respond within one business day (Mon-Fri, IST). I don't check messages on weekends - please don't expect replies until Monday.",
      },
      {
        id: "s_3",
        heading: "The revision flow",
        body: "Each design round includes two rounds of revisions. Please consolidate feedback from your team before sending - it keeps momentum and avoids contradictory edits. Use comments directly on the Figma file or attach screenshots in the portal.",
      },
      {
        id: "s_4",
        heading: "Project stages & milestones",
        body: "You'll see status changes in your portal as we move through the project. Each milestone requires your written approval before we proceed. This protects both of us.",
      },
      {
        id: "s_5",
        heading: "Approvals",
        body: "Approvals happen in writing - either in the portal comments or by email. A simple \"Approved\" or \"Approved with comments below\" is enough. Verbal approvals on calls always need a follow-up confirmation in writing.",
      },
      {
        id: "s_6",
        heading: "Payments",
        body: "You'll receive invoices via email and inside your portal. Payment is via [UPI / bank transfer / Wise / PayPal / card link] unless we agree otherwise. Invoices are due within [7] days. The kickoff payment locks in your project slot - design work begins after it clears.",
      },
      {
        id: "s_7",
        heading: "Files & deliverables",
        body: "All working files, exports, and brand assets live in your portal. Final deliverables are pushed to a dedicated folder labelled \"Final\". You'll get full ownership of the deliverables once the final invoice is paid.",
      },
      {
        id: "s_8",
        heading: "What I need from you",
        body: "To keep things moving: prompt feedback within [3] business days of each delivery, consolidated team feedback, and clear approval at each milestone. The smoother this loop, the faster we ship.",
      },
      {
        id: "s_9",
        heading: "If something goes wrong",
        body: "If you're unhappy with anything - pace, direction, communication - please tell me directly. I'd rather adjust mid-project than disappoint you at delivery. The same goes for me: I'll flag risks early.",
      },
      {
        id: "s_10",
        heading: "Let's begin",
        body: "Once you've read this, drop a comment in your portal so I know we're aligned. I'm looking forward to a great project together.",
      },
    ],
  },
  {
    id: "__builtin_developer",
    title: "Developer onboarding",
    description:
      "For software / web development engagements. Sets ground rules around scope, code reviews, deployments, and bugs.",
    intro:
      "Welcome to the project! This guide explains how I run development work - sprint cadence, code reviews, deployments, bug handling, and what counts as in-scope vs out-of-scope. Skim this once now; you can always come back to it.",
    category: "Developer",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "Engagement model",
        body: "This project runs in focused sprints. At the start of each sprint we agree on a small, shippable scope. At the end of the sprint you'll receive a demo and a written changelog. Anything that doesn't fit moves to the next sprint.",
      },
      {
        id: "s_2",
        heading: "Communication",
        body: "Slack, WhatsApp, or portal comments work best for quick questions. Email is for anything that needs a record. I respond during business hours, Mon-Fri 10:00-18:00 IST. Urgent issues should be flagged clearly.",
      },
      {
        id: "s_3",
        heading: "What counts as in scope",
        body: "In scope means the user stories agreed for the current sprint or milestone. Out of scope means anything that emerges later and wasn't in the original plan. Out-of-scope items go into the backlog and are quoted before work begins.",
      },
      {
        id: "s_4",
        heading: "Code reviews & quality",
        body: "Every meaningful change goes through review. I follow clear commit messages, write tests for new logic where appropriate, and run the linter and type-checker before shipping.",
      },
      {
        id: "s_5",
        heading: "Deployments",
        body: "Code ships behind a feature flag where possible. Production deployments happen during agreed windows. After each deploy I send a short note with what changed and how to verify it.",
      },
      {
        id: "s_6",
        heading: "Bugs vs new work",
        body: "A bug is something that was agreed, built, and is not working as intended. A new feature, even a small one, counts as new work and goes through planning. This distinction keeps timelines and budgets fair.",
      },
      {
        id: "s_7",
        heading: "Access & credentials",
        body: "I'll need invite-only access to the repo, hosting, database, and third-party APIs in use. Please use a password manager or secure invite flow - never paste secrets in chat. Access can be rotated at project end.",
      },
      {
        id: "s_8",
        heading: "Payments",
        body: "Sprint or milestone work is invoiced as agreed and due within [5-7] days. The next sprint starts once the previous invoice is paid unless we agree otherwise in writing.",
      },
      {
        id: "s_9",
        heading: "Handoff & ownership",
        body: "All approved code is yours and is pushed to your repo. At project end I provide notes covering how to run, deploy, and extend the codebase.",
      },
      {
        id: "s_10",
        heading: "Ready to begin",
        body: "Reply in your portal once you've read this - that's our handshake to kick off the first sprint.",
      },
    ],
  },
  {
    id: "__builtin_writer",
    title: "Writer / content creator onboarding",
    description:
      "For copywriting, content strategy, and editorial engagements.",
    intro:
      "Welcome - I'm excited to work on this with you. Writing is collaborative, and the smoother our process, the better the words. This guide explains how I work end-to-end so you know what to expect.",
    category: "Writer",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "Our writing process",
        body: "Every piece goes through five steps: Brief, Outline, Draft, Revisions, and Polish. You approve at the Brief and Outline stages so we're aligned before I draft.",
      },
      {
        id: "s_2",
        heading: "Briefs",
        body: "For each piece, I'll send a short brief covering audience, goal, tone, key takeaways, length, and SEO targets if relevant. You confirm or tweak before I outline.",
      },
      {
        id: "s_3",
        heading: "Revisions",
        body: "Each piece includes two revision rounds. Please consolidate edits from your team into one document - fragmented feedback from multiple stakeholders is the main cause of slow turnaround.",
      },
      {
        id: "s_4",
        heading: "Tone & voice",
        body: "During discovery I'll capture your brand voice in a short style guide. Once approved, every piece references it. If your voice evolves mid-project, just tell me.",
      },
      {
        id: "s_5",
        heading: "Turnaround",
        body: "Typical turnaround is [3-5] business days for long-form pieces and [2] days for shorter copy. Rush jobs are possible at a surcharge, agreed in writing first.",
      },
      {
        id: "s_6",
        heading: "Communication",
        body: "Email works best for briefs and final deliverables. Portal comments work for in-progress questions. I don't take edits over phone calls - always send edits in writing.",
      },
      {
        id: "s_7",
        heading: "Approvals",
        body: "Each piece needs written approval before it's considered final and invoiced. \"Approved\" in the portal or email is enough. Once approved, future edits are out of scope.",
      },
      {
        id: "s_8",
        heading: "Ownership & credit",
        body: "You own all final approved content. I retain the right to mention the engagement in my portfolio without internal or confidential details unless we agree otherwise.",
      },
      {
        id: "s_9",
        heading: "Payments",
        body: "Per-piece or monthly retainer work is invoiced as agreed. Payment is via [UPI / bank transfer / Wise / PayPal / card link] and due within [7] days. Final delivery happens after the invoice clears for one-off projects.",
      },
      {
        id: "s_10",
        heading: "Let's begin",
        body: "Review this guide in your portal and I'll send across the first brief within 24 hours.",
      },
    ],
  },
  {
    id: "__builtin_generic_freelancer",
    title: "Generic freelancer onboarding",
    description:
      "A neutral, all-purpose onboarding guide. Edit any section to match your craft.",
    intro:
      "Welcome! I'm glad we're working together. This document covers the practical side of our engagement - how I communicate, how revisions and approvals work, and what to expect at each stage. A 5-minute read now saves us both time later.",
    category: "General",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "How we'll work together",
        body: "Every engagement runs through the same shape: Discovery, Work, Review, and Delivery. I'll let you know which stage we're in and what's next.",
      },
      {
        id: "s_2",
        heading: "Communication",
        body: "I respond within one business day, Monday to Friday. For routine updates use the portal comments; for anything formal, use email. I don't reply on weekends or public holidays.",
      },
      {
        id: "s_3",
        heading: "Project stages",
        body: "You'll see status updates as we move through the work. Each stage has a clear deliverable and approval gate before we move on.",
      },
      {
        id: "s_4",
        heading: "Revisions",
        body: "Each round includes [two] revision passes. Send consolidated, written feedback. After the included rounds, additional revisions are billed at my hourly rate.",
      },
      {
        id: "s_5",
        heading: "Approvals",
        body: "Approvals happen in writing - either in the portal or by email. \"Approved\" is enough. Approvals on calls need a follow-up confirmation.",
      },
      {
        id: "s_6",
        heading: "Payments",
        body: "Invoices are sent via email and the portal. Payment is due within [7] days unless we've agreed otherwise. Work pauses if an invoice is more than [14] days overdue.",
      },
      {
        id: "s_7",
        heading: "What I need from you",
        body: "Quick decisions, consolidated feedback, and a clear single point of contact on your side. The fewer hands the work passes through, the better the outcome.",
      },
      {
        id: "s_8",
        heading: "If anything goes wrong",
        body: "Tell me. I'd rather hear \"this isn't working\" early than discover it at delivery. Same goes for me - I'll flag risks the moment I see them.",
      },
      {
        id: "s_9",
        heading: "Ready when you are",
        body: "That's everything. Review this in the portal and we'll get started.",
      },
    ],
  },
  {
    id: "__builtin_marketing",
    title: "Marketing / SEO client welcome",
    description:
      "For marketing, growth, and SEO engagements — sets expectations on channels, reporting, approvals, and realistic timelines.",
    intro:
      "Welcome aboard — I'm excited to start growing [Brand]! This guide covers how we'll work together, what results to expect (and when), how we'll report, and what I'll need from you. Marketing compounds over time, so a little alignment now sets us up for a strong few months. Reply any time with questions.",
    category: "Marketing",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "What we're working towards",
        body: "Our north star for this engagement is [the goal — e.g. more qualified leads, higher organic traffic, better ROAS]. Everything we do maps back to that. I focus on outcomes that move the business, not vanity metrics.",
      },
      {
        id: "s_2",
        heading: "Channels & scope",
        body: "This engagement covers:\n\n- **Channels:** [SEO / paid ads / social / email — your mix]\n- **Monthly outputs:** [e.g. content, campaign management, technical fixes]\n- **Not included:** [website builds, large content production, ad spend]\n\nAd spend and tool subscriptions are billed separately or paid by you directly.",
      },
      {
        id: "s_3",
        heading: "Realistic timelines",
        body: "Marketing needs a ramp. Paid channels show signal in [2–4 weeks]; SEO typically takes [3–6 months] to move meaningfully. I'll share early leading indicators so you can see progress before the headline numbers catch up.",
      },
      {
        id: "s_4",
        heading: "Reporting & metrics",
        body: "You'll get a clear report every [two weeks / month] covering what we did, what it drove, and what's next. We'll agree the 3–4 metrics that matter up front so reporting stays honest and focused — no dashboards for the sake of it.",
      },
      {
        id: "s_5",
        heading: "Approvals & turnaround",
        body: "For anything client-facing (ads, content, emails), I'll share drafts for approval. Please consolidate feedback into one response and return it within [2 business days] so we don't lose campaign momentum. [Name] has final sign-off.",
      },
      {
        id: "s_6",
        heading: "What I'll need from you",
        body: "To hit the ground running:\n\n- Access to [analytics, Search Console, ad accounts, CMS, social profiles]\n- [Brand assets and any existing guidelines]\n- A quick call to align on offers, audience, and priorities\n\nSecure access via [a password manager / platform invites] — please don't paste credentials in chat.",
      },
      {
        id: "s_7",
        heading: "Billing",
        body: "The retainer is invoiced [on the 1st / at kickoff] via Stackivo, payment terms net [15] days. Ad spend is separate. Work continues seamlessly as long as invoices are current.",
      },
      {
        id: "s_8",
        heading: "First 30 days",
        body: "1. **Kickoff** — align on goals, audience, and access ([date]).\n2. **Setup & audit** — tracking, baselines, quick wins.\n3. **Launch** — first campaigns/content live.\n4. **Review** — first report and plan for month two.\n\nTo begin, confirm the kickoff date and share access. Let's grow this.",
      },
    ],
  },
  {
    id: "__builtin_retainer",
    title: "Retainer client welcome",
    description:
      "For ongoing monthly retainers — explains capacity, how to request work, priorities, rollover, and billing.",
    intro:
      "Welcome, and thank you for choosing an ongoing partnership! This short guide explains how our retainer works so you get the most from it every month — how to request work, how priorities and capacity work, and how billing runs. The goal is simple: dependable, high-quality support without the overhead of a full-time hire.",
    category: "Retainer",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "How the retainer works",
        body: "Your retainer reserves **[number] hours per month** of my time for [design / development / content / marketing]. Think of it as a dedicated, flexible block you can direct at whatever matters most that month.",
      },
      {
        id: "s_2",
        heading: "Requesting work",
        body: "Send requests through [email / the client portal / project tool]. For each one I'll confirm priority, estimated effort, and expected delivery before I start — so you always know what's happening and when.",
      },
      {
        id: "s_3",
        heading: "Priorities & capacity",
        body: "At the start of each month we align on priorities. If requests exceed the monthly capacity, we'll agree what's most important; anything beyond capacity is either scheduled for next month or quoted as extra with your approval first.",
      },
      {
        id: "s_4",
        heading: "Rollover & unused time",
        body: "Unused hours [do not roll over / roll over up to [number] hours for [30] days]. This keeps the arrangement fair to both sides and my schedule reliably available to you.",
      },
      {
        id: "s_5",
        heading: "Communication",
        body: "Main channel: [email / portal]. Working hours: [Mon–Fri, business hours]. I reply within [one business day]. You'll get a short summary of delivered work at the end of each month.",
      },
      {
        id: "s_6",
        heading: "Billing",
        body: "The retainer is billed **in advance** on [the 1st / your start date] via Stackivo, payment terms net [number] days. Work pauses if payment is overdue. Cancel any time with [15] days' notice.",
      },
      {
        id: "s_7",
        heading: "What I'll need from you",
        body: "Timely briefs and assets, quick decisions, and a single point of contact. The clearer the direction, the more value you get from each month's hours.",
      },
      {
        id: "s_8",
        heading: "Getting started",
        body: "1. Confirm your start date and first month's priorities.\n2. Share access and any assets I'll need.\n3. Send your first requests — I'll confirm and get going.\n\nHere's to a smooth, productive partnership.",
      },
    ],
  },
  {
    id: "__builtin_photographer",
    title: "Photographer / creative welcome",
    description:
      "For photo and video shoots — covers the shoot process, prep, day-of logistics, editing, delivery, and usage rights.",
    intro:
      "Welcome — I can't wait to create something beautiful for you! This guide walks you through how a shoot works from start to finish: how we prepare, what happens on the day, how editing and delivery work, and how your files and usage rights are handled. A quick read now means a relaxed, well-run shoot later.",
    category: "Creative",
    isSystem: true,
    sections: [
      {
        id: "s_1",
        heading: "The process at a glance",
        body: "Every project follows four stages: **Plan → Shoot → Edit → Deliver.** You'll know exactly what's happening at each step, and I'll confirm dates and details in writing so there are no surprises.",
      },
      {
        id: "s_2",
        heading: "Before the shoot",
        body: "In the lead-up we'll confirm:\n\n- The shot list / concept and any references you love\n- Location, date, and timing\n- Wardrobe, props, or products needed\n- Anyone else involved (talent, stylists)\n\nThe more we lock in beforehand, the smoother the day runs.",
      },
      {
        id: "s_3",
        heading: "On the day",
        body: "Please allow [X hours] for the shoot at [location]. I'll bring the gear and direction; you bring [the products / people / wardrobe]. We'll work through the shot list with room for a few creative extras. Weather or availability changes are handled together, calmly.",
      },
      {
        id: "s_4",
        heading: "Editing & selection",
        body: "After the shoot I'll cull and edit the strongest frames. You'll receive [a gallery / selects] to choose your favourites, and I'll finish those to a polished standard. Editing style follows the look we agreed — natural, on-brand, and consistent.",
      },
      {
        id: "s_5",
        heading: "Delivery",
        body: "You'll receive [number] final [edited images / videos] in [formats] via [gallery / drive] within [2–3 weeks] of the shoot. One round of revisions on the selected finals is included; extra edits or additional deliverables are quoted first.",
      },
      {
        id: "s_6",
        heading: "Usage rights & files",
        body: "On full payment you receive the agreed final deliverables with **usage rights as specified** [e.g. web + social, or full commercial]. Raw/unedited files remain with me unless we've agreed otherwise. Please back up your delivered files — I archive projects [90] days after delivery.",
      },
      {
        id: "s_7",
        heading: "Payments",
        body: "A [50]% booking fee secures your date; the balance is due on delivery, via [UPI / bank transfer / Wise / PayPal / card link]. The booking fee reserves the shoot slot and covers pre-production.",
      },
      {
        id: "s_8",
        heading: "Next steps",
        body: "1. Confirm your shoot date and location.\n2. Pay the booking fee to lock it in.\n3. Share references and any details for the shot list.\n\nExcited to make something you'll love — see you on set!",
      },
    ],
  },
];
