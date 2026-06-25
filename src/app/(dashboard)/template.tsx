/**
 * Per-navigation page transition for the dashboard.
 *
 * Next.js remounts a `template` on every navigation (unlike `layout`), so this
 * wrapper replays its CSS animation on each route change — giving an app-like
 * slide-in on mobile and a gentle fade-up on desktop. Collapses to instant
 * under prefers-reduced-motion (handled globally in globals.css).
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-app-page">{children}</div>;
}
