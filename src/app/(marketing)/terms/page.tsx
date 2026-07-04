import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service · Stackivo",
  description:
    "The complete terms governing use of Stackivo — plans, billing, AI features, acceptable use, data ownership, liability, and your rights.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Stackivo Terms of Service",
    description: "The terms governing use of Stackivo.",
    url: `${siteConfig.url}/terms`,
  },
};

export const dynamic = "force-static";

const EFFECTIVE_DATE = "1 January 2026";

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of Service"
      toc
      badge={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated {EFFECTIVE_DATE}
        </span>
      }
      lead={
        <>
          Effective: {EFFECTIVE_DATE}. These Terms govern your access to and
          use of Stackivo. Please read them carefully. By creating an account or
          using the Service you agree to be bound by these Terms. If you do not
          agree, do not use the Service.
        </>
      }
    >
      <h2>1. Definitions</h2>
      <ul>
        <li>
          <strong>&ldquo;Stackivo&rdquo;</strong> or{" "}
          <strong>&ldquo;the Service&rdquo;</strong> — the SaaS platform
          available at stackivo.me, including all features, APIs, and associated
          tools operated independently from Indore, India (
          <strong>&ldquo;we&rdquo;</strong>, <strong>&ldquo;us&rdquo;</strong>,
          or <strong>&ldquo;our&rdquo;</strong>).
        </li>
        <li>
          <strong>&ldquo;User&rdquo;</strong> or{" "}
          <strong>&ldquo;you&rdquo;</strong> — any individual who registers for
          or uses the Service, including freelancers and solo professionals.
        </li>
        <li>
          <strong>&ldquo;Client&rdquo;</strong> — a third party you add to
          Stackivo as a recipient of your invoices, contracts, or portal
          invitations. Your clients are not parties to this agreement with us.
        </li>
        <li>
          <strong>&ldquo;User Content&rdquo;</strong> — all data you create,
          upload, or generate through the Service, including clients, invoices,
          contracts, projects, time entries, files, and AI-assisted documents.
        </li>
        <li>
          <strong>&ldquo;Plan&rdquo;</strong> — the subscription tier you
          select (Free, Pro, or Business), each with its own features and limits
          as described on the{" "}
          <Link href="/pricing">pricing page</Link>.
        </li>
      </ul>

      <h2>2. Eligibility and account</h2>
      <ul>
        <li>
          You must be at least <strong>18 years old</strong> and legally capable
          of entering into a binding contract under Indian law.
        </li>
        <li>
          You must provide accurate registration information and keep it up to
          date. Misrepresenting your identity may result in account suspension.
        </li>
        <li>
          You are responsible for keeping your login credentials and any API
          keys confidential. You are responsible for all activity that occurs
          under your account.
        </li>
        <li>
          You must notify us immediately at{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a> if you
          suspect unauthorized access to your account.
        </li>
        <li>One person may not maintain multiple free accounts.</li>
      </ul>

      <h2>3. The Service</h2>
      <p>
        Stackivo is a software-as-a-service platform that helps freelancers and
        solo professionals manage clients, invoices, contracts, projects, time
        tracking, a client portal, welcome documents, pulse analytics, and AI
        workflows. The Service is provided on an &ldquo;as-is&rdquo; basis and
        we improve it continuously.
      </p>

      <h3>Feature availability by plan</h3>
      <p>
        The features available to you depend on your active Plan. A summary of
        what each Plan includes is always available on the{" "}
        <Link href="/pricing">pricing page</Link> and in the{" "}
        <Link href="/docs">documentation</Link>. Key gating points:
      </p>
      <ul>
        <li>
          <strong>Free plan</strong>: limited to 5 lifetime clients (deleting a
          client does not free up a slot). Contracts are visible in the dashboard
          but cannot be sent. The client portal and e-signatures are not
          available. Payment links via Razorpay are available at no cost from
          Stackivo (Razorpay&rsquo;s own fees apply).
        </li>
        <li>
          <strong>Pro plan</strong>: unlimited clients and contracts, e-signature,
          contract templates, client portal, custom branding, recurring invoices,
          project file sharing, billable rate tracking, time report export, GST
          reports, and 5 GB storage.
        </li>
        <li>
          <strong>Business plan</strong>: everything in Pro, plus team
          collaborators, API access, custom portal branding, priority support,
          and 50 GB storage.
        </li>
      </ul>
      <p>
        We reserve the right to adjust Plan features and limits with reasonable
        notice. If we materially reduce a paid feature, we will notify you by
        email at least 30 days in advance.
      </p>

      <h2>4. Plans, billing, and payments</h2>

      <h3>Subscription and renewal</h3>
      <ul>
        <li>
          Paid plans are billed in advance — monthly or annually — via Razorpay.
          All prices are in <strong>Indian Rupees (INR)</strong>. GST is applied
          where applicable.
        </li>
        <li>
          Subscriptions renew <strong>automatically</strong> at the end of each
          billing period unless you cancel before the renewal date.
        </li>
        <li>
          Cancellation takes effect at the end of the current paid period. You
          retain full access to your Plan features until then. After expiry, your
          account reverts to the Free plan.
        </li>
      </ul>

      <h3>Annual billing</h3>
      <ul>
        <li>
          Annual plans are billed as a single upfront charge. You save the
          equivalent of two months compared to monthly billing.
        </li>
        <li>
          Switching from monthly to annual: unused days on your current monthly
          cycle are prorated as credit toward the annual charge.
        </li>
        <li>
          Annual subscriptions are non-refundable after the 30-day refund window
          (see below).
        </li>
      </ul>

      <h3>Price changes</h3>
      <p>
        We may change our prices. If we increase the price of your active paid
        Plan, we will notify you by email at least <strong>30 days</strong>{" "}
        before the new price applies to your renewal. If you do not cancel before
        the renewal, you accept the new price.
      </p>

      <h3>Refund policy</h3>
      <ul>
        <li>
          You may request a full refund within <strong>30 days</strong> of any
          subscription payment by emailing{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a>.
        </li>
        <li>
          After 30 days, payments are non-refundable, except where required by
          applicable Indian consumer protection law.
        </li>
        <li>
          Refunds are processed to the original payment method via Razorpay and
          typically appear within 5–7 business days.
        </li>
        <li>
          We process refunds in good faith. Abuse of the refund policy (e.g.
          repeated refund requests) may result in account restriction.
        </li>
      </ul>

      <h3>Free plan limits</h3>
      <p>
        The Free plan is free indefinitely, subject to the client limit and
        feature restrictions described above. We reserve the right to retire,
        modify, or restrict the Free plan with 60 days&rsquo; notice.
      </p>

      <h2>5. AI features — Ask AI</h2>
      <p>
        Stackivo includes an AI assistant (&ldquo;Ask AI&rdquo;) that helps you
        create invoices, contracts, welcome documents, clients, and projects from
        natural-language descriptions. The AI is powered by{" "}
        <strong>Groq&rsquo;s API</strong>.
      </p>
      <ul>
        <li>
          <strong>Review before sending</strong>: AI-generated drafts (invoices,
          contracts, welcome documents) are always saved as drafts and opened in
          the relevant editor. Nothing is sent to your clients automatically as a
          result of an AI workflow. You are responsible for reviewing and
          approving all AI-generated content before it is shared.
        </li>
        <li>
          <strong>Accuracy</strong>: AI-generated content may contain errors,
          omissions, or inaccuracies. We do not warrant that AI outputs are
          correct, legally sufficient, or appropriate for your specific
          situation. You must review all AI-generated documents — especially
          contracts — before relying on them.
        </li>
        <li>
          <strong>No legal or financial advice</strong>: Ask AI is a drafting
          tool, not a lawyer or accountant. Nothing generated by Ask AI
          constitutes legal or financial advice. For contracts with significant
          commercial value, consult a qualified professional.
        </li>
        <li>
          <strong>Data processing</strong>: your prompts are sent to
          Groq&rsquo;s infrastructure for inference. By using Ask AI, you
          consent to this transfer. We do not use your data to train AI models.
          See our <Link href="/privacy">Privacy Policy</Link> for details.
        </li>
        <li>
          <strong>Availability</strong>: AI features depend on third-party API
          availability. We do not guarantee uptime or response quality from
          Groq&rsquo;s API.
        </li>
      </ul>

      <h2>6. Your data — ownership and licence</h2>
      <ul>
        <li>
          <strong>You own your User Content.</strong> We make no claim to
          ownership of the clients, invoices, contracts, files, or any other
          data you create in Stackivo.
        </li>
        <li>
          By using the Service, you grant us a limited, non-exclusive,
          royalty-free licence to store, process, and transmit your User Content
          solely to provide and improve the Service. This licence ends when you
          delete your account.
        </li>
        <li>
          You represent that you have the right to upload and use any content
          you submit, and that it does not infringe any third party&rsquo;s
          rights.
        </li>
        <li>
          You can export all your data as JSON from{" "}
          <strong>Settings → Data &amp; export</strong> at any time.
        </li>
      </ul>

      <h3>Data after account deletion</h3>
      <ul>
        <li>
          When you request account deletion, your account is immediately locked
          and scheduled for permanent erasure after a 30-day recovery window.
          You can cancel during that window by signing back in. After it
          elapses, your personal and business data is permanently and
          irreversibly deleted, and your uploaded files are removed from
          storage. Export anything you need first.
        </li>
        <li>
          Records of subscription payments you made to Stackivo are retained in
          anonymised form for the period required by Indian tax law, as these
          are Stackivo&rsquo;s own financial records.
        </li>
        <li>
          Your data is never deleted solely because you downgrade to the Free
          plan or cancel a paid subscription.
        </li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>
          Violate any applicable law or regulation, including Indian tax law,
          DPDP Act, IT Act, 2000, or consumer protection laws.
        </li>
        <li>
          Send fraudulent invoices, forged contracts, or any content intended to
          deceive or defraud your clients or third parties.
        </li>
        <li>
          Send unsolicited bulk messages (spam), phishing emails, or scam
          content through the Service&rsquo;s email or portal features.
        </li>
        <li>
          Upload or transmit malware, viruses, or any harmful code.
        </li>
        <li>
          Attempt to circumvent authentication, rate limits, plan restrictions,
          access controls, or row-level security policies.
        </li>
        <li>
          Reverse engineer, decompile, or attempt to extract the source code of
          the Service.
        </li>
        <li>
          Resell, sublicense, or white-label the Service without our prior
          written consent.
        </li>
        <li>
          Use the Service to facilitate money laundering, terrorism financing, or
          any other illegal financial activity.
        </li>
        <li>
          Abuse the AI features to generate illegal content, defamatory
          material, or content that violates third-party rights.
        </li>
        <li>
          Use one Stackivo account for multiple businesses or individuals without
          the appropriate Business plan and team access.
        </li>
      </ul>
      <p>
        We reserve the right to suspend or permanently terminate accounts that
        breach these rules, with or without prior notice, depending on the
        severity of the violation.
      </p>

      <h2>8. Intellectual property</h2>
      <ul>
        <li>
          The Stackivo name, logo, product design, codebase, documentation, and
          all associated intellectual property are owned by the founder of Stackivo and protected by Indian and international IP law.
        </li>
        <li>
          Your use of the Service does not grant you any rights in our
          intellectual property beyond the limited licence to use the Service as
          described in these Terms.
        </li>
        <li>
          Any feedback, suggestions, or ideas you share with us may be used by
          us to improve the Service without compensation or obligation to you.
        </li>
      </ul>

      <h2>9. Third-party services</h2>
      <p>
        The Service integrates with third-party services including Razorpay,
        Supabase, Brevo, Groq, PostHog, Microsoft Clarity, Sentry, Cloudflare,
        and Vercel. Your use of these integrations is also
        governed by those providers&rsquo; own terms of service and privacy
        policies. We are not responsible for the acts or omissions of
        third-party providers, nor for any downtime or data loss caused by them.
      </p>
      <p>
        Payment processing is handled by Razorpay. By making or receiving
        payments through Stackivo, you agree to{" "}
        <a
          href="https://razorpay.com/terms/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Razorpay&rsquo;s terms
        </a>
        .
      </p>

      <h2>10. Service availability and modifications</h2>
      <ul>
        <li>
          We aim for high availability but do not guarantee uninterrupted or
          error-free access. We may perform scheduled or emergency maintenance at
          any time.
        </li>
        <li>
          We may add, modify, or remove features of the Service at any time. For
          significant removals affecting paid features, we will provide at least
          30 days&rsquo; notice.
        </li>
        <li>
          In the event of an extended outage caused by Stackivo (not
          third-party providers), paid users may request a prorated credit for
          the affected period.
        </li>
      </ul>

      <h2>11. Storage limits</h2>
      <p>
        File storage is subject to the limits of your Plan (100 MB on Free, 5
        GB on Pro, 50 GB on Business). If you exceed your storage limit, you
        will not be able to upload new files until you upgrade or free up space.
        We will notify you when you approach your limit.
      </p>

      <h2>12. Client relationships</h2>
      <p>
        Stackivo is a tool you use to manage your client relationships.{" "}
        <strong>
          We are not a party to any agreement between you and your clients.
        </strong>{" "}
        Contracts you create and send through Stackivo are legally between you
        and your client — Stackivo is only the delivery and signing platform.
        We are not responsible for:
      </p>
      <ul>
        <li>Disputes between you and your clients.</li>
        <li>Non-payment by your clients.</li>
        <li>
          The legal enforceability of contracts created using Stackivo in any
          particular jurisdiction.
        </li>
        <li>
          Any errors in your invoices or contracts that you failed to review
          before sending.
        </li>
      </ul>
      <h3>Payments &mdash; we never handle your money</h3>
      <p>
        Stackivo is a document, hosting, and e-signature platform &mdash;{" "}
        <strong>
          not a payment processor, payment aggregator, escrow service, or money
          transmitter
        </strong>
        . We never collect, hold, route, or have access to funds paid by your
        clients. Any payment details shown on an invoice (UPI, Wise, PayPal,
        Payoneer, bank account, and similar) are <strong>your own</strong>{" "}
        accounts that you choose to display; payment is made directly by your
        client to you on those platforms, subject to those platforms&rsquo; own
        terms. You are solely responsible for collecting, reconciling, refunding,
        and reporting those payments.
      </p>
      <p>
        Stackivo acts as an <strong>intermediary</strong> that hosts and
        transmits content you create. Invoices, contracts, and other documents
        are generated by you from your own inputs; you are responsible for their
        accuracy, legality, and compliance in every applicable jurisdiction.
        Stackivo does not provide legal, tax, accounting, or financial advice
        &mdash; templates and automated fields are conveniences, not advice.
      </p>
      <h3>Electronic signatures</h3>
      <p>
        Stackivo&rsquo;s signing feature creates an{" "}
        <strong>electronic signature</strong> within the meaning of the
        Information Technology Act, 2000. Before signing, the signatory
        explicitly consents to signing electronically. For each signature we
        record an audit trail — the signatory&rsquo;s name, email, IP address,
        device/user-agent, timestamp, and a cryptographic hash of the signed
        document — and embed it in a signature certificate so the signed record
        is tamper-evident.
      </p>
      <p>
        The evidentiary value of an electronic signature depends on attribution
        and the integrity of the record. Stackivo provides the audit trail to
        support this but does <strong>not</strong> guarantee the legal
        admissibility or enforceability of any signed document in a particular
        matter or jurisdiction.
      </p>
      <p>
        <strong>Documents that cannot be signed electronically.</strong> Under
        the First Schedule of the IT Act, 2000, certain documents are excluded
        from electronic execution — including negotiable instruments (other than
        cheques), powers of attorney, trusts, wills and other testamentary
        dispositions, and contracts for the sale or conveyance of immovable
        property. You must <strong>not</strong> use Stackivo&rsquo;s e-signature
        feature for any such document. For these, and for high-value or
        regulated contracts, use a certified Digital Signature Certificate (DSC)
        or Aadhaar eSign and consult a lawyer.
      </p>

      <h2>13. GST and tax compliance</h2>
      <p>
        Stackivo automates GST calculations (CGST, SGST, IGST) based on the
        addresses and GSTINs you provide. You are responsible for:
      </p>
      <ul>
        <li>
          Entering accurate business address and GSTIN information so that the
          correct tax type is applied.
        </li>
        <li>Filing your GST returns (GSTR-1, GSTR-3B, etc.) correctly.</li>
        <li>
          Verifying the GST amounts on your invoices before sending them to
          clients.
        </li>
      </ul>
      <p>
        Stackivo is a calculation and compliance aid, not a tax advisor. We are
        not responsible for errors arising from incorrect information you provide
        or from changes in tax regulations that have not yet been reflected in
        the Service.
      </p>
      <h3>International invoicing and exports</h3>
      <p>
        For clients outside India, Stackivo helps you issue invoices in the
        client&rsquo;s currency and records the exchange rate at the time of
        issue for your books. You remain responsible for:
      </p>
      <ul>
        <li>
          Determining whether your supply qualifies as an{" "}
          <strong>export of services</strong> and, if you are GST-registered,
          filing a valid <strong>LUT</strong> before issuing zero-rated export
          invoices (or paying IGST and claiming a refund).
        </li>
        <li>
          Realising export proceeds in convertible foreign exchange through
          banking channels within the timelines under{" "}
          <strong>FEMA / RBI</strong> rules, tagging the correct purpose code,
          and retaining your FIRC / eBRC.
        </li>
        <li>
          Any taxes (such as VAT or GST) that may apply in your client&rsquo;s
          country &mdash; these are typically the client&rsquo;s responsibility
          under reverse charge, but you must confirm the position for each
          engagement.
        </li>
      </ul>
      <p>
        Exchange rates shown in Stackivo are indicative, captured from a
        third-party source at issue time for record-keeping; they are not a
        guaranteed or official conversion rate. Confirm figures with your bank
        and accountant.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable Indian law:
      </p>
      <ul>
        <li>
          <strong>Total liability cap</strong>: Stackivo&rsquo;s total
          cumulative liability arising out of or related to the Service is
          limited to the greater of (a) the amount you paid us in the{" "}
          <strong>12 months</strong> preceding the event giving rise to the
          claim, or (b) ₹5,000.
        </li>
        <li>
          <strong>Exclusion of indirect damages</strong>: we are not liable for
          any indirect, incidental, special, consequential, or punitive damages,
          including loss of profits, loss of data, loss of goodwill, or business
          interruption — even if we have been advised of the possibility of such
          damages.
        </li>
        <li>
          <strong>AI outputs</strong>: we are not liable for any loss or damage
          arising from your reliance on AI-generated content (invoices,
          contracts, welcome documents) without adequate review.
        </li>
        <li>
          <strong>Third-party services</strong>: we are not liable for any
          failure, outage, data loss, or security incident caused by
          third-party providers (Razorpay, Supabase, Groq, Cloudflare, etc.).
        </li>
        <li>
          <strong>Client relationships</strong>: we are not liable for disputes,
          non-payment, or losses arising from your relationships with your
          clients.
        </li>
      </ul>
      <p>
        Nothing in these Terms limits liability that cannot be excluded under
        mandatory Indian consumer protection law.
      </p>

      <h2>15. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless Stackivo and its team from any claim, loss, damage, or expense
        (including reasonable legal fees) arising from:
      </p>
      <ul>
        <li>Your violation of these Terms.</li>
        <li>
          Your User Content, including any infringement of third-party
          intellectual property rights.
        </li>
        <li>Your use of the Service in an unlawful manner.</li>
        <li>Any dispute between you and your clients.</li>
      </ul>

      <h2>16. Termination</h2>
      <ul>
        <li>
          <strong>By you</strong>: you may cancel your subscription or delete
          your account at any time from Settings. Deletion is immediate and
          subject to the data retention policy in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </li>
        <li>
          <strong>By us</strong>: we may suspend or terminate your account
          immediately if you materially breach these Terms, if required by law,
          or if your account poses a security or legal risk to us or other users.
          For less severe violations, we will generally give notice and an
          opportunity to remedy the breach first.
        </li>
        <li>
          On termination for any reason, your right to use the Service ends
          immediately. Sections 6, 8, 14, 15, 17, and 18 survive termination.
        </li>
      </ul>

      <h2>17. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of the Republic of India. Any
        dispute arising out of or related to these Terms or the Service shall
        first be attempted to be resolved through good-faith negotiation. If
        unresolved after 30 days, disputes shall be subject to the exclusive
        jurisdiction of the courts in <strong>Indore, Madhya Pradesh, India</strong>,
        unless mandatory consumer protection law requires otherwise.
      </p>

      <h2>18. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        communicated by email or in-product notice at least{" "}
        <strong>14 days</strong> before they take effect. The effective date at
        the top of this page reflects the current version. Continued use of the
        Service after the effective date constitutes acceptance of the updated
        Terms.
      </p>
      <p>
        If you do not agree with a material change, you may cancel your
        subscription before it takes effect and request a prorated refund for
        any unused paid period.
      </p>

      <h2>19. Entire agreement and severability</h2>
      <p>
        These Terms, together with the{" "}
        <Link href="/privacy">Privacy Policy</Link>, constitute the entire
        agreement between you and Stackivo regarding the Service and supersede
        any prior agreements. If any provision is found unenforceable, the
        remaining provisions continue in full force.
      </p>

      <h2>20. Contact</h2>
      <p>
        Questions about these Terms? Reach us at:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a>
        </li>
        <li>
          Contact form: <Link href="/contact">stackivo.me/contact</Link>
        </li>
        <li>
          Address: Stackivo, Indore, Madhya Pradesh, India
        </li>
      </ul>
    </ProsePage>
  );
}
