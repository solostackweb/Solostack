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
        body: "I like to keep the money side simple and predictable:\n\n- **Fee:** [₹ amount or rate]\n- **Schedule:** [e.g. 50% upfront to book the work, 50% on delivery]\n- **Invoices:** sent through Stackivo so you always have a clean record.\n- **Payment terms:** due within [14] days of the invoice date.\n- **Methods:** [bank transfer / UPI].\n\nWork on the next stage begins once the relevant payment is received. If an invoice ever needs explaining, just ask.",
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
        body: "We keep billing clean and easy for your finance team:\n\n- **Retainers:** invoiced on the [1st] of each month, with a detailed activity report attached.\n- **Project work:** billed at agreed milestones.\n- **Payment terms:** net [15] days via [bank transfer / UPI].\n- **Breakdown:** every invoice includes a line-by-line summary.\n\nQuestions about any invoice? Your account lead will walk you through it.",
      },
      {
        id: "s_8",
        heading: "First 30 Days & Next Steps",
        body: "Here's how we'll start strong:\n\n1. **Kickoff call** — [date] — align on goals, success metrics, and priorities.\n2. **Access & assets** — you share [brand guidelines, logins, prior materials].\n3. **First sprint** — we deliver [the first milestone] by [date].\n4. **Review** — we present, gather feedback, and plan the next cycle.\n\nTo begin, please acknowledge this guide and confirm the kickoff date. Welcome again — let's build something great together.",
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
        body: "Fees follow the structure agreed in the proposal:\n\n- **Fee / rate:** [₹ amount — fixed fee / day rate / retainer]\n- **Schedule:** [e.g. 50% to commence, 50% on final delivery]\n- **Invoices:** sent through Stackivo; payment terms net [14] days.\n- **Expenses:** [pre-approved expenses billed at cost, if applicable].\n\nQuestions about any invoice are always welcome.",
      },
      {
        id: "s_7",
        heading: "Next Steps",
        body: "To get underway:\n\n1. Acknowledge this welcome pack and flag any edits.\n2. Book our kickoff call: [link / date].\n3. Share the background documents and access listed in the brief.\n\nI'll send a short agenda 24 hours before we meet so the first session is productive. Looking forward to getting started.\n\n— [Your name]",
      },
    ],
  },
];
