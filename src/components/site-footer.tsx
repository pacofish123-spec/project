"use client";

import Link from "next/link";
import { Brand } from "@/components/brand";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/lib/i18n";

// Rendered once, from the root layout, so every page carries the same
// footer — including a real link to the Privacy Policy and Terms of
// Service, which previously existed nowhere in the app's navigation.
export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="page-width footer-inner">
        <Link className="brand" href="/"><Brand light /></Link>
        <p>{t("footerTagline")}</p>
        <div>
          <Link href="/about">{t("about")}</Link>
          <Link href="/host">{t("host")}</Link>
          <Link href="/trust">{t("trustSafety")}</Link>
          <Link href="/privacy">{t("privacyPolicyLink")}</Link>
          <Link href="/terms">{t("termsOfServiceLink")}</Link>
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
}
