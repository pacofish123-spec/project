"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { OAuthButtons } from "@/components/oauth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SelectField } from "@/components/select-field";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const identityResponse = await fetch("/api/auth/check-registration", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), phone: form.get("phone"), name: form.get("name"), dateOfBirth: form.get("dateOfBirth") || undefined }) });
    const identity = await identityResponse.json() as { canContinue?: boolean; requiresReview?: boolean; message?: string };
    if (identity.canContinue === false) { setError(t("signUpDuplicateBlocked")); setBusy(false); return; }
    if (identity.requiresReview) setMessage(t("signUpPossibleMatch"));
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError(t("signUpNotConfigured")); setBusy(false); return; }
    const { data, error: signUpError } = await supabase.auth.signUp({ email: String(form.get("email")), password: String(form.get("password")), options: { data: { display_name: String(form.get("name")), phone: String(form.get("phone") || ""), date_of_birth: String(form.get("dateOfBirth") || ""), onboarding_context: String(form.get("context")) } } });
    if (signUpError) setError(signUpError.message.includes("already") ? t("signUpAlreadyExists") : t("signUpGenericError"));
    else if (data.session) router.push("/");
    else setMessage(t("signUpCheckEmail"));
    setBusy(false);
  }

  return (
    <main className="workflow-page has-photo" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80)" }}>
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkHome")}</Link><ThemeToggle /></div>
        <section className="workflow-card">
          <p className="workflow-kicker">{t("signUpKicker")}</p>
          <h1>{t("signUpTitleLine1")}<br /><em>{t("signUpTitleLine2")}</em></h1>
          <p className="workflow-intro">{t("signUpIntro")}</p>
          <OAuthButtons />
          {message && <p className="workflow-success">{message}</p>}
          {error && <p className="workflow-error">{error}</p>}
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>{t("nameLabel")}<input name="name" autoComplete="name" required /></label>
            <label>{t("emailLabel")}<input name="email" type="email" autoComplete="email" required /></label>
            <label>{t("phoneLabel")} <span className="field-hint">{t("phoneHint")}</span><input name="phone" type="tel" autoComplete="tel" placeholder="+1 809 555 0100" /></label>
            <label>{t("dobLabel")} <span className="field-hint">{t("dobHint")}</span><input name="dateOfBirth" type="date" autoComplete="bday" /></label>
            <label>{t("passwordLabel")}<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
            <SelectField name="context" label={t("signUpContextLabel")} defaultValue="personal" options={[{ value: "personal", label: t("signUpContextPersonal") }, { value: "business", label: t("signUpContextBusiness") }]} />
            <button className="workflow-submit coral" disabled={busy} type="submit"><UserPlus size={17} />{busy ? t("signUpSubmitBusy") : t("signUpSubmit")}<ArrowRight size={16} /></button>
          </form>
          <div className="workflow-actions">
            <span>{t("alreadyHaveAccount")}</span>
            <Link className="workflow-link" href="/sign-in">{t("signIn")}</Link>
          </div>
          <div className="workflow-lang-bar"><LanguageSwitcher /></div>
        </section>
      </div>
    </main>
  );
}
