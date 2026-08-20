import type { Metadata } from "next";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { DocsSidebar } from "./docs-sidebar";

export const metadata: Metadata = {
  title: "Documentation · Stackivo",
  description:
    "Everything you need to know about using Stackivo — invoices, contracts, client portal, AI assistant, GST, time tracking, and more.",
};

export const dynamic = "force-static";

/* ─────────────────────────────────────────────
   Sidebar nav structure
───────────────────────────────────────────── */
const NAV = [
  { id: "getting-started", label: "Getting Started" },
  { id: "clients", label: "Clients" },
  { id: "invoices", label: "Invoices" },
  { id: "contracts", label: "Contracts" },
  { id: "projects", label: "Projects" },
  { id: "time-tracking", label: "Time Tracking" },
  { id: "client-portal", label: "Client Portal" },
  { id: "welcome-documents", label: "Welcome Documents" },
  { id: "ask-ai", label: "Ask AI" },
  { id: "pulse", label: "Pulse Analytics" },
  { id: "settings", label: "Settings" },
  { id: "plans-billing", label: "Plans & Billing" },
  { id: "gst-guide", label: "GST Guide" },
  { id: "payments", label: "Payments" },
  { id: "faq", label: "FAQ & Troubleshooting" },
];

/* ─────────────────────────────────────────────
   Small reusable primitives (server-safe)
───────────────────────────────────────────── */
function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-border pb-14 pt-12 first:pt-0"
    >
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="space-y-5 text-sm leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 mb-2 text-sm font-semibold uppercase tracking-wider text-foreground/60">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground">
      {children}
    </ul>
  );
}

function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="ml-5 list-decimal space-y-1.5 text-muted-foreground">
      {children}
    </ol>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200",
    tip: "bg-success-subtle border-success-subtle text-success-strong",
    warning:
      "bg-warning-subtle border-warning-subtle text-warning-strong",
  };
  const icons = { info: "ℹ️", tip: "✅", warning: "⚠️" };
  return (
    <div
      className={`flex gap-3 rounded-lg border px-4 py-3 text-sm leading-6 ${styles[type]}`}
    >
      <span className="mt-0.5 shrink-0">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Badge({ plan }: { plan: "Pro" | "Business" }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-primary">
      {plan}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Page
───────────────────────────────────────────── */
export default function DocsPage() {
  return (
    <>
      <PageHero
        align="left"
        eyebrow="Documentation"
        title="Stackivo Help Center"
        subtitle="Everything you need to run your freelance business — invoices, contracts, projects, payments, GST compliance, AI workflows, and more. If you're stuck, this is the place to start."
      />

      <Section size="ultra" className="pb-20">
      {/* Two-column layout */}
      <div className="flex gap-12 lg:gap-16">
        {/* ── Sticky sidebar (client component, tracks scroll) ── */}
        <DocsSidebar items={NAV} />

        {/* ── Main content ── */}
        <div className="min-w-0 flex-1">
          {/* ══════════════════════════════════════
              1. GETTING STARTED
          ══════════════════════════════════════ */}
          <DocSection id="getting-started" title="Getting Started">
            <P>
              Welcome to Stackivo — your all-in-one business operating system
              built specifically for Indian freelancers. This guide walks you
              through everything from your first login to sending your first
              invoice.
            </P>

            <H3>Creating your account</H3>
            <OL>
              <li>
                Go to <strong>stackivo.me</strong> and click{" "}
                <strong>Get started free</strong>.
              </li>
              <li>Sign up with your Google account or email address.</li>
              <li>
                You&apos;ll land on the onboarding screen — it takes under two
                minutes.
              </li>
            </OL>

            <H3>Two-step onboarding</H3>
            <P>
              Stackivo&apos;s onboarding is designed to feel like a premium
              welcome, not a form. There are only two steps:
            </P>
            <OL>
              <li>
                <strong>Business setup</strong> — Enter your business name,
                profession, and currency. This populates your invoices and
                client-facing documents automatically.
              </li>
              <li>
                <strong>GST setup</strong> — If you are GST-registered, toggle
                the switch and enter your GSTIN. If you&apos;re not registered,
                leave it off — you&apos;ll still get clean, professional invoices
                without any GST lines.
              </li>
            </OL>
            <Callout type="tip">
              You can update everything you enter here later under{" "}
              <strong>Settings → Company</strong>. Nothing is locked.
            </Callout>

            <H3>Your dashboard at a glance</H3>
            <P>
              After onboarding you land on your dashboard. The main sidebar
              gives you access to:
            </P>
            <UL>
              <li>
                <strong>Clients</strong> — your full client directory
              </li>
              <li>
                <strong>Projects</strong> — active and archived project
                workspaces
              </li>
              <li>
                <strong>Invoices</strong> — create, send, and track payments
              </li>
              <li>
                <strong>Contracts</strong> — draft professional agreements on
                any plan; sending &amp; e-signature are Pro+
              </li>
              <li>
                <strong>Time</strong> — start/stop timer, log hours by project
                (Pro+)
              </li>
              <li>
                <strong>Portal</strong> — per-client collaboration spaces (Pro+)
              </li>
              <li>
                <strong>Pulse</strong> — your business analytics overview
              </li>
              <li>
                <strong>Ask AI</strong> — create invoices, contracts, clients,
                and projects from a chat interface
              </li>
            </UL>

            <H3>Choosing a plan</H3>
            <P>
              Stackivo has three plans. The <strong>Free plan</strong> lets you
              add up to 5 clients and explore the core product before
              committing. Upgrading to <strong>Pro</strong> (₹499/month or
              ₹399/month billed annually) unlocks unlimited clients, contract
              sending, e-signatures, time tracking, the client portal, custom branding, GST
              reports, and project file sharing. The{" "}
              <strong>Business plan</strong> (₹1,499/month) adds team
              collaborators, API access, custom portal branding, and priority
              support. See{" "}
              <a
                href="/pricing"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                pricing
              </a>{" "}
              for a full feature comparison.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              2. CLIENTS
          ══════════════════════════════════════ */}
          <DocSection id="clients" title="Clients">
            <P>
              Clients are the foundation of Stackivo. Every invoice, project,
              contract, and portal is linked to a client, so adding them first
              makes everything else faster.
            </P>

            <H3>Adding a client</H3>
            <OL>
              <li>
                Click <strong>Clients</strong> in the sidebar, then{" "}
                <strong>Add client</strong>.
              </li>
              <li>
                Enter the client&apos;s name, email, phone, and billing address.
              </li>
              <li>
                If the client is GST-registered, toggle{" "}
                <strong>GST client</strong> and enter their GSTIN. Stackivo
                validates the format automatically.
              </li>
              <li>
                Save. The client is now available across invoices, projects, and
                contracts.
              </li>
            </OL>

            <H3>Client details page</H3>
            <P>
              Click any client to open their detail view. You&apos;ll see a
              summary of their total billed amount, outstanding balance, all
              linked invoices, active projects, and contracts — all in one
              place.
            </P>

            <H3>Free plan limit</H3>
            <Callout type="info">
              The Free plan supports up to <strong>5 lifetime clients</strong>.
              This is a lifetime counter — deleting a client does{" "}
              <strong>not</strong> free up a slot. Upgrade to Pro for unlimited
              clients.
            </Callout>

            <H3>Editing and archiving</H3>
            <P>
              Open any client and click the three-dot menu to edit their details
              or archive them. Archived clients are hidden from the default list
              but all their historical data — invoices, payments, contracts — is
              preserved.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              3. INVOICES
          ══════════════════════════════════════ */}
          <DocSection id="invoices" title="Invoices">
            <P>
              Stackivo&apos;s invoice builder is built for Indian freelancers —
              it handles GST, Razorpay payment links, due dates, and
              professional PDF generation out of the box. Invoices are unlimited
              on all plans.
            </P>

            <H3>Creating an invoice</H3>
            <OL>
              <li>
                Go to <strong>Invoices → New invoice</strong>.
              </li>
              <li>
                Select a client. Their billing address and GSTIN populate
                automatically.
              </li>
              <li>
                Add line items — description, quantity, rate. Stackivo
                calculates line totals in real time.
              </li>
              <li>
                Set a due date. You can also add notes (visible to your client)
                and internal notes (visible only to you).
              </li>
              <li>
                Click <strong>Save &amp; Preview</strong> to review the PDF
                before sending.
              </li>
            </OL>

            <H3>AI invoice drafting</H3>
            <P>
              You can also describe the invoice in plain text using{" "}
              <strong>Ask AI</strong> in the header. Tell it the client, work
              delivered, amount, and due date — Stackivo AI will draft the
              invoice and save it for your review. See the{" "}
              <a
                href="#ask-ai"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                Ask AI
              </a>{" "}
              section for details.
            </P>

            <H3>Invoice numbering</H3>
            <P>
              Stackivo auto-generates invoice numbers in sequence (e.g.
              INV-001, INV-002). You can change the prefix and starting number
              under <strong>Settings → Invoice defaults</strong>.
            </P>

            <H3>Sending an invoice</H3>
            <P>
              Click <strong>Send invoice</strong>. Stackivo emails your client a
              professional HTML email with a <strong>View invoice</strong>{" "}
              button that opens a hosted, mobile-friendly invoice page. You can
              also copy the link and send it via WhatsApp.
            </P>

            <H3>Custom branding & advanced templates</H3>
            <Callout type="info">
              Custom logo on invoices, advanced invoice templates, and recurring
              invoices require the <Badge plan="Pro" /> plan.
            </Callout>

            <H3>Payment links</H3>
            <P>
              Payment links and the Razorpay gateway are available on all plans
              including Free. A <strong>Pay now</strong> button appears on every
              hosted invoice when Razorpay is connected. Your client can pay via
              UPI, debit/credit card, net banking, or wallets — directly from
              the invoice page.
            </P>

            <H3>Invoice statuses</H3>
            <UL>
              <li>
                <strong>Draft</strong> — saved but not sent
              </li>
              <li>
                <strong>Sent</strong> — emailed to client, awaiting payment
              </li>
              <li>
                <strong>Viewed</strong> — client has opened the invoice
              </li>
              <li>
                <strong>Paid</strong> — payment recorded (manual or via
                Razorpay)
              </li>
              <li>
                <strong>Overdue</strong> — past due date, not yet paid
              </li>
              <li>
                <strong>Cancelled</strong> — voided
              </li>
            </UL>

            <H3>Recording a manual payment</H3>
            <P>
              If a client pays via bank transfer or cash, open the invoice and
              click <strong>Mark as paid</strong>. Enter the payment date and
              amount. Stackivo updates the status and adjusts your Pulse revenue
              figures.
            </P>

            <H3>Downloading as PDF</H3>
            <P>
              Open any invoice and click the download icon. Stackivo generates a
              pixel-perfect PDF with your business name, address, GST breakdown
              (if applicable), and payment details.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              4. CONTRACTS
          ══════════════════════════════════════ */}
          <DocSection id="contracts" title="Contracts">
            <P>
              Contracts protect you and set professional expectations with
              clients before work begins. Stackivo includes contract templates,
              an e-signature flow, and signed PDF storage.
            </P>
            <Callout type="info">
              The contracts module is visible on all plans, but{" "}
              <strong>sending contracts and e-signatures require the{" "}
              <Badge plan="Pro" /> plan</strong>. Free plan users can browse
              the contracts section but cannot send contracts to clients.
            </Callout>

            <H3>Creating a contract</H3>
            <OL>
              <li>
                Go to <strong>Contracts → New contract</strong>.
              </li>
              <li>
                Select a client and choose a template from the library (e.g.
                Freelance Service Agreement, NDA, Fixed-Price Project,
                Retainer).
              </li>
              <li>
                Fill in the project scope, payment terms, deliverables, and
                revision policy.
              </li>
              <li>Preview the contract as your client would see it.</li>
              <li>
                Click <strong>Send for signature</strong>.
              </li>
            </OL>

            <H3>AI contract drafting</H3>
            <P>
              Use <strong>Ask AI → Draft contract</strong> to describe the
              agreement in natural language. Stackivo AI will generate a
              structured draft and open it in the contract builder for your
              review before sending. This works for any contract type — service
              agreements, NDAs, retainers, and more.
            </P>

            <H3>E-signature flow</H3>
            <P>
              Your client receives an email with a link to review and sign the
              contract. They can sign on desktop or mobile using a drawn or
              typed signature. Once signed:
            </P>
            <UL>
              <li>Both parties receive a signed PDF by email.</li>
              <li>
                The contract status updates to <strong>Signed</strong> in your
                dashboard.
              </li>
              <li>
                The signed PDF is stored securely in Stackivo&apos;s cloud
                storage.
              </li>
            </UL>

            <H3>Contract statuses</H3>
            <UL>
              <li>
                <strong>Draft</strong> — not yet sent
              </li>
              <li>
                <strong>Sent</strong> — awaiting client signature
              </li>
              <li>
                <strong>Signed</strong> — fully executed
              </li>
              <li>
                <strong>Declined</strong> — client declined to sign
              </li>
              <li>
                <strong>Expired</strong> — signature deadline passed
              </li>
            </UL>

            <H3>Downloading signed contracts</H3>
            <P>
              Open any signed contract and click <strong>Download PDF</strong>.
              The PDF includes both signatures, timestamps, and IP addresses for
              legal record-keeping.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              5. PROJECTS
          ══════════════════════════════════════ */}
          <DocSection id="projects" title="Projects">
            <P>
              Projects give every piece of work its own workspace — linking time
              entries, invoices, and client communications in one place so
              nothing falls through the cracks. Projects are unlimited on all
              plans.
            </P>

            <H3>Creating a project</H3>
            <OL>
              <li>
                Go to <strong>Projects → New project</strong>.
              </li>
              <li>Name the project and select the client it belongs to.</li>
              <li>
                Set a budget (fixed price or hourly) and an optional deadline.
              </li>
              <li>
                Choose the project status: <em>Active</em>,{" "}
                <em>On hold</em>, or <em>Completed</em>.
              </li>
            </OL>

            <H3>Project workspace</H3>
            <P>Inside each project you can:</P>
            <UL>
              <li>
                Track time directly — your time entries automatically link to
                the project.
              </li>
              <li>See all invoices billed against this project.</li>
              <li>View the contract attached to the project.</li>
              <li>
                Monitor budget utilisation — hours logged vs. budget.
              </li>
              <li>
                Share files with the client through the portal{" "}
                <Badge plan="Pro" />.
              </li>
            </UL>

            <H3>Team collaborators</H3>
            <Callout type="info">
              Adding team members to projects requires the{" "}
              <Badge plan="Business" /> plan.
            </Callout>

            <H3>Archiving a project</H3>
            <P>
              When a project is complete, mark it <strong>Completed</strong> or
              archive it. Archived projects are removed from the active list but
              all associated data remains intact for your records.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              6. TIME TRACKING
          ══════════════════════════════════════ */}
          <DocSection id="time-tracking" title="Time Tracking">
            <P>
              Know exactly where your hours go. Stackivo&apos;s time tracker is
              built for freelancers who need simple, accurate logging without
              the overhead of complex project management tools.
            </P>

            <Callout type="info">
              Time tracking is a <Badge plan="Pro" /> feature. Free plan users
              can preview it, but logging time, billable rates, and CSV/PDF
              exports require Pro.
            </Callout>

            <H3>Starting the timer</H3>
            <OL>
              <li>
                Go to <strong>Time</strong> in the sidebar.
              </li>
              <li>
                Select a project and optionally add a description of what
                you&apos;re working on.
              </li>
              <li>
                Click <strong>Start timer</strong>. The timer runs in real time.
              </li>
              <li>
                Click <strong>Stop</strong> when you&apos;re done. The entry is
                saved automatically.
              </li>
            </OL>

            <Callout type="tip">
              The running timer persists server-side — your session is saved
              even if you navigate away or close the tab.
            </Callout>

            <H3>Logging time manually</H3>
            <P>
              Click <strong>Add time entry</strong> and enter the date, project,
              duration, and description. This is useful for logging billable
              hours after the fact.
            </P>

            <H3>Billable vs. non-billable</H3>
            <P>
              Every time entry can be marked as billable or non-billable.
              Billable hours feed into your project budget tracking and can be
              converted to invoice line items.
            </P>

            <H3>Billable rates & reports export</H3>
            <Callout type="info">
              Custom billable rates per project and exporting time reports as
              CSV require the <Badge plan="Pro" /> plan.
            </Callout>

            <H3>Converting hours to an invoice</H3>
            <OL>
              <li>Open a project and go to the <strong>Time</strong> tab.</li>
              <li>Select the billable entries you want to invoice.</li>
              <li>
                Click <strong>Create invoice from time</strong>.
              </li>
              <li>
                Stackivo pre-fills the invoice with itemised time entries at
                your hourly rate.
              </li>
            </OL>
          </DocSection>

          {/* ══════════════════════════════════════
              7. CLIENT PORTAL
          ══════════════════════════════════════ */}
          <DocSection id="client-portal" title="Client Portal">
            <P>
              The client portal gives every client their own private workspace
              where they can view invoices, sign contracts, access files, follow
              project updates, and chat with you — all without needing a
              Stackivo account.
            </P>
            <Callout type="info">
              The client portal requires the <Badge plan="Pro" /> plan or above.
              Custom portal branding (your logo and colours) is a{" "}
              <Badge plan="Business" /> feature.
            </Callout>

            <H3>Enabling the portal for a client</H3>
            <OL>
              <li>Open the client&apos;s details page.</li>
              <li>
                Toggle <strong>Enable client portal</strong>.
              </li>
              <li>
                Click <strong>Send portal invite</strong>. Your client receives
                an email with a secure link — no password needed.
              </li>
            </OL>

            <H3>What your client sees</H3>
            <P>The portal has six tabs:</P>
            <UL>
              <li>
                <strong>Home</strong> — a welcome message and overview of active
                projects
              </li>
              <li>
                <strong>Chat</strong> — a direct messaging thread between you
                and the client
              </li>
              <li>
                <strong>Files</strong> — shared files and deliverables
                you&apos;ve uploaded
              </li>
              <li>
                <strong>Invoices</strong> — all invoices with payment status and
                Pay Now button
              </li>
              <li>
                <strong>Updates</strong> — project updates and milestones
                you&apos;ve shared
              </li>
              <li>
                <strong>Meetings</strong> — scheduled calls and meeting notes
              </li>
            </UL>

            <H3>Sharing files through the portal</H3>
            <P>
              From inside a project, click <strong>Share with client</strong>{" "}
              on any file. It immediately appears in the client&apos;s{" "}
              <strong>Files</strong> tab. You can also upload files directly
              from the portal&apos;s file manager.
            </P>

            <H3>Portal security</H3>
            <P>
              Each portal link is unique per client and uses a signed token.
              You can revoke access at any time by disabling the portal for that
              client from their details page.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              8. WELCOME DOCUMENTS
          ══════════════════════════════════════ */}
          <DocSection id="welcome-documents" title="Welcome Documents">
            <P>
              A Welcome Document is the first thing a new client receives when
              they start working with you. It sets expectations, communicates
              your process, and positions you as a professional — before
              you&apos;ve even sent an invoice.
            </P>

            <H3>What&apos;s included in a welcome document</H3>
            <UL>
              <li>
                A personalised greeting with the client&apos;s name and project
              </li>
              <li>Your working hours and preferred communication channels</li>
              <li>Revision policy and project scope boundaries</li>
              <li>Payment schedule and late payment terms</li>
              <li>A link to the client portal</li>
            </UL>

            <H3>Sending a welcome document</H3>
            <OL>
              <li>
                Open a client and click{" "}
                <strong>Send welcome document</strong>.
              </li>
              <li>
                Customise the template — add your working hours, process notes,
                and anything specific to this project.
              </li>
              <li>Preview it as your client will see it.</li>
              <li>
                Click <strong>Send</strong>. The client receives it by email and
                it appears in their portal.
              </li>
            </OL>

            <H3>AI-drafted welcome documents</H3>
            <P>
              Use <strong>Ask AI → Welcome doc</strong> to describe the
              client&apos;s onboarding process, communication rules, and payment
              terms in plain language. Stackivo AI will generate a polished,
              structured draft and open it in the welcome editor for you to
              review before sending.
            </P>

            <Callout type="tip">
              Send the welcome document before or alongside the contract — it
              warms up the relationship and reduces &quot;what happens next?&quot;
              emails from clients.
            </Callout>
          </DocSection>

          {/* ══════════════════════════════════════
              9. ASK AI
          ══════════════════════════════════════ */}
          <DocSection id="ask-ai" title="Ask AI">
            <P>
              Stackivo AI is a conversational assistant built into the dashboard.
              Open it by clicking <strong>Ask AI</strong> (or the sparkle icon
              on mobile) in the top navigation bar. It slides open as a panel on
              the right side of the screen and lets you create and draft
              documents by describing what you want in plain language.
            </P>

            <H3>What Ask AI can do</H3>
            <UL>
              <li>
                <strong>Create invoice</strong> — Describe the client, work
                delivered, amount, and due date. Stackivo AI drafts the invoice
                and saves it in your Invoices list as a draft, ready to review
                and send.
              </li>
              <li>
                <strong>Draft contract</strong> — Describe the agreement type,
                scope, fee model, timeline, and terms. Stackivo AI generates a
                full structured draft and opens it directly in the contract
                builder so you can edit and send for signature.
              </li>
              <li>
                <strong>Welcome doc</strong> — Describe the client, your
                working hours, communication preferences, and payment terms.
                Stackivo AI prepares a polished welcome document and opens it in
                the welcome editor.
              </li>
              <li>
                <strong>Add client</strong> — Tell it the client&apos;s name,
                business, email, phone, and address. Stackivo AI creates the
                client record directly — no form to fill.
              </li>
              <li>
                <strong>Add project</strong> — Describe the project name, goal,
                timeline, and client. Stackivo AI creates the project and links
                it to the right client.
              </li>
              <li>
                <strong>Support</strong> — Ask a question or describe an issue.
                Stackivo AI forwards it to the support team on your behalf.
              </li>
            </UL>

            <H3>How to use it</H3>
            <OL>
              <li>
                Click <strong>Ask AI</strong> in the top navigation bar to open
                the panel.
              </li>
              <li>
                Type freely — Stackivo AI detects your intent (invoice,
                contract, client, etc.) automatically. Or click one of the
                workflow cards to pick a mode directly.
              </li>
              <li>
                For invoice or contract workflows, select the relevant client
                and project from the <strong>Workspace context</strong> dropdowns
                so Stackivo AI can link the output correctly.
              </li>
              <li>Press Enter or click the send button to submit.</li>
              <li>
                Stackivo AI confirms what it created and gives you a direct link
                to open it.
              </li>
            </OL>

            <Callout type="tip">
              You can expand the AI panel to a wider view using the expand icon
              in the panel header — useful when writing detailed contract or
              welcome document briefs.
            </Callout>

            <H3>How AI drafts work</H3>
            <P>
              When you use Ask AI for contracts or welcome documents, Stackivo
              AI generates a structured draft and passes it into the respective
              editor. You always review and confirm the content before it is
              saved or sent — AI drafts are never sent to clients automatically.
            </P>
            <P>
              For invoices, clients, and projects, Stackivo AI creates the
              record directly from your description and saves it as a draft (for
              invoices) or live record (for clients and projects). You can edit
              everything after it&apos;s created.
            </P>

            <H3>Privacy and AI</H3>
            <P>
              The text you send to Ask AI is processed by Groq&apos;s
              infrastructure to generate responses. Stackivo does not use your
              data to train AI models. See the{" "}
              <a
                href="/privacy"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                Privacy Policy
              </a>{" "}
              for details on how AI input is handled.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              10. PULSE ANALYTICS
          ══════════════════════════════════════ */}
          <DocSection id="pulse" title="Pulse Analytics">
            <P>
              Pulse is your real-time business health dashboard. It aggregates
              data from invoices, payments, time entries, and clients to give
              you a clear picture of how your freelance business is performing.
              Basic Pulse is available on all plans; advanced reports and GST
              reports require Pro.
            </P>

            <H3>Key metrics</H3>
            <UL>
              <li>
                <strong>Revenue this month</strong> — total payments received
                in the current calendar month
              </li>
              <li>
                <strong>Outstanding</strong> — the sum of all unpaid,
                non-overdue invoices
              </li>
              <li>
                <strong>Overdue</strong> — unpaid invoices past their due date,
                highlighted for action
              </li>
              <li>
                <strong>Billed this year</strong> — year-to-date total billed
                across all clients
              </li>
              <li>
                <strong>Active clients</strong> — clients with at least one open
                project or unpaid invoice
              </li>
              <li>
                <strong>Hours logged</strong> — total time tracked, segmented
                by project
              </li>
            </UL>

            <H3>Revenue chart</H3>
            <P>
              The revenue chart shows your monthly income over the past 12
              months. Hover over any bar to see the exact figure. You can
              compare billed vs. collected to understand how much of what you
              invoice actually gets paid — and when.
            </P>

            <H3>Top clients by revenue</H3>
            <P>
              Pulse ranks your clients by total revenue so you can see at a
              glance which relationships drive the most income.
            </P>

            <H3>Invoice aging</H3>
            <P>
              The aging section breaks down outstanding invoices by how long
              they&apos;ve been unpaid: 0–30 days, 31–60 days, 61–90 days, and
              90+ days.
            </P>

            <H3>GST reports</H3>
            <Callout type="info">
              GST summary reports require the <Badge plan="Pro" /> plan. The
              report shows taxable value, CGST, SGST, and IGST by period —
              suitable for sharing with your CA for GSTR-1 filing.
            </Callout>
          </DocSection>

          {/* ══════════════════════════════════════
              11. SETTINGS
          ══════════════════════════════════════ */}
          <DocSection id="settings" title="Settings">
            <P>
              Settings is where you configure Stackivo to match your business.
              Everything here flows through to your invoices, contracts, and
              client-facing pages.
            </P>

            <H3>Business profile</H3>
            <P>Update your:</P>
            <UL>
              <li>Business name and legal entity type</li>
              <li>Logo (appears on all invoices and documents — Pro+)</li>
              <li>Address (used for GST compliance and invoice headers)</li>
              <li>Phone, email, and website</li>
              <li>Default currency</li>
            </UL>

            <H3>Invoice preferences</H3>
            <UL>
              <li>
                <strong>Invoice prefix</strong> — e.g. INV-, STCK-, or your
                initials
              </li>
              <li>
                <strong>Starting number</strong> — set if migrating from another
                tool
              </li>
              <li>
                <strong>Default due date</strong> — e.g. 15 days after issue
                date
              </li>
              <li>
                <strong>Default payment terms</strong> — shown in invoice footer
              </li>
              <li>
                <strong>Default notes</strong> — boilerplate text added to every
                invoice
              </li>
            </UL>

            <H3>GST settings</H3>
            <P>
              If you&apos;re GST-registered, add your GSTIN and legal business
              name under <strong>Settings → Company → Tax information</strong>,
              then set your default tax mode, rates, and SAC/HSN codes under{" "}
              <strong>Settings → Invoice defaults</strong>. See the{" "}
              <a
                href="#gst-guide"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                GST Guide
              </a>{" "}
              for a full walkthrough.
            </P>

            <H3>Email notifications</H3>
            <P>Control which events trigger email notifications:</P>
            <UL>
              <li>Invoice viewed by client</li>
              <li>Invoice paid</li>
              <li>Contract signed</li>
              <li>New client portal message</li>
              <li>Invoice overdue reminder</li>
            </UL>

            <H3>Payments &amp; integrations</H3>
            <P>
              Under <strong>Settings → Payments</strong> you can connect
              Razorpay so clients can pay your invoices online. Business plan
              users also get API key management.
            </P>

            <H3>Security</H3>
            <P>
              Enable two-factor authentication (TOTP) from{" "}
              <strong>Settings → Security</strong> for an extra layer of account
              protection. You can also review active sessions and revoke any
              device you don&apos;t recognise.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              12. PLANS & BILLING
          ══════════════════════════════════════ */}
          <DocSection id="plans-billing" title="Plans & Billing">
            <H3>Plan comparison</H3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 text-left font-semibold text-foreground">
                      Feature
                    </th>
                    <th className="py-2 text-center font-semibold text-foreground">
                      Free
                    </th>
                    <th className="py-2 text-center font-semibold text-primary">
                      Pro
                    </th>
                    <th className="py-2 text-center font-semibold text-foreground">
                      Business
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Clients", "5 lifetime", "Unlimited", "Unlimited"],
                    ["Invoices", "Unlimited", "Unlimited", "Unlimited"],
                    ["Projects", "Unlimited", "Unlimited", "Unlimited"],
                    ["Time tracking", "—", "✓", "✓"],
                    ["Payment links (Razorpay)", "✓", "✓", "✓"],
                    ["Contracts (send + e-sign)", "—", "✓", "✓"],
                    ["Contract templates library", "—", "✓", "✓"],
                    ["Client portal", "—", "✓", "✓"],
                    ["Custom portal branding", "—", "—", "✓"],
                    ["Custom invoice branding", "—", "✓", "✓"],
                    ["Recurring invoices", "—", "✓", "✓"],
                    ["Advanced invoice templates", "—", "✓", "✓"],
                    ["Project file sharing", "—", "✓", "✓"],
                    ["Billable rates + time export", "—", "✓", "✓"],
                    ["Pulse GST reports", "—", "✓", "✓"],
                    ["Remove Stackivo branding", "—", "✓", "✓"],
                    ["Team collaborators", "—", "—", "✓"],
                    ["API access", "—", "—", "✓"],
                    ["Priority support", "—", "—", "✓"],
                    ["Storage", "100 MB", "5 GB", "50 GB"],
                    ["Price (monthly)", "Free", "₹499/mo", "₹1,499/mo"],
                    [
                      "Price (annual)",
                      "—",
                      "₹399/mo · ₹4,788/yr",
                      "₹1,199/mo · ₹14,388/yr",
                    ],
                  ].map(([feature, free, pro, business]) => (
                    <tr key={feature}>
                      <td className="py-2 text-muted-foreground">{feature}</td>
                      <td className="py-2 text-center text-muted-foreground">
                        {free}
                      </td>
                      <td className="py-2 text-center font-medium text-primary">
                        {pro}
                      </td>
                      <td className="py-2 text-center text-muted-foreground">
                        {business}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Upgrading your plan</H3>
            <OL>
              <li>
                Go to <strong>Settings → Billing</strong> or click{" "}
                <strong>Upgrade</strong> in the sidebar.
              </li>
              <li>
                Choose Pro or Business and select monthly or annual billing.
              </li>
              <li>
                Complete payment via Razorpay (UPI, card, net banking).
              </li>
              <li>Your plan upgrades instantly — no restart needed.</li>
            </OL>

            <H3>Annual billing discount</H3>
            <P>
              Annual billing saves you the equivalent of 2 months on both Pro
              and Business plans (billed upfront). You can switch from monthly
              to annual at any time — unused days from your monthly cycle are
              prorated as credit.
            </P>

            <H3>Cancelling your subscription</H3>
            <P>
              Go to <strong>Settings → Billing → Cancel subscription</strong>.
              Your Pro or Business features remain active until the end of your
              billing period. After that, you&apos;ll revert to the Free plan.
            </P>

            <Callout type="info">
              Stackivo never deletes your data when you downgrade. All invoices,
              contracts, clients, and files are preserved — you just won&apos;t
              be able to create new contracts or portal entries on the Free
              plan.
            </Callout>

            <H3>Refunds</H3>
            <P>
              You can request a refund within 30 days of any payment by emailing{" "}
              <a
                href="mailto:support@stackivo.me"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                support@stackivo.me
              </a>
              . We process refunds in good faith.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              13. GST GUIDE
          ══════════════════════════════════════ */}
          <DocSection id="gst-guide" title="GST Guide">
            <P>
              Stackivo is built for GST compliance from the ground up. Whether
              you&apos;re registered or not, Stackivo generates the right invoice
              format for your situation automatically.
            </P>

            <H3>Am I required to register for GST?</H3>
            <P>
              As a freelancer, you&apos;re required to register for GST if your
              annual turnover exceeds ₹20 lakhs (₹10 lakhs in special category
              states). You must also register if you provide services to clients
              outside India (export of services), regardless of turnover. This
              is a general guideline — consult a CA for advice specific to your
              situation.
            </P>

            <H3>Setting up GST in Stackivo</H3>
            <OL>
              <li>
                Go to <strong>Settings → GST settings</strong>.
              </li>
              <li>
                Toggle <strong>GST registered</strong> on.
              </li>
              <li>
                Enter your 15-digit GSTIN. Stackivo validates the format.
              </li>
              <li>
                Enter your legal business name as it appears on your GST
                certificate.
              </li>
              <li>
                Add your SAC code for the services you provide (e.g. 998314 for
                IT design services).
              </li>
            </OL>

            <H3>How Stackivo calculates GST</H3>
            <P>
              Stackivo automatically determines the correct GST type based on
              your state and your client&apos;s state:
            </P>
            <UL>
              <li>
                <strong>CGST + SGST</strong> — when you and your client are in
                the same state (intra-state). Each is 9% for an 18% GST rate.
              </li>
              <li>
                <strong>IGST</strong> — when you and your client are in
                different states, or when exporting services. Applied as a
                single 18% line.
              </li>
            </UL>
            <Callout type="info">
              Stackivo reads your state from your business address and your
              client&apos;s state from their GSTIN or billing address. Keep both
              up to date for accurate tax calculations.
            </Callout>

            <H3>Non-GST invoices</H3>
            <P>
              If you&apos;re not GST-registered, Stackivo generates clean
              invoices with no GST lines — just your service charges and totals.
              No configuration needed.
            </P>

            <H3>GST reports</H3>
            <P>
              Pro and Business users can download GST summary reports from{" "}
              <strong>Pulse → GST report</strong>. The report shows total
              taxable value, CGST, SGST, and IGST collected, with an
              invoice-wise breakup suitable for GSTR-1 filing. Export as CSV to
              share with your CA.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              14. PAYMENTS
          ══════════════════════════════════════ */}
          <DocSection id="payments" title="Payments">
            <P>
              Stackivo integrates with Razorpay so your clients can pay invoices
              online — via UPI, IMPS, NEFT, debit/credit cards, or net banking
              — all without leaving the invoice page. Razorpay payment links are
              available on all plans, including Free.
            </P>

            <H3>Connecting Razorpay</H3>
            <OL>
              <li>
                Go to <strong>Settings → Payments</strong>.
              </li>
              <li>
                Click <strong>Connect Razorpay</strong> and authorise the
                connection. If you don&apos;t have a Razorpay account, create
                one for free at{" "}
                <a
                  href="https://razorpay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
                >
                  razorpay.com
                </a>
                .
              </li>
              <li>
                Once authorised, return to Stackivo. The connection is active
                immediately.
              </li>
            </OL>

            <H3>How payment links work</H3>
            <P>
              When you send an invoice, Stackivo generates a Razorpay payment
              link and embeds a <strong>Pay now</strong> button. When your
              client pays:
            </P>
            <UL>
              <li>
                Razorpay processes the payment and notifies Stackivo via
                webhook.
              </li>
              <li>
                The invoice status updates to <strong>Paid</strong>{" "}
                automatically.
              </li>
              <li>You receive an email confirmation.</li>
              <li>Your Pulse revenue figures update in real time.</li>
            </UL>

            <H3>Razorpay fees</H3>
            <P>
              Razorpay charges a transaction fee — typically 2% + GST for
              domestic cards; UPI transactions have their own rate structure.
              Stackivo does not add any markup. Check{" "}
              <a
                href="https://razorpay.com/pricing/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                Razorpay&apos;s pricing page
              </a>{" "}
              for current rates. Settlement typically takes T+2 business days.
            </P>

            <H3>Recording offline payments</H3>
            <P>
              For bank transfers, cheques, or cash, open the invoice and click{" "}
              <strong>Mark as paid</strong>. Select the payment method, enter
              the date and amount, and save.
            </P>
          </DocSection>

          {/* ══════════════════════════════════════
              15. FAQ & TROUBLESHOOTING
          ══════════════════════════════════════ */}
          <DocSection id="faq" title="FAQ & Troubleshooting">
            <H3>Account & login</H3>

            <p className="font-medium text-foreground">
              Can I change the email address on my account?
            </p>
            <P>
              Yes. Go to <strong>Settings → Profile</strong> and update your
              email. You&apos;ll receive a verification link at the new address
              before the change takes effect.
            </P>

            <p className="mt-4 font-medium text-foreground">
              I&apos;m not receiving verification emails.
            </p>
            <P>
              Check your spam folder first. If the email isn&apos;t there, wait
              2–3 minutes and request a new link. If the problem persists,
              contact support via the chat bubble in the bottom-right corner.
            </P>

            <H3>Invoices</H3>

            <p className="font-medium text-foreground">
              My client says they didn&apos;t receive the invoice email.
            </p>
            <P>
              Open the invoice and click <strong>Resend</strong>. Also share
              the hosted invoice link directly via WhatsApp — your client can
              pay from there without needing the email.
            </P>

            <p className="mt-4 font-medium text-foreground">
              Can I edit a sent invoice?
            </p>
            <P>
              Yes, but editing a sent invoice resets its status to Draft and
              you&apos;ll need to resend it. If the invoice has already been
              paid, it cannot be edited — create a new invoice to correct any
              errors.
            </P>

            <p className="mt-4 font-medium text-foreground">
              How do I void/cancel an invoice?
            </p>
            <P>
              Open the invoice, click the three-dot menu, and select{" "}
              <strong>Cancel invoice</strong>. Stackivo does not permanently
              delete invoices to preserve your financial audit trail — cancelled
              invoices are marked void but remain in your records.
            </P>

            <H3>Contracts</H3>

            <p className="font-medium text-foreground">
              I can see the Contracts section but I can&apos;t send contracts.
            </p>
            <P>
              The contracts section is visible on the Free plan but sending
              contracts requires the <strong>Pro plan</strong>. Upgrade from{" "}
              <strong>Settings → Billing</strong>.
            </P>

            <H3>Ask AI</H3>

            <p className="font-medium text-foreground">
              Stackivo AI said it&apos;s temporarily unavailable.
            </p>
            <P>
              The AI workflows depend on Groq&apos;s API. Occasional temporary
              outages can happen. Wait a minute and try again — or create the
              invoice/contract manually in the meantime.
            </P>

            <p className="mt-4 font-medium text-foreground">
              The AI created an invoice with the wrong amount/details.
            </p>
            <P>
              All AI-created invoices are saved as <strong>Draft</strong> — they
              are never sent automatically. Review and edit the draft in your
              Invoices list before sending.
            </P>

            <H3>Payments</H3>

            <p className="font-medium text-foreground">
              My client paid but the invoice still shows as unpaid.
            </p>
            <P>
              Webhook delivery from Razorpay can take 1–2 minutes. Refresh the
              page. If it still hasn&apos;t updated after 10 minutes, confirm
              the payment in your Razorpay dashboard, then manually mark the
              invoice as paid in Stackivo.
            </P>

            <p className="mt-4 font-medium text-foreground">
              Can I issue a refund through Stackivo?
            </p>
            <P>
              Refunds must be processed directly in your{" "}
              <a
                href="https://dashboard.razorpay.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                Razorpay dashboard
              </a>
              . After issuing the refund there, cancel or adjust the invoice in
              Stackivo.
            </P>

            <H3>GST</H3>

            <p className="font-medium text-foreground">
              My GSTIN is valid but Stackivo won&apos;t accept it.
            </p>
            <P>
              Ensure you&apos;re entering all 15 characters with no spaces. The
              format is:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                2-digit state code + 10-digit PAN + 1 entity number + Z +
                1 checksum
              </code>
              . If it still fails, contact support.
            </P>

            <p className="mt-4 font-medium text-foreground">
              I have clients in the same state and different states. Does
              Stackivo handle both?
            </p>
            <P>
              Yes — automatically. Stackivo compares your state to your
              client&apos;s state and applies CGST+SGST for intra-state or IGST
              for inter-state. No manual selection needed.
            </P>

            <H3>Plans & billing</H3>

            <p className="font-medium text-foreground">
              Can I switch from monthly to annual billing?
            </p>
            <P>
              Yes. Go to <strong>Settings → Billing</strong> and click{" "}
              <strong>Switch to annual</strong>. Unused days from your current
              monthly cycle are prorated as credit.
            </P>

            <p className="mt-4 font-medium text-foreground">
              What happens to my data if I cancel?
            </p>
            <P>
              Your data is never deleted. If you cancel, you&apos;ll revert to
              the Free plan at the end of your billing period. All invoices,
              clients, contracts, and files remain accessible.
            </P>

            <H3>Need more help?</H3>
            <P>
              Use the <strong>chat bubble</strong> in the bottom-right of any
              Stackivo page to reach support, or use{" "}
              <strong>Ask AI → Support</strong> to submit a request from within
              the dashboard. You can also email{" "}
              <a
                href="mailto:support@stackivo.me"
                className="font-medium text-foreground underline underline-offset-4 hover:opacity-70"
              >
                support@stackivo.me
              </a>
              . Pro and Business users receive priority responses within 4
              business hours.
            </P>
          </DocSection>
        </div>
      </div>
      </Section>
    </>
  );
}
