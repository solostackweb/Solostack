import {
  BarChart3,
  BellRing,
  HandHeart,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";
import { cn } from "@/lib/utils";

/**
 * Core capabilities bento. Two feature cards get a small inline visual; the
 * rest stay quiet. The invisible #gst anchor preserves old /#gst deep links.
 */
export function CapabilitiesSection() {
  return (
    <Section id="capabilities" size="wide" className="relative border-y bg-muted/30 py-20 sm:py-24 lg:py-28">
      <span id="gst" aria-hidden className="absolute -top-20" />
      <Reveal>
        <SectionHeading
          eyebrow="Capabilities"
          title="Small details, handled properly."
          subtitle="The unglamorous parts of running a business — tax, onboarding, reminders, reporting — are exactly where Stackivo does the most work for you."
        />
      </Reveal>

      <StaggerReveal className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
        {/* GST — featured card */}
        <StaggerItem className="sm:col-span-2 lg:col-span-2">
          <BentoCard
            icon={IndianRupee}
            title="GST without the guesswork"
            body="Not registered? Send clean simple invoices. Registered? Toggle GST mode and Stackivo applies the right CGST / SGST / IGST split from each client's state — automatically."
            className="h-full"
          >
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2" aria-hidden>
              <div className="rounded-xl border border-border/70 bg-background p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">Same state · Karnataka</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                    CGST + SGST
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">9% + 9% = ₹18,900</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-foreground">Other state · Maharashtra</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                    IGST
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">18% = ₹18,900</p>
              </div>
            </div>
          </BentoCard>
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={BarChart3}
            title="Pulse analytics"
            body="Outstanding vs collected, your best clients, monthly revenue trends — the numbers that actually matter, on one dashboard."
            className="h-full"
          >
            <div className="mt-5 flex h-16 items-end gap-1.5" aria-hidden>
              {[40, 60, 45, 75, 58, 85, 70, 100].map((h, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t",
                    i === 7 ? "bg-primary" : "bg-primary/20",
                  )}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </BentoCard>
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={HandHeart}
            title="Welcome documents"
            body="Onboard every client with a polished welcome doc — scope, process, payment terms — so projects start clear and stay clear."
            className="h-full"
          />
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={BellRing}
            title="Polite, persistent reminders"
            body="Stackivo follows up on overdue invoices for you — friendly, professional, and automatic. You stay the good cop."
            className="h-full"
          />
        </StaggerItem>

        <StaggerItem>
          <BentoCard
            icon={ShieldCheck}
            title="Your data, isolated"
            body="Every workspace is isolated with row-level security and backed up daily. Export anytime — your data is always yours."
            className="h-full"
          />
        </StaggerItem>
      </StaggerReveal>
    </Section>
  );
}

function BentoCard({
  icon: Icon,
  title,
  body,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "card-lift group rounded-3xl border border-border/80 bg-card p-6 transition-shadow sm:p-7",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
