/**
 * FAQ data — kept in a server-safe module (NO "use client") so server
 * components (homepage JSON-LD, pricing page) can import the array
 * directly. Importing non-component values from a client module crashes
 * RSC rendering at runtime, so the data must live here, not in
 * faq-section.tsx.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const DEFAULT_FAQS: FaqItem[] = [
  {
    q: "Is Stackivo really free?",
    a: "Yes. During early access, every workspace feature is included for community members and no card is required. We will communicate pricing well before it is introduced.",
  },
  {
    q: "Do I need to be GST-registered to use Stackivo?",
    a: "No. Stackivo works for non-GST freelancers too - your invoices are issued as standard non-GST invoices with the right footer note. When you do register, just toggle on GST mode and we handle CGST / SGST / IGST automatically.",
  },
  {
    q: "Can I track time and bill from it?",
    a: "Yes. Start the timer or log entries manually. Billable hours flow directly into invoices using your project rate.",
  },
  {
    q: "What about contracts?",
    a: "Yes. Draft proposals and contracts inside Stackivo, share a public signing link, and watch the status timeline from sent to signed.",
  },
  {
    q: "Will my data be safe?",
    a: "Every workspace is isolated by Supabase row-level security - no other user can ever read your data. Daily backups are part of the platform.",
  },
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes. Pricing is monthly or yearly, and you can switch plans at any time. Your data is always portable.",
  },
];
