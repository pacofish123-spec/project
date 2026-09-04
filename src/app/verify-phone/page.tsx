"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";

// Same shape as verify-id/page.tsx — a status-driven single page,
// no wizard. Two channels (WhatsApp OTP, SMS via Twilio) so a renter
// or host uses whichever they actually have; the channel-choice step
// only appears when both are configured (see /api/phone/send-code's
// GET, which reports availability before either is requested).
export default function VerifyPhonePage() {
  const { t } = useLanguage();
  const [availability, setAvailability] = useState<{ whatsapp: boolean; sms: boolean } | null>(null);
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "">("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/phone/send-code").then(async (response) => {
      const result = await response.json() as { whatsapp?: boolean; sms?: boolean };
      setAvailability({ whatsapp: Boolean(result.whatsapp), sms: Boolean(result.sms) });
    }).catch(() => setAvailability({ whatsapp: false, sms: false }));
  }, []);

  async function sendCode(pickedChannel: "whatsapp" | "sms") {
    if (!phone.trim()) { setMessage(t("verifyPhoneNumberRequired")); return; }
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), channel: pickedChannel }),
    });
    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    setBusy(false);
    if (response.ok && result.ok) { setChannel(pickedChannel); setSent(true); return; }
    setMessage(result.error ?? t("verifyPhoneSendError"));
  }

  async function confirmCode() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/phone/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
    setBusy(false);
    if (response.ok && result.ok) { setDone(true); return; }
    setMessage(result.error ?? t("verifyPhoneConfirmError"));
  }

  const bothAvailable = Boolean(availability?.whatsapp && availability?.sms);
  const onlyOneAvailable = availability && (availability.whatsapp !== availability.sms) ? (availability.whatsapp ? "whatsapp" : "sms") : null;

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-ocean">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/profile"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="workflow-card">
            <p className="workflow-kicker">{t("verifyPhoneKicker")}</p>
            <h1>{t("verifyPhoneTitleLine1")} <em>{t("verifyPhoneTitleLine2")}</em></h1>
            <p className="workflow-intro"><Smartphone size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{t("verifyPhoneIntro")}</p>

            {message && <p className="workflow-error">{message}</p>}

            {done && <p className="workflow-success"><ShieldCheck size={15} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("verifyPhoneDone")}</p>}

            {!done && availability && !availability.whatsapp && !availability.sms && (
              <p className="admin-row-meta">{t("verifyPhoneUnavailable")}</p>
            )}

            {!done && availability && (availability.whatsapp || availability.sms) && !sent && (
              <div className="workflow-form">
                <label>{t("verifyPhoneNumberLabel")}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 809 555 0100" /></label>
                <div className="choice-grid deposit-choice-grid">
                  {(bothAvailable || onlyOneAvailable === "whatsapp") && (
                    <button type="button" className="choice-card" disabled={busy} onClick={() => sendCode("whatsapp")}>
                      <MessageCircle size={20} />
                      <strong>{t("verifyPhoneWhatsAppOption")}</strong>
                    </button>
                  )}
                  {(bothAvailable || onlyOneAvailable === "sms") && (
                    <button type="button" className="choice-card" disabled={busy} onClick={() => sendCode("sms")}>
                      <Smartphone size={20} />
                      <strong>{t("verifyPhoneSmsOption")}</strong>
                    </button>
                  )}
                </div>
              </div>
            )}

            {!done && sent && (
              <div className="workflow-form">
                <p className="admin-row-meta">{channel === "whatsapp" ? t("verifyPhoneSentWhatsApp") : t("verifyPhoneSentSms")}</p>
                <label>{t("verifyPhoneCodeLabel")}<input type="text" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} /></label>
                <button className="workflow-submit coral" type="button" disabled={busy || !code.trim()} onClick={confirmCode}>
                  {busy ? t("paymentStarting") : t("verifyPhoneConfirmAction")}
                </button>
                <button className="workflow-link" type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); }}>{t("verifyPhoneChangeNumber")}</button>
              </div>
            )}

            <div className="workflow-lang-bar" />
          </section>
        </div>
      </main>
    </>
  );
}
