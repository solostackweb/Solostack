import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy · Stackivo",
  description:
    "How Stackivo collects, uses, and protects your personal data — covering all third-party services, AI processing, and your rights under India's DPDP Act.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Stackivo Privacy Policy",
    description: "How we collect, use, and protect your personal data.",
    url: `${siteConfig.url}/privacy`,
  },
};

export const dynamic = "force-static";

const EFFECTIVE_DATE = "1 January 2026";

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy Policy"
      lead={
        <>
          Effective: {EFFECTIVE_DATE}. We treat your data the way we&rsquo;d
          want ours treated — with respect, transparency, and the minimum
          collection necessary to run the service. This policy explains
          everything we collect, why we collect it, where it goes, and how you
          can control it.
        </>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        Stackivo (the &ldquo;<strong>Service</strong>&rdquo;) is an independently operated product based in Indore, India. We act as the{" "}
        <strong>data fiduciary</strong> under India&rsquo;s Digital Personal
        Data Protection Act, 2023 (DPDP Act) for all personal data you provide
        through the Service.
      </p>
      <p>
        Questions or requests? Email{" "}
        <a href="mailto:support@stackivo.me">support@stackivo.me</a>.
      </p>

      <h2>2. What we collect</h2>

      <h3>Account data</h3>
      <ul>
        <li>
          Name, email address, and password (stored as a bcrypt hash — we
          never see your plain-text password).
        </li>
        <li>Profile photo, if you choose to upload one.</li>
        <li>
          Business information you provide during onboarding or settings:
          business name, legal entity type, address, GSTIN, phone, and website.
        </li>
      </ul>

      <h3>Operational / business data</h3>
      <ul>
        <li>
          Everything you create inside Stackivo: clients, projects, invoices,
          contracts, time entries, welcome documents, and files (logos,
          signatures, attachments).
        </li>
        <li>
          Payment and subscription records: Razorpay payment IDs, subscription
          IDs, plan history, and billing amounts. We do{" "}
          <strong>not</strong> store card numbers or UPI VPAs — those are
          handled entirely by Razorpay.
        </li>
        <li>
          Client portal activity: messages sent and received, files shared, and
          timestamps.
        </li>
      </ul>

      <h3>AI workflow inputs</h3>
      <ul>
        <li>
          When you use the <strong>Ask AI</strong> feature, the text you type
          (your prompt) is sent to <strong>Groq&rsquo;s API</strong> to
          generate a structured response. This includes the descriptions you
          write for invoices, contracts, welcome documents, clients, and
          projects.
        </li>
        <li>
          We minimise what is sent: only the text you enter in the AI chat and
          the workspace context you explicitly select (client name, project
          name) are forwarded.
        </li>
        <li>
          Stackivo does <strong>not</strong> use your AI prompts or the content
          of your workspace to train any AI model. Groq&rsquo;s API is used
          for inference only.
        </li>
      </ul>

      <h3>Telemetry and logs</h3>
      <ul>
        <li>
          IP address, user agent, and access timestamps — retained for 90 days
          for security and abuse prevention.
        </li>
        <li>
          Product usage events (e.g. which features are used, pages visited,
          button clicks) — collected via <strong>PostHog</strong> with
          personal identifiers stripped. These events respect your
          browser&rsquo;s Do Not Track signal.
        </li>
        <li>
          Session recordings and heatmaps via <strong>Microsoft Clarity</strong>{" "}
          to understand how users interact with the interface. Clarity
          automatically masks text input fields so your invoice and client data
          is not captured in recordings.
        </li>
        <li>
          Error reports via <strong>Sentry</strong> — scrubbed of credentials
          and sensitive field values before transmission.
        </li>
      </ul>

      <h3>Cookies and local storage</h3>
      <ul>
        <li>
          <strong>Strictly necessary</strong>: Authentication session cookies
          (HTTP-only, Secure) set by Supabase. These are required for you to
          stay logged in and cannot be opted out of while using the Service.
        </li>
        <li>
          <strong>Analytics</strong>: PostHog and Microsoft Clarity use cookies
          to distinguish sessions. PostHog respects Do Not Track. You can opt
          out of Clarity via browser settings or a privacy-respecting browser
          extension.
        </li>
        <li>
          <strong>Support</strong>: your support conversations are stored
          first-party within Stackivo and linked to your account.
        </li>
        <li>
          We do <strong>not</strong> place any third-party advertising or
          retargeting cookies.
        </li>
      </ul>

      <h2>3. How we use your data</h2>
      <ul>
        <li>
          <strong>To operate the Service</strong>: authenticate you, store your
          workspace data, generate invoices and contracts, process payments, and
          deliver transactional emails.
        </li>
        <li>
          <strong>To power AI workflows</strong>: forward your AI chat prompts
          to Groq&rsquo;s API to generate invoice drafts, contract drafts,
          welcome document drafts, client records, and project records on your
          behalf.
        </li>
        <li>
          <strong>To process payments and subscriptions</strong>: pass
          transaction data to Razorpay (our PCI-compliant payment processor).
        </li>
        <li>
          <strong>To send transactional email</strong>: invoice delivery,
          payment receipts, contract signature requests, security alerts, and
          password resets — via Brevo.
        </li>
        <li>
          <strong>To improve the product</strong>: aggregated, anonymised
          analytics help us understand which features are used and where users
          encounter friction.
        </li>
        <li>
          <strong>To prevent fraud and ensure security</strong>: monitor login
          attempts, detect suspicious activity, and enforce rate limits.
        </li>
        <li>
          <strong>To meet legal obligations</strong>: retain GST invoice records
          as required by Indian tax law.
        </li>
      </ul>
      <p>
        <strong>We do not sell your data.</strong> We do not use your data to
        train AI models. We do not use your data for advertising.
      </p>

      <h2>4. Third-party sub-processors</h2>
      <p>
        We share data with the following service providers, each under a data
        processing agreement, and only to the extent necessary to deliver the
        Service:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (Frankfurt, Germany) — PostgreSQL database
          and authentication. All business data lives here.
        </li>
        <li>
          <strong>Cloudflare R2</strong> (EU region) — object storage for files
          you upload: logos, contract attachments, portal files, signed PDFs.
        </li>
        <li>
          <strong>Razorpay</strong> (India) — payment processing and
          subscription management. Governed by Razorpay&rsquo;s own privacy
          policy and PCI-DSS compliance.
        </li>
        <li>
          <strong>Brevo</strong> (EU) — transactional email delivery. Your
          name and email are shared with Brevo only to send emails on your
          behalf.
        </li>
        <li>
          <strong>Groq</strong> (USA) — AI inference API used by the Ask AI
          feature. Your AI prompts and the workspace context you select are
          sent to Groq. No training on your data.
        </li>
        <li>
          <strong>PostHog</strong> (EU) — product analytics. Anonymised usage
          events only.
        </li>
        <li>
          <strong>Microsoft Clarity</strong> (USA) — session recording and
          heatmaps. Input fields are masked. Governed by
          Microsoft&rsquo;s privacy policy.
        </li>
        <li>
          <strong>Sentry</strong> (EU) — error and performance monitoring.
          Credentials and sensitive values are scrubbed before transmission.
        </li>
        <li>
          <strong>Cloudflare</strong> (global) — DNS and inbound email routing
          for <code>support@stackivo.me</code>. Support conversations
          themselves are stored first-party in Stackivo, not by a third-party
          help-desk.
        </li>
        <li>
          <strong>Vercel</strong> (USA) — hosting and edge network. Request
          logs are retained per Vercel&rsquo;s policy.
        </li>
      </ul>

      <h2>5. International data transfers</h2>
      <p>
        Several of our sub-processors process data outside India (notably
        Supabase in Germany, Cloudflare R2 in the EU, Groq and Microsoft
        Clarity in the USA, and Vercel globally). We rely on standard
        contractual clauses or equivalent transfer mechanisms where required.
        We choose processors with strong data protection practices and are
        satisfied they adequately protect your data.
      </p>

      <h2>6. Data retention</h2>
      <ul>
        <li>
          <strong>Account and operational data</strong>: retained while your
          account is active.
        </li>
        <li>
          <strong>On account deletion</strong>: your data is soft-deleted
          immediately (no longer accessible to you or us in normal operation)
          and permanently deleted after a 30-day recovery window.
        </li>
        <li>
          <strong>GST invoice records</strong>: retained for 8 years in
          anonymised form, as required by Indian tax law, even after account
          deletion.
        </li>
        <li>
          <strong>Server and access logs</strong>: 90 days.
        </li>
        <li>
          <strong>Support conversations</strong>: retained for 2 years within
          Stackivo to assist with follow-up.
        </li>
        <li>
          <strong>AI prompt logs</strong>: Stackivo does not store your AI
          prompt text beyond the current session. Groq&rsquo;s own retention
          policy governs API request logs on their side.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>
        Under the DPDP Act and general principles of data protection, you have
        the right to:
      </p>
      <ul>
        <li>
          <strong>Access</strong>: know what data we hold about you.
        </li>
        <li>
          <strong>Correction</strong>: update inaccurate or incomplete data
          (most of this you can do yourself in Settings).
        </li>
        <li>
          <strong>Erasure</strong>: request deletion of your account and all
          associated data (subject to legal retention obligations for GST
          records).
        </li>
        <li>
          <strong>Portability</strong>: export your data as JSON from{" "}
          <strong>Settings → Data &amp; export</strong> in the dashboard.
        </li>
        <li>
          <strong>Objection / restriction</strong>: object to specific
          processing activities by emailing us.
        </li>
        <li>
          <strong>Withdraw consent</strong>: where processing is based on
          consent (e.g. optional analytics), you can withdraw it by adjusting
          your browser settings or contacting us.
        </li>
      </ul>
      <p>To exercise any right, email us at:</p>
      <ul>
        <li>
          <a href="mailto:support@stackivo.me">support@stackivo.me</a> — we
          respond within 30 days.
        </li>
        <li>
          Or delete your account directly from{" "}
          <strong>Settings → Account → Delete account</strong>.
        </li>
      </ul>
      <p>
        You may also lodge a complaint with the{" "}
        <strong>Indian Data Protection Board</strong> if you are unsatisfied
        with our response.
      </p>

      <h2>8. Security</h2>
      <ul>
        <li>
          All data in transit is encrypted with <strong>TLS 1.2 or higher</strong>.
          Data at rest is encrypted at the database and storage layer.
        </li>
        <li>
          Workspace data is isolated using{" "}
          <strong>Supabase Row Level Security (RLS)</strong> — users can only
          access their own data.
        </li>
        <li>
          Passwords are hashed with <strong>bcrypt</strong>; sessions use
          secure, HTTP-only cookies.
        </li>
        <li>
          <strong>Two-factor authentication (TOTP)</strong> is available in
          account settings and strongly recommended.
        </li>
        <li>
          We monitor for security events and alert on suspicious activity such
          as multiple failed login attempts.
        </li>
        <li>
          In the event of a confirmed data breach, we will notify affected users
          within <strong>72 hours</strong> of becoming aware, in accordance
          with the DPDP Act.
        </li>
      </ul>

      <h2>9. Children</h2>
      <p>
        Stackivo is not intended for users under 18. We do not knowingly
        collect personal data from anyone under 18. If you believe a minor has
        registered, please contact us at{" "}
        <a href="mailto:support@stackivo.me">support@stackivo.me</a> and we
        will delete the account promptly.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy when we add new features or sub-processors,
        or when laws change. Material changes will be announced via email or
        in-product notice at least <strong>14 days</strong> before they take
        effect. The effective date at the top of this page always reflects the
        latest version. Continued use of Stackivo after the effective date
        constitutes acceptance of the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        For privacy-related questions, data requests, or complaints:
      </p>
      <ul>
        <li>
          Email:{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a>
        </li>
        <li>
          General contact:{" "}
          <Link href="/contact">stackivo.me/contact</Link>
        </li>
        <li>
          Address: Stackivo, Indore, Madhya Pradesh, India
        </li>
      </ul>

      <h2>12. Grievance Officer</h2>
      <p>
        In accordance with the Information Technology Act, 2000, the
        Information Technology (Intermediary Guidelines and Digital Media
        Ethics Code) Rules, 2021, and the grievance-redressal requirements of
        the DPDP Act, 2023, you can escalate unresolved concerns to our
        designated Grievance Officer:
      </p>
      <ul>
        <li>
          <strong>Grievance Officer</strong> — Stackivo,
          Indore, Madhya Pradesh, India
        </li>
        <li>
          Email:{" "}
          <a href="mailto:grievance@stackivo.me">grievance@stackivo.me</a>
        </li>
        <li>
          We acknowledge grievances within <strong>48 hours</strong> and aim
          to resolve them within <strong>15 days</strong> of receipt.
        </li>
      </ul>
      <p>
        If you remain unsatisfied after our response, you may complain to the
        Data Protection Board of India once constituted under the DPDP Act.
      </p>
    </ProsePage>
  );
}
