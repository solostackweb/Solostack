import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppProviders } from "@/components/providers/app-providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  category: "business",
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Stackivo",
    "operating system for independents",
    "freelancer OS",
    "GST invoicing India",
    "invoice software India",
    "client management for professionals",
    "contracts and e-signatures",
    "time tracking and billing",
    "business analytics for freelancers",
  ],
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    creator: "@stackivo",
    site: "@stackivo",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: siteConfig.name,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  icons: {
    icon: [
      { url: "/api/pwa-icon/16", type: "image/png", sizes: "16x16" },
      { url: "/api/pwa-icon/32", type: "image/png", sizes: "32x32" },
      { url: "/api/pwa-icon/192", type: "image/png", sizes: "192x192" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/api/pwa-icon/180", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/api/pwa-icon/32", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": siteConfig.name,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131519" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      >
      <body className="font-sans antialiased">
        {/*
          Capture beforeinstallprompt before React hydrates.
          Chrome can fire this event just after DOMContentLoaded — before
          useEffect listeners in child components attach. Storing it on
          window.__pwa_prompt lets useInstallPrompt() pick it up reliably.
        */}
        <Script id="pwa-prompt-capture" strategy="beforeInteractive">
          {`window.__pwa_prompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwa_prompt=e;});`}
        </Script>
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
