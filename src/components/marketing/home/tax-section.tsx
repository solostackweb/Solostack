import { Section, SectionHeading, RuledColumns, RuledColumn } from "../section";
import { Reveal } from "../motion";

/**
 * GST — promoted to a full section in v2.
 *
 * In v1 this was the third card in a six-card capabilities grid. It is the
 * single thing Stackivo does that the international competition does not do
 * at all, and it was being presented as a feature footnote. Keka leads with
 * navigating labour law across 28 states; the equivalent move here is to let
 * place-of-supply carry a section of its own.
 *
 * Also absorbs what used to be `InternationalSection` — an export invoice is
 * a GST treatment, not a separate topic.
 */
export function TaxSection() {
  return (
    <Section id="gst" size="wide" rule>
      <Reveal>
        <SectionHeading
          eyebrow="Place of supply"
          title="Tax, handled quietly."
          subtitle="Place of supply, reverse charge, export invoices without GST — the unglamorous parts are exactly where the software should be doing the thinking. You pick the client; Stackivo picks the treatment."
        />
      </Reveal>

      <Reveal delay={0.06}>
        <RuledColumns className="mt-14" cols={3}>
          <RuledColumn index="01 / Intrastate" title="Same state, split tax">
            <p>
              Client in Karnataka, you in Karnataka. CGST 9% and SGST 9%,
              applied separately and shown separately, because that is how the
              return expects it.
            </p>
            <TreatmentRow label="Karnataka → Karnataka" value="CGST 9% + SGST 9%" />
          </RuledColumn>

          <RuledColumn index="02 / Interstate" title="Different state, one line">
            <p>
              Client in Maharashtra. IGST 18% as a single line. No mental
              arithmetic, and no template you edited last quarter and forgot to
              change back.
            </p>
            <TreatmentRow label="Karnataka → Maharashtra" value="IGST 18%" />
          </RuledColumn>

          <RuledColumn index="03 / Export" title="Overseas, zero-rated">
            <p>
              Client in Berlin paying in euros. LUT declaration on the invoice,
              zero-rated supply, and the exchange rate recorded at the date of
              issue for your books.
            </p>
            <TreatmentRow label="Karnataka → Germany" value="Zero-rated · LUT" emphasis />
          </RuledColumn>
        </RuledColumns>
      </Reveal>

      <p className="mt-10 max-w-[60ch] font-mono text-micro leading-relaxed text-muted-foreground">
        Exports reconcile into GSTR-1 alongside domestic supplies. Nothing to
        reclassify at filing time.
      </p>
    </Section>
  );
}

function TreatmentRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <dl className="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-3 font-mono text-micro">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={emphasis ? "font-medium text-primary" : "text-foreground"}>{value}</dd>
    </dl>
  );
}
