import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "About Stackivo · The freelance business OS for India",
  description:
    "Stackivo is built for Indian freelancers — GST invoicing, contracts, projects, time tracking, and revenue analytics in one workspace. Learn what we believe and where we're going.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Stackivo",
    description:
      "GST invoicing, contracts, projects, time tracking, and revenue analytics built for Indian freelancers.",
    url: `${siteConfig.url}/about`,
  },
};

export const dynamic = "force-static";

export default function AboutPage() {
  return (
    <ProsePage
      title="About Stackivo"
      lead="We&rsquo;re building the operating system Indian freelancers actually deserve. India-first, freelancer-first, free-to-start."
    >
      <h2>Why Stackivo exists</h2>
      <p>
        Indian freelancers stitch together five tools to run a one-person
        business: a US-built invoicing app that pretends GST doesn&rsquo;t
        exist, a separate contracts tool, a separate time tracker, a
        spreadsheet for revenue, and an inbox full of late-payment chases.
      </p>
      <p>
        We&rsquo;ve felt this pain ourselves. Stackivo exists to collapse all
        of it into one calm workspace — designed first for freelancers in
        India, with GST, place-of-supply, and INR pricing baked in from day
        zero.
      </p>

      <h2>What we believe</h2>

      <h3>India-first, not India-also</h3>
      <p>
        Most freelance SaaS treats India as an afterthought. We treat it as
        the home market: CGST/SGST/IGST split correctly, GSTIN validation,
        ₹ everywhere, and pricing that respects Indian purchasing power.
      </p>

      <h3>Early access should be useful</h3>
      <p>
        Early community members get every workflow — invoices, contracts,
        projects, time, Pulse, and Ivo — without an upgrade prompt. That lets
        us learn from real businesses before pricing returns.
      </p>

      <h3>Your data is yours</h3>
      <p>
        Every workspace is isolated through Supabase row-level security
        policies — no other user can ever read your data. You can export
        everything as JSON at any time, and we&rsquo;ll never hold your
        records hostage if you cancel.
      </p>

      <h3>We build in the open</h3>
      <p>
        Our roadmap is public. The features that ship are the ones our
        users ask for. If something breaks, we&rsquo;d rather you tell us
        than churn quietly.
      </p>

      <h2>The team</h2>
      <p>
        Stackivo is a small team working from India. We answer support
        ourselves — there&rsquo;s no offshore tier-one queue between you
        and the people who built the product.
      </p>
      <p>
        Reach us by{" "}
        <Link href="/contact">live chat or email on the contact page</Link>,
        or follow along on{" "}
        <a
          href={siteConfig.links.twitter}
          target="_blank"
          rel="noopener noreferrer"
        >
          Twitter
        </a>
        .
      </p>

      <h2>Where we&rsquo;re going</h2>
      <ul>
        <li>
          Deeper GST tooling — input tax credit tracking, GSTR-1 export,
          composition-scheme support
        </li>
        <li>
          Native e-signature and stamp-paper integration for Indian
          contracts
        </li>
        <li>UPI / bank-statement matching for automatic payment reconciliation</li>
        <li>A WhatsApp channel for sending and receiving invoices</li>
        <li>API access for power users and tiny teams</li>
      </ul>

      <h2>Get involved</h2>
      <p>
        The best way to shape Stackivo&rsquo;s next year is to{" "}
        <Link href="/community">join the early community</Link> and tell us what
        worked and what didn&rsquo;t. We read every reply.
      </p>
    </ProsePage>
  );
}
