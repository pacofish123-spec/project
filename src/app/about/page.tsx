"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Globe2 } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useLanguage();
  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1800&q=80)" }}>
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="workflow-card">
            <p className="workflow-kicker">{t("aboutKicker")}</p>
            <h1>{t("aboutTitleLine1")}<br /><em>{t("aboutTitleLine2")}</em></h1>
            <p className="workflow-intro">{t("aboutIntro")}</p>
            <div className="profile-menu">
              <Link href="/search"><Globe2 size={18} /><span>{t("aboutExploreMarketplace")}</span><ArrowRight size={16} /></Link>
              <Link href="/trust"><span>{t("trustSafety")}</span><ArrowRight size={16} /></Link>
            </div>
            <div className="workflow-lang-bar" />
          </section>
        </div>
      </main>
    </>
  );
}
