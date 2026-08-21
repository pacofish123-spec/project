"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthStatus } from "@/components/auth-status";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

export default function ProfilePage() {
  const { t } = useLanguage();
  return (
    <>
      <AppHeader />
      <main className="workflow-page has-photo tint-ocean" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1592455639374-b7ad0189dfbb?auto=format&fit=crop&w=1800&q=80)" }}>
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="workflow-card">
            <p className="workflow-kicker">{t("profileKicker")}</p>
            <h1>{t("profileTitleLine1")} <em>{t("profileTitleLine2")}</em></h1>
            <p className="workflow-intro">{t("profileIntro")}</p>
            <AuthStatus />
          </section>
        </div>
      </main>
    </>
  );
}
