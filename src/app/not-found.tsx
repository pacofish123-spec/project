"use client";

import Link from "next/link";
import { ArrowRight, Compass, Search } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

// Next's file-convention 404 — replaces the framework's unbranded
// default for every route that doesn't resolve, in every supported
// language.
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <section className="workflow-card" style={{ textAlign: "center" }}>
            <Compass size={40} style={{ margin: "0 auto 18px", color: "var(--coral, #f18a65)" }} />
            <p className="workflow-kicker">404</p>
            <h1>{t("notFoundTitle")}</h1>
            <p className="workflow-intro">{t("notFoundBody")}</p>
            <div className="profile-menu">
              <Link href="/"><span>{t("notFoundHomeCta")}</span><ArrowRight size={16} /></Link>
              <Link href="/search"><Search size={18} /><span>{t("notFoundSearchCta")}</span><ArrowRight size={16} /></Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
