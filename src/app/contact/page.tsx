"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

// Footer/legal "Contact us" links land here instead of triggering the
// visitor's mail client directly — a short form posts to /api/contact,
// which emails the submission to supportEmail (marketplace-config.ts)
// with the sender's address set as reply-to.
export default function ContactPage() {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, message }),
    });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error ?? t("contactGenericError")); return; }
    setSent(true);
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="workflow-card">
            {sent ? (
              <div style={{ textAlign: "center" }}>
                <CheckCircle2 size={40} style={{ margin: "0 auto 18px", color: "var(--pine, #183b32)" }} />
                <h1>{t("contactSuccessTitle")}</h1>
                <p className="workflow-intro">{t("contactSuccessBody")}</p>
              </div>
            ) : (
              <>
                <p className="workflow-kicker">{t("contactPageKicker")}</p>
                <h1>{t("contactPageTitle")}</h1>
                <p className="workflow-intro">{t("contactPageIntro")}</p>
                {error && <p className="workflow-error">{error}</p>}
                <form className="workflow-form" onSubmit={handleSubmit}>
                  <label>{t("contactNameLabel")}<input name="name" type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} /></label>
                  <label>{t("contactEmailLabel")}<input name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                  <label>{t("contactPhoneLabel")}<input name="phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
                  <label>{t("contactMessageLabel")}<textarea name="message" rows={5} placeholder={t("contactMessagePlaceholder")} required value={message} onChange={(event) => setMessage(event.target.value)} /></label>
                  <button className="workflow-submit" disabled={busy} type="submit"><Send size={16} />{busy ? t("contactSending") : t("contactSubmit")}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
