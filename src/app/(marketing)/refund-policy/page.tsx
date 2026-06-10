import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · Stackivo",
  description:
    "Stackivo's refund and cancellation policy — 30-day money-back guarantee on paid plans, cancel anytime, refunds processed via Razorpay to your original payment method.",
  alternates: { canonical: "/refund-policy" },
  openGraph: {
    title: "Stackivo Refund & Cancellation Policy",
    description:
      "30-day money-back guarantee on paid plans. Cancel anytime. Refunds via Razorpay.",
    url: `${siteConfig.url}/refund-policy`,
  },
};

export const dynamic = "force-static";

const EFFECTIVE_DATE = "1 January 2026";

export default function RefundPolicyPage() {
  return (
    <ProsePage
      title="Refund & Cancellation Policy"
      lead={
        <>
          Effective: {EFFECTIVE_DATE}. Stackivo is a digital
          software-as-a-service product — nothing is shipped, so this policy
          covers subscriptions only. The short version: 30-day money-back
          guarantee on paid plans, cancel anytime, no questions that matter.
        </>
      }
    >
      <h2>1. Who this applies to</h2>
      <p>
        This policy applies to all paid subscriptions of Stackivo (the
        &ldquo;<strong>Service</strong>&rdquo;), operated independently from Indore, Madhya Pradesh, India. The Free plan involves no
        payment and therefore no refunds. This policy should be read together
        with our <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>2. 30-day money-back guarantee</h2>
      <ul>
        <li>
          You may request a <strong>full refund within 30 days</strong> of any
          first-time payment for a plan — monthly or annual.
        </li>
        <li>
          No forms and no interrogation: email{" "}
          <a href="mailto:support@stackivo.me">support@stackivo.me</a> from
          your registered email address with the subject &ldquo;Refund
          request&rdquo;.
        </li>
        <li>
          After the 30-day window, payments are non-refundable, except where a
          refund is required by applicable Indian law or expressly stated in
          this policy.
        </li>
      </ul>

      <h2>3. Cancelling your subscription</h2>
      <ul>
        <li>
          Cancel anytime from{" "}
          <strong>Dashboard → Settings → Billing</strong> — no email or call
          required.
        </li>
        <li>
          Cancellation stops the next renewal. Your paid features remain
          active until the end of the period you have already paid for; we do
          not charge cancellation fees.
        </li>
        <li>
          After your paid period ends, your account moves to the Free plan.
          Your data is never deleted on downgrade — but Free-plan limits (such
          as the 5-client cap) apply to new activity.
        </li>
      </ul>

      <h2>4. Renewals</h2>
      <ul>
        <li>
          Subscriptions renew automatically via Razorpay at the price shown in
          your billing settings. We send a reminder before annual renewals.
        </li>
        <li>
          If you forgot to cancel and were charged on renewal, contact us
          within <strong>7 days</strong> of the charge — provided the renewed
          period is materially unused, we will refund it in full.
        </li>
      </ul>

      <h2>5. How refunds are processed</h2>
      <ul>
        <li>
          Refunds are issued to the <strong>original payment method</strong>{" "}
          (UPI, card, netbanking, or wallet) through Razorpay.
        </li>
        <li>
          We initiate approved refunds within <strong>3 business days</strong>.
          Razorpay and your bank typically take a further{" "}
          <strong>5–7 business days</strong> to credit your account.
        </li>
        <li>
          Refunds are made in INR for the amount you actually paid, including
          GST charged on it. We cannot control currency-conversion or bank
          charges levied by your bank.
        </li>
      </ul>

      <h2>6. Price or plan changes</h2>
      <p>
        If we change your plan&rsquo;s pricing or materially reduce what it
        includes, we will notify you in advance. If you do not accept the
        change, you may cancel before it takes effect and request a{" "}
        <strong>prorated refund</strong> for the unused part of any prepaid
        period.
      </p>

      <h2>7. Exceptions and fair use</h2>
      <ul>
        <li>
          Accounts terminated for serious violations of our{" "}
          <Link href="/terms">Terms of Service</Link> (fraud, abuse, illegal
          use) are not eligible for refunds.
        </li>
        <li>
          The money-back guarantee applies to your first purchase of a plan.
          Repeated subscribe-refund cycles may be declined as abuse.
        </li>
        <li>
          Nothing in this policy limits any non-waivable rights you have under
          the Consumer Protection Act, 2019 or other applicable Indian law.
        </li>
      </ul>

      <h2>8. Grievance redressal</h2>
      <p>
        If you believe a refund or cancellation was handled incorrectly,
        escalate to our Grievance Officer:
      </p>
      <ul>
        <li>
          <strong>Grievance Officer</strong> — Stackivo,
          Indore, Madhya Pradesh, India
        </li>
        <li>
          Email: <a href="mailto:grievance@stackivo.me">grievance@stackivo.me</a>{" "}
          (cc <a href="mailto:support@stackivo.me">support@stackivo.me</a>)
        </li>
        <li>
          We acknowledge complaints within <strong>48 hours</strong> and aim to
          resolve them within <strong>15 days</strong>, in line with the
          Information Technology Rules and the Consumer Protection
          (E-Commerce) Rules, 2020.
        </li>
      </ul>

      <h2>9. Governing law</h2>
      <p>
        This policy is governed by the laws of India. Courts at Indore, Madhya
        Pradesh have exclusive jurisdiction, as set out in our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes are
        announced by email or in-app notice at least 14 days before they take
        effect. The effective date at the top always reflects the current
        version.
      </p>
    </ProsePage>
  );
}
