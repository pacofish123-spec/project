import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workflows.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PageTransition } from "@/components/page-transition";
import { PageViewTracker } from "@/components/page-view-tracker";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "yoRento | Your next journey starts here",
  description: "A trusted vehicle marketplace born in the Dominican Republic.",
  icons: { icon: "/yorento-mark.svg", shortcut: "/yorento-mark.svg", apple: "/yorento-mark.svg" },
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className="h-full" data-scroll-behavior="smooth" suppressHydrationWarning><body className="min-h-full"><ThemeProvider><LanguageProvider><PageViewTracker /><PageTransition>{children}</PageTransition></LanguageProvider></ThemeProvider></body></html>;
}
