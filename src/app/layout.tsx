import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./workflows.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PageTransition } from "@/components/page-transition";
import { PageViewTracker } from "@/components/page-view-tracker";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { MessagingWidget } from "@/components/messaging-widget";
import { LanguageProvider } from "@/lib/i18n";
import { detectLanguageFromAcceptHeader } from "@/lib/detect-language";

// Required so relative OG/Twitter image URLs (per-vehicle, per-destination
// pages below) resolve to absolute ones — link-preview bots (WhatsApp,
// iMessage, Slack) can't follow a relative path. Set NEXT_PUBLIC_SITE_URL
// in Vercel once a custom domain is attached; the current deploy URL is
// the fallback so this works today without extra config.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://project-xi-seven-12.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "yoRento | Your next journey starts here",
  description: "A trusted vehicle marketplace born in the Dominican Republic.",
  // apple-touch-icon specifically wants a raster image — iOS Safari's
  // SVG support there is unreliable, unlike the favicon/manifest icons.
  icons: { icon: "/yorento-mark.svg", shortcut: "/yorento-mark.svg", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "yoRento" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#101916" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Detected here (not just client-side) so the very first HTML — what
  // a crawler sees, and what paints before hydration — already matches
  // the visitor's language instead of always shipping English. DR is
  // the primary market; Accept-Language sends Spanish speakers to
  // Spanish and everyone else (tourists included) to English.
  const acceptLanguage = (await headers()).get("accept-language");
  const initialLanguage = detectLanguageFromAcceptHeader(acceptLanguage);

  return <html lang={initialLanguage} className="h-full" data-scroll-behavior="smooth" suppressHydrationWarning><body className="min-h-full"><ThemeProvider><LanguageProvider initialLanguage={initialLanguage}><PageViewTracker /><PageTransition>{children}</PageTransition><SiteFooter /><MobileNav /><MessagingWidget /></LanguageProvider></ThemeProvider></body></html>;
}
