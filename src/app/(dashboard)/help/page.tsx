/**
 * /help — in-app support hub.
 *
 * Sections:
 *   1. Inline FAQ accordion — GST & invoicing, payment collection,
 *      freelancer workflow, billing & account. No external KB dependency.
 *   2. Direct contact methods.
 *   3. Bug-report / detailed contact form.
 */

import type { Metadata } from "next";
import {
  BookOpen,
  MessageCircle,
  Mail,
  Receipt,
  CreditCard,
  Briefcase,
  Settings,
  Ticket,
} from "lucide-react";
import { getServerSupabase } from "@/lib/supabase/server";
import { SupportTicketForm } from "@/features/support/components/support-ticket-form";
import { MyTicketsList } from "@/features/support/components/my-tickets-list";
import { HelpTabs } from "@/features/support/components/help-tabs";
import { listMyTickets } from "@/features/support/ticket-server";
import { FaqAccordion } from "@/features/support/faq-accordion";
import { ReplayTourButton } from "@/features/onboarding/components/replay-tour-button";

export const metadata: Metadata = {
  title: "Help & support",
  description: "Get help with GST invoicing, payments, and your freelance workflow.",
};

export const dynamic = "force-dynamic";

const FAQ_SECTIONS = [
  {
    id: "gst",
    icon: Receipt,
    iconClass: "text-indigo-500",
    label: "GST & Invoicing",
    items: [
      {
        q: "How does Stackivo decide which GST type to use (CGST/SGST vs IGST)?",
        a: "Stackivo checks your registered state and your client's state. If both are the same state, it applies CGST + SGST (each at half the applicable rate). If they are in different states — or if your client is outside India — it applies IGST at the full rate. You can review the tax breakdown in invoice preview before sending.",
      },
      {
        q: "My client doesn't have a GSTIN. Can I still send a GST invoice?",
        a: "Yes. If your client is unregistered (B2C), you set them up without a GSTIN. Stackivo still generates a valid GST invoice — the GSTIN field simply reads 'Unregistered' as per CBIC guidelines. The invoice number series and HSN/SAC codes remain compliant.",
      },
      {
        q: "What HSN/SAC code should I use for software or design services?",
        a: "Most software and digital services fall under SAC code 998314 (IT design and development), 998313 (software development), or 998371 (software maintenance). For graphic design use 998391. You can set your default SAC code in Settings → Invoice Defaults so it auto-fills on every new invoice.",
      },
      {
        q: "Can I generate a GSTR-1 summary from Stackivo?",
        a: "Stackivo's GST summary page (Invoices → GST Report) gives you a period-wise breakdown split by B2B (GSTIN clients), B2C, and export. While this is not a direct GSTR-1 upload, the table maps exactly to GSTR-1 sections and can be used to fill in ClearTax, Tally, or the GST portal manually.",
      },
      {
        q: "I made a mistake on an invoice I already sent — can I edit it?",
        a: "Once an invoice is sent, the original is locked. You should issue a credit note against it and re-issue a corrected invoice. This keeps your running invoice series intact and maintains a valid audit trail. Go to the invoice → Actions → Issue credit note.",
      },
      {
        q: "How do I add my digital signature to invoices?",
        a: "Go to Settings → Business Profile → Signature. You can draw your signature, type your name in a cursive font, or upload an image of your signature. Once saved it appears automatically on every invoice and proposal PDF.",
      },
      {
        q: "Can I invoice in USD or another foreign currency?",
        a: "Yes. Set the client's country and invoice currency when you add the client. Invoices and contracts for that client automatically use that currency. For export invoices (outside India), Stackivo marks the supply as 'Export without payment of IGST' automatically, which is the correct treatment for most LUT-holders. Check with your CA if your situation involves bond or letter of undertaking filings.",
      },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    iconClass: "text-emerald-500",
    label: "Payment collection",
    items: [
      {
        q: "How do clients pay me through Stackivo?",
        a: "When you send an invoice, your client gets a payment link. Clicking it opens a branded payment page where they can pay via UPI, net banking, debit/credit card, or wallet — all processed through Razorpay. You don't need to share your bank account details. Payments settle to your linked bank account within 2 business days.",
      },
      {
        q: "Do I need to create a Razorpay account?",
        a: "No. Stackivo holds the Razorpay account on your behalf. All you need is a verified bank account linked in Settings → Payment Settings. This is the account where your collections get settled.",
      },
      {
        q: "What fees are charged on collected payments?",
        a: "Razorpay charges a platform fee (typically 2% for cards, 0% for UPI up to certain volumes). Stackivo does not add its own markup on top. The exact fee is visible in the payment breakdown on every settled invoice.",
      },
      {
        q: "My client paid but the invoice still shows as unpaid — what do I do?",
        a: "Payment confirmation from the gateway can take a few minutes to propagate. Refresh the invoice after 5–10 minutes. If it's still not updated, check the Razorpay payment details by searching your client's name or amount in Settings → Payment Settings. If the payment is confirmed there but not in Stackivo, email support@stackivo.me with the Razorpay payment ID.",
      },
      {
        q: "Can I record a cash or bank transfer payment (offline)?",
        a: "Yes. Open the invoice → Mark as paid → select 'Bank transfer', 'Cash', or 'Cheque' from the payment method dropdown, enter the reference (UTR for NEFT/IMPS, or cheque number), and save. The invoice moves to Paid and an activity log entry is created.",
      },
      {
        q: "Will Stackivo automatically remind my client about overdue invoices?",
        a: "Yes, if you have automatic reminders enabled (Settings → Notifications → Invoice reminders). Stackivo emails your client a 'due tomorrow' reminder on Day -1, then follow-up reminders at Day +1, Day +7, and Day +14 after the due date. You can turn this off per-invoice or globally from settings.",
      },
      {
        q: "Can clients pay partial amounts?",
        a: "Partial payments are not currently supported through the online payment link — the link amount is fixed to the invoice total. For partial arrangements, record them manually using 'Mark partial payment' on the invoice, and issue a revised invoice for the balance.",
      },
    ],
  },
  {
    id: "workflow",
    icon: Briefcase,
    iconClass: "text-amber-500",
    label: "Freelancer workflow",
    items: [
      {
        q: "What's the recommended flow from winning a project to getting paid?",
        a: "The typical Stackivo flow is: 1) Add your client. 2) Send a proposal (optional) for the client to review and approve. 3) Once approved, create an invoice from the proposal — all line items carry over. 4) Send the invoice. 5) Stackivo handles reminders. 6) Mark paid when funds arrive. Contracts can be sent at step 2 if you need a signed agreement before starting.",
      },
      {
        q: "How do I track time and bill hourly clients?",
        a: "Open the project → Time Tracking tab. Log hours manually or use the timer. When you're ready to invoice, click 'Create invoice from tracked time' — Stackivo pulls in all unbilled hours and creates line items automatically at your set hourly rate.",
      },
      {
        q: "Can I create recurring invoices for retainer clients?",
        a: "Yes. When creating an invoice, check 'Recurring' and set the frequency (weekly, monthly, quarterly). Stackivo automatically generates and sends the next invoice when the cycle rolls over, keeping the invoice number series correct.",
      },
      {
        q: "How do I import my existing clients from a spreadsheet?",
        a: "Go to Clients → Import CSV. Download the sample template, fill in your clients (name, email, phone, company), and upload it. Stackivo will preview the import before creating any records. GST details can be added to each client after import.",
      },
      {
        q: "Can I send contracts and get them signed digitally?",
        a: "Yes. Go to Contracts → New contract, write or paste your terms, and send it to your client. They can review and sign it entirely online — no printing or scanning needed. Signed contracts are stored in the client's profile and downloadable as PDF.",
      },
      {
        q: "Does Stackivo have a client portal?",
        a: "Yes. Each client can be invited to a read-only portal where they see all their invoices, contracts, project updates, and can make payments. Go to the client's profile → Invite to portal. The portal URL is unique per client and requires no sign-up on their end.",
      },
      {
        q: "How do I handle expenses for a project?",
        a: "You can add expense line items directly inside any invoice. For project-level expense tracking, open the project → Expenses tab → Add expense. Expenses can be marked as reimbursable and carried into the next invoice automatically.",
      },
    ],
  },
  {
    id: "account",
    icon: Settings,
    iconClass: "text-violet-500",
    label: "Billing & account",
    items: [
      {
        q: "How many clients can I have on the free plan?",
        a: "The free plan allows a lifetime total of 5 clients. Note that this is a lifetime counter — deleting a client does not reduce it. Once you hit 5, you'll need to upgrade to Pro or Business to add more.",
      },
      {
        q: "What's the difference between Pro and Business?",
        a: "Pro removes the client limit and unlocks recurring invoices, contracts, time tracking, and the client portal. Business adds team members, custom branding, priority support, and higher API limits. Full comparison at stackivo.me/pricing.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "Go to Settings → Billing → Cancel subscription. Your plan stays active until the end of the current billing period — you won't lose access immediately. We don't do prorated refunds on cancellations, but we do offer a full refund if you cancel within the first 30 days.",
      },
      {
        q: "How do I get a GST invoice for my Stackivo subscription?",
        a: "Go to Settings → Billing → Invoices. Every billing cycle generates a GSTIN-bearing PDF invoice. You can claim input tax credit (ITC) on this as it's a B2B software subscription used for your business.",
      },
      {
        q: "I'm not receiving invoice notification emails from Stackivo.",
        a: "Check your spam folder first. Add noreply@stackivo.me and billing@stackivo.me to your contacts. If your client says they didn't receive their invoice, ask them to check spam and whitelist stackivo.me. Email delivery issues can also be reported via the form below.",
      },
      {
        q: "How do I export all my data?",
        a: "Go to Settings → Account → Export data. You'll receive a download link within a few minutes containing a JSON bundle of all your clients, invoices, projects, time entries, and documents.",
      },
    ],
  },
];

export default async function HelpPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);
  const myTickets = isLoggedIn ? await listMyTickets() : [];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Help &amp; support</h1>
          <p className="text-sm text-muted-foreground">
            Answers on GST invoicing, payments, and your freelance workflow — or
            reach the founder directly.
          </p>
        </div>
        <ReplayTourButton className="shrink-0 gap-1.5" />
      </header>

      <HelpTabs
        help={
          <div className="space-y-8">
          <div className="space-y-8">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <section.icon className={`h-4 w-4 ${section.iconClass}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h2>
            </div>
            <FaqAccordion items={section.items} sectionId={section.id} />
          </section>
        ))}
      </div>

      {/* Direct contact */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Still need help?
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              Chat now
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the chat bubble at the bottom-right to message us live. We
              reply here and email you too.
            </p>
          </div>
          <div className="rounded-md border bg-card p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Mail className="h-4 w-4" />
              Email
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Send a detailed message to{" "}
              <a
                href="mailto:support@stackivo.me"
                className="text-foreground underline hover:opacity-80"
              >
                support@stackivo.me
              </a>
              . The founder reviews every report personally.
            </p>
          </div>
        </div>
      </section>
          </div>
        }
        contact={
          <div className="space-y-8">
      {isLoggedIn ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Your tickets
            </h2>
          </div>
          <MyTicketsList tickets={myTickets} />
        </section>
      ) : null}

      {/* Contact form — opens a tracked ticket */}
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Send a detailed message</h2>
        <p className="text-xs text-muted-foreground">
          Best for bugs, feature requests, or anything that needs context. You&rsquo;ll get a
          tracked ticket and an email confirmation.
        </p>
        <SupportTicketForm
          showContactFields={!isLoggedIn}
          initialEmail={user?.email ?? ""}
          channel="in_app"
        />
      </section>
          </div>
        }
      />
    </div>
  );
}
