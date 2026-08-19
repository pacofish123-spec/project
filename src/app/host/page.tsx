"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Check, UserRound } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function HostPage() {
  const { t } = useLanguage();
  const [choice, setChoice] = useState<"personal" | "business">("personal");
  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkHome")}</Link><ThemeToggle /></div>
        <section className="workflow-card wide">
          <p className="workflow-kicker">{t("hostOnboardingKicker")}</p>
          <h1>{t("rentCarLine1")}<br /><em>{t("rentCarLine2")}</em></h1>
          <p className="workflow-intro">{t("hostOnboardingIntro")}</p>
          <div className="step-row"><span className="active" /><span /><span /><span /></div>
          <div className="choice-grid">
            <button className={`choice-card ${choice === "personal" ? "selected" : ""}`} onClick={() => setChoice("personal")}>
              <span className="choice-icon"><UserRound size={20} /></span>
              <strong>{t("hostPersonalTitle")}</strong>
              <span>{t("hostPersonalDesc")}</span>
              {choice === "personal" && <Check size={18} color="var(--coral)" />}
            </button>
            <button className={`choice-card ${choice === "business" ? "selected" : ""}`} onClick={() => setChoice("business")}>
              <span className="choice-icon"><Building2 size={20} /></span>
              <strong>{t("hostBusinessTitle")}</strong>
              <span>{t("hostBusinessDesc")}</span>
              {choice === "business" && <Check size={18} color="var(--coral)" />}
            </button>
          </div>
          <div className="workflow-actions">
            <span className="workflow-link">{t("hostSelected")} {choice === "personal" ? t("hostPersonalTitle") : t("hostBusinessTitle")}</span>
            <Link className="workflow-submit" href={choice === "personal" ? "/host/cars/new?host=personal" : "/host/business/new"}>{t("hostContinue")} <ArrowRight size={16} /></Link>
          </div>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
