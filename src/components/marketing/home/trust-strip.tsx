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
      <div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <a
            href="https://www.producthunt.com/products/stackivo?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-stackivo"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="product_hunt_badge"
            aria-label="View Stackivo on Product Hunt (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* Product Hunt serves and updates the launch vote count in this badge. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1193504&theme=light&t=1783882271257"
              alt="Stackivo — featured on Product Hunt"
              width={250}
              height={54}
              className="h-[54px] w-[250px] rounded-lg"
            />
          </a>

          <a
            href="https://postyourstartup.co/startup/stackivo-1?ref=badge"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="post_your_startup_badge"
            aria-label="View Stackivo on PostYourStartup (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://postyourstartup.co/api/badge/stackivo-1?theme=light"
              alt="Stackivo — featured on PostYourStartup"
              width={212}
              height={55}
              className="h-[55px] w-[212px] rounded-lg"
            />
          </a>

          <a
            href="https://startupfa.me/s/stackivo?utm_source=stackivo.me"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="startup_fame_badge"
            aria-label="View Stackivo on Startup Fame (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://startupfa.me/badges/featured-badge.webp"
              alt="Stackivo — featured on Startup Fame"
              width={171}
              height={54}
              className="h-[54px] w-[171px] rounded-lg"
            />
          </a>

          <a
            href="https://open-launch.com/projects/stackivo"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="open_launch_badge"
            aria-label="View Stackivo on Open-Launch (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://open-launch.com/api/badge/e9d7d57b-cc26-43a0-af1a-0ff1aefa468e/featured-light.svg"
              alt="Stackivo — featured on Open-Launch"
              width={200}
              height={50}
              className="h-[50px] w-[200px] rounded-lg"
            />
          </a>

          <a
            href="https://tinylaunch.com"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="tinylaunch_badge"
            aria-label="View TinyLaunch (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://tinylaunch.com/tinylaunch_badge_launching_soon.svg"
              alt="Stackivo — launching soon on TinyLaunch"
              width={202}
              className="h-auto w-[202px] rounded-lg"
            />
          </a>

          <a
            href="https://sellwithboost.com"
            target="_blank"
            rel="noopener noreferrer"
            data-cta="sell_with_boost_badge"
            aria-label="View Stackivo on Sell With Boost (opens in a new tab)"
            className="inline-flex rounded-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://sellwithboost.com/badge/listing.svg"
              alt="Listed on Sell With Boost"
              className="h-10 w-auto rounded-lg"
            />
          </a>
        </div>

        <p className="mt-7 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          Built for independent professionals across India
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:gap-x-12">
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
