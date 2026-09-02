import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/section";
import { Reveal } from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "Join the Stackivo Early Community",
  description: "Join Stackivo early access as a freelancer or small agency and help shape the workspace around real client work.",
  alternates: { canonical: "/community" },
};

const INCLUDED = [
  "The complete Stackivo workspace",
  "Ivo actions with approval before changes",
  "Direct access to the team building it",
  "A real voice in what ships next",
];

export default function CommunityPage() {
  return (
    <>
      <PageHero
        eyebrow="Early Stackivo community"
        title="Build a calmer client business with us."
        subtitle="Pricing is paused while we test Stackivo with a small group of freelancers and agencies. Join early, use every workflow, and help us make the workspace genuinely useful."
      />
      <Section size="wide">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <div>
              <p className="font-mono text-micro font-semibold uppercase tracking-[0.16em] text-primary">What early access means</p>
              <h2 className="mt-4 text-balance font-display text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Use the whole workspace. Tell us where it falls short.</h2>
              <ul className="mt-8 space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 shrink-0 text-success-strong" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="divide-y divide-border border-y border-border">
              <CommunityPath icon={UserRound} title="I work independently" description="For freelancers, consultants, creators, and solo operators managing client work end to end." href="/signup?source=community&role=freelancer" cta="Join as a freelancer" />
              <CommunityPath icon={Building2} title="We are a small agency" description="For compact teams and studios that need shared client context without enterprise overhead." href="/signup?source=community&role=agency" cta="Join as an agency" />
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}

function CommunityPath({ icon: Icon, title, description, href, cta }: { icon: typeof UserRound; title: string; description: string; href: string; cta: string }) {
  return (
    <article className="grid gap-5 py-7 sm:grid-cols-[44px_1fr_auto] sm:items-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.06] text-primary"><Icon className="h-5 w-5" /></span>
      <div><h3 className="font-display text-xl font-semibold tracking-[-0.03em]">{title}</h3><p className="mt-1 max-w-[52ch] text-sm leading-6 text-muted-foreground">{description}</p></div>
      <Button asChild className="h-11 rounded-lg px-5"><Link href={href}>{cta}<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
    </article>
  );
}
