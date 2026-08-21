"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LockKeyhole, X } from "lucide-react";
import { OAuthButtons } from "@/components/oauth-buttons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";

// A sign-in prompt that shows up in context instead of losing whatever
// the visitor was doing — used by the booking form so a guest whose
// chosen dates are actually available never just hits a dead-end "sign
// in required" error with no way back to booking. Email/password
// resolves in place (no navigation, onSuccess fires immediately); OAuth
// and "create an account" both leave the page, so the caller is
// responsible for saving whatever should survive that round trip.
export function SignInModal({ onClose, onSuccess, onBeforeLeave }: { onClose: () => void; onSuccess: () => void; onBeforeLeave?: () => void }) {
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
    setBusy(false);
    if (signInError) { setError(t("signInFailed")); return; }
    onSuccess();
  }

  return (
    <div className="host-popover-overlay" onClick={onClose}>
      <div className="host-popover-card sign-in-modal-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="drawer-close host-popover-close" aria-label={t("close")} onClick={onClose}><X size={18} /></button>
        <p className="workflow-kicker">{t("bookingSignInPromptKicker")}</p>
        <h2 className="faq-title" style={{ margin: "2px 0 6px" }}>{t("bookingSignInPromptTitle")}</h2>
        <p className="workflow-intro" style={{ margin: "0 0 18px" }}>{t("bookingSignInPromptBody")}</p>
        <OAuthButtons redirectPath={typeof window !== "undefined" ? window.location.pathname : undefined} />
        {error && <p className="workflow-error">{error}</p>}
        <form className="workflow-form" onSubmit={handleSubmit}>
          <label>{t("emailLabel")}<input name="email" type="email" autoComplete="email" required /></label>
          <label>{t("passwordLabel")}<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="workflow-submit coral" disabled={busy} type="submit"><LockKeyhole size={17} />{busy ? t("signInSubmitBusy") : t("signInSubmit")}</button>
        </form>
        <div className="workflow-actions">
          <Link className="workflow-link" href="/recover">{t("signInRecoverLink")}</Link>
          <Link className="workflow-link" href="/sign-up" onClick={() => onBeforeLeave?.()}>{t("signInCreateAccountLink")}</Link>
        </div>
      </div>
    </div>
  );
}
