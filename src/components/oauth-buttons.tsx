"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";

export function OAuthButtons() {
  const { t } = useLanguage();
  const [error, setError] = useState("");

  async function signIn(provider: "google" | "facebook") {
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setError(t("oauthNotConfigured")); return; }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (oauthError) setError(t("oauthProviderUnavailable"));
  }

  return (
    <div className="oauth-stack">
      <div className="oauth-grid">
        <button className="oauth-button" type="button" onClick={() => signIn("google")}><span className="oauth-mark google-mark">G</span> {t("oauthContinueGoogle")}</button>
        <button className="oauth-button" type="button" onClick={() => signIn("facebook")}><span className="oauth-mark facebook-mark">f</span> {t("oauthContinueFacebook")}</button>
      </div>
      {error && <p className="workflow-error">{error}</p>}
      <div className="auth-divider"><span>{t("oauthOrEmail")}</span></div>
    </div>
  );
}
