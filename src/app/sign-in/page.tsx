"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { OAuthButtons } from "@/components/oauth-buttons";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SignInPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError(t("signInNotConfigured")); setBusy(false); return; }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    if (signInError) setError(t("signInFailed"));
    else router.push("/");
    setBusy(false);
  }

  return (
    <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=1800&q=80)" }}>
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkHome")}</Link><ThemeToggle /></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("signInKicker")}</p>
          <h1>{t("signInTitleLine1")} <em>{t("signInTitleEm")}</em></h1>
          <p className="workflow-intro">{t("signInIntro")}</p>
          <OAuthButtons />
          {error && <p className="workflow-error">{error}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>{t("emailLabel")}<input name="email" type="email" autoComplete="email" required /></label>
            <label>{t("passwordLabel")}<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="workflow-submit" disabled={busy} type="submit"><LockKeyhole size={17} />{busy ? t("signInSubmitBusy") : t("signInSubmit")}</button>
          </form>
          <div className="workflow-actions">
            <Link className="workflow-link" href="/recover">{t("signInRecoverLink")}</Link>
            <Link className="workflow-link" href="/sign-up">{t("signInCreateAccountLink")} <ArrowRight size={14} /></Link>
          </div>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
