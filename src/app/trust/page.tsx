"use client";

import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function TrustPage() {
  const { t } = useLanguage();
  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("trustSafety")}</p>
          <h1>{t("trustTitleLine1")}<br /><em>{t("trustTitleLine2")}</em></h1>
          <p className="workflow-intro">{t("trustIntro")}</p>
          <div className="trust-list">
            <p><ShieldCheck size={18} /> {t("trustItem1")}</p>
            <p><Check size={18} /> {t("trustItem2")}</p>
            <p><Check size={18} /> {t("trustItem3")}</p>
          </div>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
