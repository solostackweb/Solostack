import * as React from "react";

/**
 * Layout for public-share routes (`/i/:token`, `/c/:token`).
 *
 * No app shell, no auth, no nav — these pages are served to anonymous
 * recipients who clicked an emailed link. The layout exists only to
 * keep typography + background consistent with the rest of the app.
 */
export default function PublicShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="doc-light-theme min-h-svh bg-muted/30 text-foreground antialiased">
      {children}
    </div>
  );
}
