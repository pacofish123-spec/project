"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function RecoverPage() {
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/sign-in` });
    setMessage(t("recoverSuccessMessage"));
  }
  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/sign-in"><ArrowLeft size={16} /> {t("backLinkSignIn")}</Link><ThemeToggle /></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("recoverKicker")}</p>
          <h1>{t("recoverTitlePrefix")} <em>{t("recoverTitleEm")}</em> {t("recoverTitleSuffix")}</h1>
          <p className="workflow-intro">{t("recoverIntro")}</p>
          {message && <p className="workflow-success">{message}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>{t("emailLabel")}<input name="email" type="email" autoComplete="email" required /></label>
            <button className="workflow-submit coral" type="submit"><Mail size={17} /> {t("recoverSubmit")}</button>
          </form>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
