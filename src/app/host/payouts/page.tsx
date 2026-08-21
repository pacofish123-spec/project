"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Clock, CreditCard } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";

interface PayoutAccount {
  provider: string;
  external_account_id: string | null;
  status: string;
}

const statusLabelKey: Record<string, TranslationKey> = {
  pending: "payoutStatusPending",
  onboarding: "payoutStatusOnboarding",
  active: "payoutStatusActive",
  restricted: "payoutStatusRestricted",
  disabled: "payoutStatusDisabled",
};

export default function HostPayoutsPage() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");

  const load = useCallback(() => {
    fetch("/api/host/payout-accounts").then(async (response) => {
      const result = await response.json() as { accounts?: PayoutAccount[]; error?: string };
      if (!response.ok) { setMessage(result.error ?? t("payoutsLoadError")); return; }
      setAccounts(result.accounts ?? []);
    }).catch(() => setMessage(t("payoutsLoadError")));
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("onboarded") || params.has("refresh")) {
      fetch("/api/host/payout-accounts/stripe").then(() => load()).finally(() => window.history.replaceState(null, "", window.location.pathname));
    } else {
      load();
    }
  }, [load]);

  const stripeAccount = accounts.find((account) => account.provider === "stripe");
  const paypalAccount = accounts.find((account) => account.provider === "paypal");

  async function startStripeOnboarding() {
    setBusy("stripe");
    setMessage("");
    const response = await fetch("/api/host/payout-accounts/stripe", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && result.url) { window.location.assign(result.url); return; }
    setMessage(result.error ?? t("payoutsLoadError"));
    setBusy("");
  }

  async function savePaypalEmail() {
    if (!paypalEmail.trim()) return;
    setBusy("paypal");
    setMessage("");
    const response = await fetch("/api/host/payout-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: paypalEmail.trim() }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) load();
    else setMessage(result.error ?? t("payoutsLoadError"));
    setBusy("");
  }

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-coral">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/host/dashboard"><ArrowLeft size={16} /> {t("backLinkHostSetup")}</Link></div>
          <section className="dashboard-head">
            <div><p className="workflow-kicker">{t("payoutsKicker")}</p><h1>{t("payoutsTitleLine1")}<br /><em>{t("payoutsTitleLine2")}</em></h1><p>{t("payoutsIntro")}</p></div>
          </section>

          {message && <p className="workflow-error">{message}</p>}

          <div className="dashboard-grid">
            <div className="dashboard-tile" style={{ cursor: "default" }}>
              <CreditCard size={22} />
              <strong>Stripe</strong>
              <span>{stripeAccount ? t(statusLabelKey[stripeAccount.status] ?? "payoutStatusPending") : t("payoutsNotSetUp")}</span>
              <button className="workflow-submit coral" type="button" disabled={busy === "stripe"} onClick={startStripeOnboarding} style={{ marginTop: 8 }}>
                {busy === "stripe" ? t("paymentStarting") : stripeAccount?.status === "active" ? t("payoutsManage") : t("payoutsSetUp")}
              </button>
            </div>

            <div className="dashboard-tile" style={{ cursor: "default" }}>
              <Building2 size={22} />
              <strong>PayPal</strong>
              {paypalAccount ? (
                <span><CheckCircle2 size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{paypalAccount.external_account_id}</span>
              ) : (
                <>
                  <input className="location-search" style={{ marginTop: 8 }} type="email" placeholder={t("payoutsPaypalEmailPlaceholder")} value={paypalEmail} onChange={(event) => setPaypalEmail(event.target.value)} />
                  <button className="workflow-submit coral" type="button" disabled={busy === "paypal" || !paypalEmail.trim()} onClick={savePaypalEmail} style={{ marginTop: 8 }}>
                    {busy === "paypal" ? t("paymentStarting") : t("payoutsSave")}
                  </button>
                </>
              )}
            </div>

            <div className="dashboard-tile app-placeholder-tile" style={{ cursor: "default" }}>
              <Clock size={22} />
              <strong>Azul</strong>
              <span>{t("payoutsComingSoon")}</span>
            </div>

            <div className="dashboard-tile app-placeholder-tile" style={{ cursor: "default" }}>
              <Clock size={22} />
              <strong>CardNet</strong>
              <span>{t("payoutsComingSoon")}</span>
            </div>
          </div>

          <p className="legal-note">{t("payoutsLegalNote")}</p>
        </div>
      </main>
    </>
  );
}
