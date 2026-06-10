/**
 * Quiet credibility strip under the hero. No fake logos — Stackivo is early —
 * just an honest line plus the professions it serves, set like a logo row.
 */
const PROFESSIONS = [
  "Designers",
  "Developers",
  "Consultants",
  "Writers",
  "Video editors",
  "Architects",
  "Marketers",
  "Small studios",
];

export function TrustStrip() {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8 sm:py-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Built for independent professionals across India
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
          {PROFESSIONS.map((p) => (
            <li
              key={p}
              className="font-display text-base font-medium tracking-tight text-foreground/35 sm:text-lg"
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
