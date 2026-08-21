"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageDropdown } from "@/components/language-dropdown";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthMenu } from "@/components/auth-menu";
import { useLanguage } from "@/lib/i18n";

// The same nav the homepage hero carries — brand, the Explore cars /
// Destinations / Why yoRento links, List your car, language, notifications,
// theme, account menu — on a plain light bar instead of the hero image, for
// inner pages (admin, dashboards, search, etc.) that need the full "site
// options" without the marketing header. Full parity is the point: these
// options shouldn't disappear just because you're not on the homepage.
export function AppHeader() {
  const { t } = useLanguage();
  return (
    <header className="app-header">
      <div className="page-width app-header-inner">
        <Link className="app-header-brand" href="/" aria-label="yoRento home"><Brand compact /></Link>
        <div className="app-header-links">
          <Link href="/search">{t("navExploreCars")}</Link>
          <Link href="/destinations">{t("navDestinations")}</Link>
          <Link href="/trust">{t("navWhyYorento")}</Link>
        </div>
        <div className="nav-actions">
          <LanguageDropdown />
          <Link className="host-link app-header-host-link" href="/host">{t("listYourCar")} <ArrowRight size={15} /></Link>
          <NotificationBell />
          <ThemeToggle />
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
