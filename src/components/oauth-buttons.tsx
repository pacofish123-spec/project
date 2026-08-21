"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";

// Flip to true once Sign in with Apple is configured in the Supabase
// dashboard (requires a paid Apple Developer account).
const APPLE_SIGN_IN_ENABLED = false;

export function OAuthButtons() {
  const { t } = useLanguage();
  const [error, setError] = useState("");

  async function signIn(provider: "google" | "facebook" | "apple") {
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
        {APPLE_SIGN_IN_ENABLED && (
          <button className="oauth-button" type="button" onClick={() => signIn("apple")}>
            <span className="oauth-mark apple-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-3.014 1.57-.12 0-.23-.02-.3-.03-.014-.1-.045-.4-.045-.7 0-1.08.522-2.24 1.19-2.96.75-.83 2.04-1.44 3.03-1.48.03.6.316.6.316.52zM20.5 17.13c-.61 1.4-1.34 2.79-2.28 4.15-.79 1.14-1.6 2.28-2.87 2.3-1.25.02-1.65-.73-3.08-.73-1.44 0-1.88.71-3.06.75-1.23.05-2.17-1.23-2.97-2.35-1.62-2.31-2.87-6.53-1.2-9.38.82-1.42 2.3-2.32 3.9-2.34 1.2-.02 2.32.8 3.05.8.72 0 2.09-1 3.52-.85.6.03 2.29.24 3.37 1.83-.09.06-2.01 1.17-1.99 3.5.02 2.78 2.45 3.7 2.48 3.72-.02.06-.38 1.32-1.25 2.6z" /></svg>
            </span>
            {t("oauthContinueApple")}
          </button>
        )}
        <button className="oauth-button" type="button" onClick={() => signIn("facebook")}><span className="oauth-mark facebook-mark">f</span> {t("oauthContinueFacebook")}</button>
      </div>
      {error && <p className="workflow-error">{error}</p>}
      <div className="auth-divider"><span>{t("oauthOrEmail")}</span></div>
    </div>
  );
}
