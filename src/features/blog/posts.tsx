import Link from "next/link";
import type { BlogPost } from "./types";

/**
 * Hand-authored blog posts.
 *
 * Newest first. To add a post:
 *   1. Append to the array (do NOT reorder, RSS feed cares).
 *   2. Run `npx tsc --noEmit` to catch typos.
 *   3. The post auto-renders at /blog/<slug>, joins /blog index,
 *      and ships in the next sitemap rebuild.
 *
 * Author voice: practical, honest, India-specific. Mostly 600–800
 * words. Each post ends with a tool / pricing / signup link so
 * the reader has somewhere to go.
 */

// ---------------------------------------------------------------------------
// Small reusable building blocks so each post body stays compact.
// ---------------------------------------------------------------------------

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="lead text-xl leading-relaxed text-foreground">{children}</p>
  );
}

function Cta({
  href,
  children,
  cta,
}: {
  href: string;
  children: React.ReactNode;
  cta: string;
}) {
  return (
    <div className="not-prose my-8 rounded-lg border bg-card p-5">
      <p className="text-sm font-medium">
        {children}{" "}
        <Link
          href={href}
          data-cta={cta}
          className="text-primary underline-offset-4 hover:underline"
        >
          Open it &rarr;
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export const POSTS: readonly BlogPost[] = [
  {
    slug: "gst-invoice-format-for-freelancers-india",
    title: "GST invoice format for freelancers in India (with template)",
    description:
      "What a legally-valid GST invoice must contain in 2026, the CGST/SGST/IGST split rule, and a copy-paste template you can use today.",
    publishedAt: "2026-05-12",
    category: "GST & Tax",
    readingMinutes: 6,
    body: (
      <>
        <Lede>
          If you&rsquo;re a freelancer in India and your turnover has crossed
          (or will cross) ₹20 lakh, you need to register for GST and start
          issuing GST-compliant invoices. This guide covers exactly what those
          invoices must contain &mdash; nothing more, nothing less.
        </Lede>

        <h2>The 14 fields a GST invoice must have</h2>
        <p>
          Per Rule 46 of the CGST Rules, every tax invoice issued by a
          registered supplier must include:
        </p>
        <ol>
          <li>Your name, address, and GSTIN.</li>
          <li>
            A unique, sequential invoice number &mdash; max 16 characters,
            alpha-numeric, no breaks in the series.
          </li>
          <li>Date of issue.</li>
          <li>Client name, address, and GSTIN (if registered).</li>
          <li>
            For inter-state supplies to unregistered clients above ₹50,000:
            the &ldquo;address of delivery&rdquo; with state name + code.
          </li>
          <li>HSN / SAC code (more on this below).</li>
          <li>Description of the service.</li>
          <li>Quantity / unit (or &ldquo;1 service&rdquo;).</li>
          <li>Total value of supply.</li>
          <li>Discount, if any.</li>
          <li>Taxable value.</li>
          <li>Tax rate (5/12/18/28%) and the amount of tax charged.</li>
          <li>
            Place of supply &mdash; this decides whether you charge CGST+SGST
            or IGST.
          </li>
          <li>Your signature (or e-signature).</li>
        </ol>

        <h2>HSN / SAC code &mdash; do you really need it?</h2>
        <p>
          SAC codes are 6-digit identifiers for services. For freelancers
          most likely codes are:
        </p>
        <ul>
          <li>
            <strong>998314</strong> &mdash; IT and software design / consulting
          </li>
          <li>
            <strong>998311</strong> &mdash; Management consulting
          </li>
          <li>
            <strong>998363</strong> &mdash; Advertising services
          </li>
          <li>
            <strong>998391</strong> &mdash; Photography
          </li>
          <li>
            <strong>998599</strong> &mdash; Other support services
          </li>
        </ul>
        <p>
          If your aggregate turnover in the previous financial year was below
          ₹5 crore, you only need the first 4 digits of the SAC code.
        </p>

        <h2>CGST + SGST or IGST? The place-of-supply rule</h2>
        <p>
          Place of supply for services is governed by Section 12 of the IGST
          Act. The simplest version of the rule:
        </p>
        <ul>
          <li>
            <strong>Client&rsquo;s state = your state</strong> &mdash; charge
            CGST (rate/2) + SGST (rate/2). Both go to the central
            government&rsquo;s pool but appear as two line items.
          </li>
          <li>
            <strong>Client&rsquo;s state ≠ your state</strong> &mdash; charge
            IGST (full rate).
          </li>
        </ul>
        <p>
          For freelance services to unregistered clients (B2C), the place of
          supply is generally the location of the recipient (when known) or
          your location (default).
        </p>

        <Cta href="/tools/gst-calculator" cta="blog_gst_invoice_to_calc">
          Stop computing this manually &mdash; use our free GST calculator to
          generate the exact CGST/SGST/IGST split.
        </Cta>

        <h2>What about the e-invoice mandate?</h2>
        <p>
          E-invoicing (IRN generation through the GST portal) is mandatory
          only if your aggregate turnover crosses ₹5 crore. Below that, plain
          GST tax invoices are perfectly valid.
        </p>

        <h2>The fastest legal template</h2>
        <p>
          Need a copy-paste template that hits all 14 fields plus a clean
          PDF layout? Two options:
        </p>
        <ol>
          <li>
            <Link href="/contact">Email us</Link> for the free Excel template
            (we&rsquo;ll send it). Hits every Rule-46 field, computes the tax
            split automatically.
          </li>
          <li>
            Or skip the template entirely:{" "}
            <Link href="/signup" data-cta="blog_gst_invoice_to_signup">
              start Stackivo free
            </Link>{" "}
            &mdash; we generate the invoice, the PDF, the place-of-supply
            logic, and the email-to-client in one click.
          </li>
        </ol>

        <h2>Common mistakes to avoid</h2>
        <ul>
          <li>
            Skipping the invoice number when an invoice is voided. (You
            can&rsquo;t &mdash; the sequence must be continuous. Issue a
            credit note instead.)
          </li>
          <li>
            Charging CGST + SGST on inter-state work. (Wrong tax type =
            client can&rsquo;t claim input tax credit.)
          </li>
          <li>
            Forgetting your GSTIN on the invoice. (Without it, the client
            can&rsquo;t claim ITC and may dispute the bill.)
          </li>
          <li>
            Issuing an invoice from a Word doc. (Fine legally; brutal
            practically &mdash; tracking sequence + filing GSTR-1 becomes
            painful.)
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "how-to-set-your-freelance-rate-india",
    title: "How to set your freelance rate in India (and stop undercharging)",
    description:
      "A pragmatic formula for setting your hourly rate, with realistic billable hours, expenses, and tax baked in. Plus the moves that get clients to actually pay it.",
    publishedAt: "2026-05-08",
    category: "Pricing",
    readingMinutes: 7,
    body: (
      <>
        <Lede>
          Most freelancers in India anchor their rate to what a salaried
          employee earns per hour. That&rsquo;s the wrong number. Here&rsquo;s
          the right calculation, and how to actually charge it.
        </Lede>

        <h2>Why salary-to-hour math under-prices you</h2>
        <p>
          A ₹12L/year salaried employee gets paid for ~2,000 hours a year and
          their employer pays for laptops, EPF, gratuity, leave, sick days,
          and the building they sit in. Divide ₹12L by 2,000 and you get
          ₹600/hour &mdash; but that&rsquo;s the <em>employer&rsquo;s</em>{" "}
          cost-to-company, not the equivalent freelance hourly rate.
        </p>
        <p>
          As a freelancer:
        </p>
        <ul>
          <li>You only bill ~50&ndash;70% of your working hours. The rest is sales, admin, scoping, revisions.</li>
          <li>You pay your own software, internet, hardware, and accountant.</li>
          <li>You take leave on your own dime.</li>
          <li>You absorb client-side risk: late payment, scope creep, ghost-projects.</li>
        </ul>

        <h2>The honest formula</h2>
        <pre className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">{`hourly_rate = (target_income / (1 - tax_rate) + annual_expenses)
              / (working_weeks * hours_per_week * billable_pct)`}</pre>
        <p>
          Plug numbers in:
        </p>
        <ul>
          <li>Target take-home: ₹12,00,000/year</li>
          <li>Tax (44ADA presumptive, ≤ ₹50L turnover): effectively 0%</li>
          <li>Annual expenses: ₹1,20,000</li>
          <li>Working weeks: 48 (4 weeks buffer for festivals + sickness + holidays)</li>
          <li>Hours/week: 40</li>
          <li>Billable: 60%</li>
        </ul>
        <p>
          That gives a billable-hours base of ~1,152 hours, gross income
          needed of ~₹13.2L, hourly rate ≈ <strong>₹1,150/hour</strong>.
        </p>

        <Cta href="/tools/freelance-rate-calculator" cta="blog_rate_to_calc">
          Skip the algebra &mdash; use the rate calculator. It does the math
          and rounds up to the nearest ₹50 for negotiation comfort.
        </Cta>

        <h2>The four moves that get clients to pay your real rate</h2>

        <h3>1. Price by outcome where possible, not by hour</h3>
        <p>
          Hourly billing caps your earnings at your speed. &ldquo;A logo
          rebrand: ₹85,000&rdquo; lets a fast 6-hour project pay like a
          20-hour one. The client also stops worrying about you padding hours.
        </p>

        <h3>2. Tier 3 packages, always</h3>
        <p>
          When you list a single price, the negotiation is &ldquo;your price
          vs the next person&rdquo;. List three (Standard / Recommended /
          Premium) and the negotiation becomes &ldquo;which of your packages
          fits&rdquo;. Recommended is what 60% of clients pick &mdash; that&rsquo;s
          what you anchor on.
        </p>

        <h3>3. Discount the bottom, not the top</h3>
        <p>
          When someone pushes back, never drop the price of your standard
          offer. Take features out instead &mdash; fewer revisions, faster
          turnaround removed, fewer deliverables. The client now sees a
          clear ladder: pay less to get less.
        </p>

        <h3>4. Quote ranges, not exact numbers, for new clients</h3>
        <p>
          &ldquo;₹50,000 to ₹85,000 depending on scope&rdquo; lets you settle
          on the high end when the actual project is bigger than they
          described. A flat &ldquo;₹50,000&rdquo; locks you in.
        </p>

        <h2>Annual rate increase: do it</h2>
        <p>
          Raise your rate ~10% every 6&ndash;12 months. Most clients
          don&rsquo;t even notice; the ones who do are the ones who would have
          churned anyway. Long-term retainers should have an inflation clause
          baked in (CPI + 3%, capped at 15%).
        </p>

        <p>
          When you&rsquo;re ready to put the rate on a real invoice,{" "}
          <Link href="/signup" data-cta="blog_rate_to_signup">start Stackivo free</Link>{" "}
          &mdash; we&rsquo;ll handle the GST math, the PDF, and the chase-up
          for you.
        </p>
      </>
    ),
  },
  {
    slug: "freelance-contract-essentials-india",
    title: "The 7-clause freelance contract every Indian freelancer needs",
    description:
      "A minimum-viable contract that protects you on payment terms, scope, IP, and termination — without scaring the client. With template wording.",
    publishedAt: "2026-04-30",
    category: "Contracts",
    readingMinutes: 6,
    body: (
      <>
        <Lede>
          Most freelancer contracts are either (a) a 12-page legal document
          the client never reads or (b) a WhatsApp message that explodes when
          things go wrong. Here&rsquo;s the middle ground: 7 clauses, plain
          English, enforceable in Indian courts.
        </Lede>

        <h2>1. Scope of work</h2>
        <p>
          List the exact deliverables, including format. &ldquo;Logo
          design&rdquo; is too vague. &ldquo;Logo design (3 initial concepts,
          2 rounds of revisions, final files in SVG/PNG/AI)&rdquo; is
          enforceable.
        </p>
        <p>
          <strong>Template wording:</strong> &ldquo;The Freelancer agrees to
          deliver the work described in Schedule A. Any work beyond
          Schedule A is out of scope and will be quoted separately.&rdquo;
        </p>

        <h2>2. Timeline and milestones</h2>
        <p>
          Two dates matter: the project start date and the final delivery
          date. Add intermediate milestones if the project is &gt; 30 days,
          and tie payment to them.
        </p>
        <p>
          Always include a <strong>client-side delay clause</strong>: if the
          client doesn&rsquo;t provide feedback / assets / approvals within
          X business days, the timeline shifts.
        </p>

        <h2>3. Payment terms</h2>
        <p>
          Three non-negotiables:
        </p>
        <ul>
          <li>
            <strong>Advance.</strong> 30&ndash;50% on signing for one-off
            projects.
          </li>
          <li>
            <strong>Payment terms.</strong> Net 7 or Net 15 for freelancers.
            Net 30+ kills small businesses.
          </li>
          <li>
            <strong>Late-payment interest.</strong> &ldquo;Overdue invoices
            accrue 18% per annum compound interest from the day after the
            due date, per MSMED Act §16.&rdquo; Even if you don&rsquo;t
            enforce it, the clause changes their behaviour.
          </li>
        </ul>

        <Cta
          href="/tools/late-payment-interest-calculator"
          cta="blog_contract_to_late_calc"
        >
          When a client&rsquo;s late, plug the numbers in here. The figure
          you can claim might surprise you.
        </Cta>

        <h2>4. Intellectual property</h2>
        <p>
          IP transfers on <em>final payment</em>, not earlier. This single
          word (&ldquo;final&rdquo;) is the difference between a client
          ghosting you with your work shipped, and the client coming back
          to settle the bill.
        </p>
        <p>
          <strong>Template wording:</strong> &ldquo;All intellectual property
          rights in the Deliverables remain with the Freelancer until the
          Total Fee is paid in full. Upon final payment, IP rights
          (excluding the Freelancer&rsquo;s portfolio rights) transfer to
          the Client.&rdquo;
        </p>

        <h2>5. Revisions</h2>
        <p>
          Specify the number of revision rounds (2 or 3 is industry
          standard). State explicitly that revisions beyond are billed at
          your hourly rate. This is the single most-skipped clause and the
          single biggest source of scope-creep loss.
        </p>

        <h2>6. Termination</h2>
        <p>
          Either party can terminate with 14 days&rsquo; notice. On
          termination, the client pays for all work completed (or in
          progress) up to the termination date, calculated pro-rata. Your
          deposit is non-refundable.
        </p>

        <h2>7. Confidentiality</h2>
        <p>
          A one-line mutual NDA: &ldquo;Both parties agree to keep
          confidential any non-public information shared during the
          engagement, for 2 years after termination.&rdquo;
        </p>

        <h2>What you do NOT need</h2>
        <ul>
          <li>
            <strong>Indemnity clauses.</strong> Most freelance contracts
            don&rsquo;t need them; they&rsquo;re scary and cost you trust.
            Skip unless your work involves end-user liability (medical,
            financial).
          </li>
          <li>
            <strong>Force majeure.</strong> Already covered under the
            Indian Contract Act. Don&rsquo;t bother.
          </li>
          <li>
            <strong>Arbitration in a foreign country.</strong> Stick to
            Indian jurisdiction. Cheaper, faster, enforceable.
          </li>
        </ul>

        <h2>Signing</h2>
        <p>
          E-signature is legally valid in India under the IT Act 2000.
          DocuSign, Zoho Sign, Razorpay&rsquo;s e-sign &mdash; all fine. You
          do NOT need notarisation for a freelance contract under
          ₹100/month stamp duty value.
        </p>
        <p>
          Stackivo lets you draft, send, and watch the signing flow without
          leaving the dashboard.{" "}
          <Link href="/signup" data-cta="blog_contract_to_signup">
            Try it free
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    slug: "freelancer-income-tax-india-guide",
    title:
      "Freelancer income tax in India: 44ADA, ITR-4, and the moves that legally cut your bill",
    description:
      "44ADA presumptive scheme explained, when to use ITR-4 vs ITR-3, and 6 deductions Indian freelancers consistently miss.",
    publishedAt: "2026-04-20",
    category: "GST & Tax",
    readingMinutes: 8,
    body: (
      <>
        <Lede>
          If you&rsquo;re a freelancer in India earning under ₹50L a year,
          there&rsquo;s exactly one tax move that beats everything else:
          file under <strong>44ADA</strong>. This post explains why, when
          it&rsquo;s the wrong choice, and what else to claim either way.
        </Lede>

        <h2>What 44ADA actually is</h2>
        <p>
          Section 44ADA of the Income Tax Act lets &ldquo;specified
          professionals&rdquo; declare 50% of gross receipts as taxable
          income, no questions asked. You pay tax on that 50%; the other
          half is presumed to be your business expenses.
        </p>
        <p>
          <strong>Who qualifies:</strong> any professional in legal,
          medical, engineering, architecture, accounting, technical
          consulting, interior design, film artist, IT consulting, or any
          notified profession. Most freelance work is covered.
        </p>
        <p>
          <strong>The ceiling:</strong> gross receipts up to ₹50 lakh per
          year (raised to ₹75 lakh from FY 2023-24 if cash receipts are
          ≤5%).
        </p>

        <h2>Why 44ADA is usually the right choice</h2>
        <p>
          You don&rsquo;t need to:
        </p>
        <ul>
          <li>Maintain books of accounts.</li>
          <li>Get a tax audit done (no ₹15k&ndash;30k accountant fee).</li>
          <li>Track every business expense receipt.</li>
        </ul>
        <p>
          You still need to:
        </p>
        <ul>
          <li>File ITR-4 (the simpler one).</li>
          <li>Pay advance tax in quarterly instalments if liability &gt; ₹10k.</li>
          <li>Maintain a basic record of invoices issued (required regardless).</li>
        </ul>

        <h2>When 44ADA is the wrong choice</h2>
        <p>
          If your actual business expenses exceed 50% of revenue, declaring
          50% becomes punitive. Example: an animator with ₹15L revenue and
          ₹10L of expenses (rendering hardware, software licenses, contract
          help) would actually owe tax on ₹5L &mdash; not the ₹7.5L that
          44ADA assumes.
        </p>
        <p>
          In that case, file ITR-3, maintain books, and claim real
          expenses. You&rsquo;ll need a CA, but you save tax.
        </p>

        <h2>6 deductions Indian freelancers consistently miss</h2>

        <h3>1. Section 80C (₹1.5L cap)</h3>
        <p>
          PPF, ELSS, life insurance, principal on home loan, kids&rsquo;
          tuition. Maxing this is the single biggest move.
        </p>

        <h3>2. Section 80D (medical insurance)</h3>
        <p>
          ₹25,000 for self + family below 60, plus ₹50,000 for parents above 60.
          ₹50,000 + ₹50,000 = ₹1L if you cover both.
        </p>

        <h3>3. NPS Tier I (Section 80CCD(1B))</h3>
        <p>
          An <em>additional</em> ₹50,000 over and above 80C. Most
          freelancers miss this entirely.
        </p>

        <h3>4. Home loan interest (Section 24)</h3>
        <p>
          Up to ₹2L on self-occupied property. If you&rsquo;re a freelancer
          with a home loan, claim it.
        </p>

        <h3>5. Donations (Section 80G)</h3>
        <p>
          50% or 100% deductible depending on the charity. Verify the
          80G(5) registration before claiming.
        </p>

        <h3>6. Education loan interest (Section 80E)</h3>
        <p>
          Unlimited deduction for 8 assessment years. Often forgotten by
          freelancers who took loans 5&ndash;6 years ago.
        </p>

        <Cta
          href="/tools/gst-calculator"
          cta="blog_tax_to_gst_calc"
        >
          GST and income tax are separate &mdash; even if you&rsquo;re a
          one-person operation. Use our GST calculator if you&rsquo;ve
          crossed the ₹20L threshold.
        </Cta>

        <h2>Advance tax: don&rsquo;t skip it</h2>
        <p>
          Most freelancers don&rsquo;t realise: if your final tax liability
          for the year exceeds ₹10,000, you must pay it in 4 instalments
          (15 Jun, 15 Sep, 15 Dec, 15 Mar). Skip them, and you owe 1%
          interest per month under Section 234B/234C.
        </p>
        <p>
          A rough rule for 44ADA filers: divide your previous year&rsquo;s
          tax by 4 &mdash; pay that on each due date, true up in March.
        </p>

        <h2>The new vs old regime question</h2>
        <p>
          From AY 2024-25, the new regime is the default. For most
          freelancers under 44ADA <em>without</em> aggressive Chapter VI-A
          deductions, the new regime is cheaper. If you&rsquo;re maxing
          80C + 80D + 80CCD(1B) + home loan interest, run both regimes and
          pick.
        </p>
        <p>
          ClearTax and the IT Department&rsquo;s e-portal both have free
          regime comparators. Use them.
        </p>

        <p>
          When you&rsquo;re running invoices through Stackivo,{" "}
          <Link href="/signup" data-cta="blog_tax_to_signup">
            we automatically segment your annual revenue by client and
            quarter
          </Link>{" "}
          &mdash; the numbers you need for ITR-4 are right on your
          dashboard.
        </p>
      </>
    ),
  },
  {
    slug: "stop-late-paying-clients-india-msme",
    title:
      "How to stop clients paying late (the MSMED Act is on your side)",
    description:
      "Three preventive moves that cut late payment to near-zero, and what MSMED Act §16 actually gives you when prevention fails.",
    publishedAt: "2026-04-10",
    category: "Money & Cashflow",
    readingMinutes: 6,
    body: (
      <>
        <Lede>
          The average Indian freelancer waits 47 days to be paid on a Net-30
          invoice. The fix isn&rsquo;t harder chasing &mdash; it&rsquo;s
          three small structural moves before the invoice even goes out.
        </Lede>

        <h2>Move 1: Register as an MSME (free, takes 10 minutes)</h2>
        <p>
          The Udyam Registration portal lets any individual professional
          register as a Micro / Small / Medium Enterprise. Cost: ₹0. Time:
          ~10 minutes. Requirement: an Aadhaar number.
        </p>
        <p>
          Why bother: the MSMED Act 2006 (specifically Section 16) says
          that if a buyer doesn&rsquo;t pay an MSME-registered supplier
          within 45 days of accepting delivery, the buyer owes{" "}
          <strong>compound interest at 3× the RBI bank rate</strong>{" "}
          &mdash; currently ~18% p.a. compounded monthly. And the buyer
          cannot claim that interest as a deductible business expense in
          their own tax filings.
        </p>
        <p>
          That last clause is what changes behaviour. Once you&rsquo;ve
          quietly mentioned in your contract footer &ldquo;Vendor is a
          registered MSME under Udyam #UDYAM-XX-00-XXXXXX&rdquo;, finance
          teams pay you faster than the unregistered freelancers ahead of
          you in their queue.
        </p>

        <h2>Move 2: Use Net 7 by default, not Net 30</h2>
        <p>
          Net-30 is a US default that crept into Indian B2B. There&rsquo;s
          no statutory requirement to grant 30 days. Switching your default
          to Net 7 cuts your average payment cycle by ~3 weeks. Clients
          who push back are flagging cashflow problems &mdash; useful
          information.
        </p>

        <h2>Move 3: Bill 50% up-front for new clients</h2>
        <p>
          The single biggest predictor of late payment is &ldquo;new
          client, first project&rdquo;. A 50% advance accomplishes three
          things at once:
        </p>
        <ul>
          <li>You stop paying for the client&rsquo;s cashflow problem.</li>
          <li>The clients who refuse 50% advances are usually the ones who&rsquo;d have paid late anyway.</li>
          <li>You can de-risk by absorbing the advance into a slightly higher headline rate.</li>
        </ul>

        <Cta
          href="/tools/late-payment-interest-calculator"
          cta="blog_late_to_calc"
        >
          When a client does pay late, plug the numbers in here to see
          exactly what you can claim under MSMED §16.
        </Cta>

        <h2>What to actually do when an invoice is 30 days overdue</h2>

        <h3>Day 1 past due: a polite reminder</h3>
        <p>
          One sentence email. &ldquo;Hi [name], invoice #X dated [date]
          appears to be a few days overdue. Could you confirm the payment
          status? Happy to resend if needed.&rdquo;
        </p>
        <p>
          Most late invoices are <em>genuinely</em> stuck in someone&rsquo;s
          approval flow. This unblocks them.
        </p>

        <h3>Day 7 past due: a formal reminder with the calculation</h3>
        <p>
          Compute what they&rsquo;d owe under MSMED §16 (if you&rsquo;re
          Udyam-registered) or your contract&rsquo;s late-payment clause.
          Send it as a number, in INR. Most clients pay rather than escalate.
        </p>

        <h3>Day 21 past due: a third reminder + escalate inside their company</h3>
        <p>
          CC the project owner&rsquo;s manager. Project owners hate
          finance escalations more than late-pay reputational hits, so
          this often works.
        </p>

        <h3>Day 45 past due: MSME Samadhan portal</h3>
        <p>
          For Udyam-registered freelancers, the{" "}
          <a
            href="https://samadhaan.msme.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
          >
            MSME Samadhan portal
          </a>{" "}
          lets you file a free complaint against any buyer with an overdue
          invoice. The MSE Facilitation Council mediates / arbitrates
          within 90 days. Filing alone gets ~60% of stuck invoices paid.
        </p>

        <h2>Automate the chasing, not the deciding</h2>
        <p>
          The dignity-preserving move is to automate <em>reminders</em> (so
          you never have to write the awkward email) and personally
          handle <em>escalations</em>. Stackivo sends reminders
          automatically at Day 1, 7, and 21, with text you&rsquo;ve
          pre-approved.{" "}
          <Link href="/signup" data-cta="blog_late_to_signup">
            Start free
          </Link>{" "}
          and the next late-paying client gets nudged without you
          touching anything.
        </p>
      </>
    ),
  },
] as const;

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}
