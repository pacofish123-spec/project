"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n";

const STORAGE_KEY = "yorento-cookie-notice-dismissed";

// yoRento only sets essential cookies today — Supabase's own auth
// session cookies, nothing from an analytics/ads SDK (page views are
// logged cookie-free server-side, see page-view-tracker.tsx) — so this
// is a one-button notice rather than an accept/reject consent flow.
// If a tracking or ad pixel is ever added, this needs a real opt-in
// instead of a dismiss-only notice.
export function CookieBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) queueMicrotask(() => setVisible(true));
    } catch {
      // Storage unavailable (private mode, blocked) — skip the banner
      // rather than show it on every load with no way to dismiss it.
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best-effort only — worst case it reappears next visit.
    }
  }

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="status">
      <p>{t("cookieBannerText")}</p>
      <button type="button" className="workflow-submit" onClick={dismiss}>{t("cookieBannerAccept")}</button>
    </div>
  );
}
