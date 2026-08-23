"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

export default function TrustPage() {
  const { t } = useLanguage();
  // Off until the real Casa del Conductor membership deal closes (see
  // platform_settings, migration 0043) — never claim it before then.
  const [cdcEnabled, setCdcEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/platform-settings").then(async (response) => {
      const result = await response.json() as { settings?: { cdc_membership_enabled?: boolean } };
      if (response.ok) setCdcEnabled(Boolean(result.settings?.cdc_membership_enabled));
    }).catch(() => {});
  }, []);

  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1693761935586-5939ab418d0d?auto=format&fit=crop&w=1800&q=80)" }}>
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

            {cdcEnabled && (
              <div className="trust-list">
                <p><ShieldCheck size={18} /> <strong>{t("cdcTrustTitle")}</strong></p>
                <p style={{ marginLeft: 26, color: "#6c7971" }}>{t("cdcTrustBody")}</p>
              </div>
            )}

            <h2 className="faq-title">{t("faqTitle")}</h2>
            <div className="faq-list">
              <details className="faq-item"><summary>{t("faqQ1")}</summary><p>{t("faqA1")}</p></details>
              <details className="faq-item"><summary>{t("faqQ2")}</summary><p>{t("faqA2")}</p></details>
              <details className="faq-item"><summary>{t("faqQ3")}</summary><p>{t("faqA3")}</p></details>
              <details className="faq-item"><summary>{t("faqQ4")}</summary><p>{t("faqA4")}</p></details>
            </div>

            <div className="workflow-lang-bar" />
          </section>
        </div>
      </main>
    </>
  );
}
