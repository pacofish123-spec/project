"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function ConfirmOAuthIdentityPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(phone: string, dateOfBirth: string) {
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/confirm-oauth-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, dateOfBirth }),
    });
    const result = await response.json() as { error?: string; flagged?: boolean };
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Unable to save your details."); return; }
    router.push(result.flagged ? "/recover" : "/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit(String(form.get("phone") || ""), String(form.get("dateOfBirth") || ""));
  }

  return (
    <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=1800&q=80)" }}>
      <div className="page-width">
        <section className="workflow-card" style={{ marginTop: 32 }}>
          <p className="workflow-kicker">{t("onboardingKicker")}</p>
          <h1>{t("onboardingTitleLine1")} <em>{t("onboardingTitleLine2")}</em></h1>
          <p className="workflow-intro"><ShieldCheck size={16} /> {t("onboardingIntro")}</p>
          {error && <p className="workflow-error">{error}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>{t("phoneLabel")} <span className="field-hint">{t("phoneHint")}</span><input name="phone" type="tel" autoComplete="tel" placeholder="+1 809 555 0100" /></label>
            <label>{t("dobLabel")} <span className="field-hint">{t("dobHint")}</span><input name="dateOfBirth" type="date" autoComplete="bday" /></label>
            <button className="workflow-submit coral" disabled={busy} type="submit">{busy ? t("onboardingSubmitBusy") : t("onboardingSubmit")}<ArrowRight size={16} /></button>
          </form>
          <div className="workflow-actions">
            <button className="workflow-link" type="button" disabled={busy} onClick={() => submit("", "")}>{t("onboardingSkip")}</button>
          </div>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
