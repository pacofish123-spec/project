"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Camera, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/translations";

interface VerificationStatus {
  id: string;
  status: string;
  provider: string | null;
  created_at: string;
}

const statusKey: Record<string, TranslationKey> = {
  not_started: "verificationNotStarted",
  pending: "verificationPending",
  in_review: "verificationInReview",
  verified: "verificationVerified",
  failed: "verificationFailed",
  requires_information: "verificationRequiresInformation",
  expired: "verificationExpired",
};

export default function VerifyIdPage() {
  const { t } = useLanguage();
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [automatedAvailable, setAutomatedAvailable] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);

  const load = useCallback(() => {
    fetch("/api/identity/status").then(async (response) => {
      const result = await response.json() as { verification?: VerificationStatus | null; automatedAvailable?: boolean; error?: string };
      if (!response.ok) { setMessage(result.error ?? t("verifyIdLoadError")); return; }
      setVerification(result.verification ?? null);
      setAutomatedAvailable(Boolean(result.automatedAvailable));
    }).catch(() => setMessage(t("verifyIdLoadError")));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  async function startAutomated() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/identity/start", { method: "POST" });
    const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
    if (response.ok && result.url) { window.location.assign(result.url); return; }
    setMessage(result.error ?? t("verifyIdStartError"));
    setBusy(false);
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { setMessage(t("verifyIdStartError")); setUploading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage(t("verifyIdSignInPrompt")); setUploading(false); return; }

    const uploaded: string[] = [];
    for (const file of files) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("identity-documents").upload(path, file);
      if (!uploadError) uploaded.push(path);
    }
    if (uploaded.length < files.length) setMessage(t("photoUploadError"));
    setPendingPaths((current) => [...current, ...uploaded]);
    setUploading(false);
    event.target.value = "";
  }

  async function submitManual() {
    if (pendingPaths.length === 0) return;
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/identity/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentPaths: pendingPaths }) });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (response.ok) { setPendingPaths([]); load(); }
    else setMessage(result.error ?? t("verifyIdStartError"));
    setBusy(false);
  }

  const hasActiveVerification = verification && ["pending", "in_review", "verified"].includes(verification.status);

  return (
    <>
      <AppHeader />
      <main className="workflow-page tint-wash-ocean">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/profile"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="workflow-card">
            <p className="workflow-kicker">{t("verifyIdKicker")}</p>
            <h1>{t("verifyIdTitleLine1")} <em>{t("verifyIdTitleLine2")}</em></h1>
            <p className="workflow-intro"><ShieldCheck size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{t("verifyIdIntro")}</p>

            {message && <p className="workflow-error">{message}</p>}

            {verification && (
              <div className="dashboard-message">
                <BadgeCheck size={22} />
                <p>{t("verifyIdCurrentStatus")}: <strong>{t(statusKey[verification.status] ?? "verificationNotStarted")}</strong></p>
              </div>
            )}

            {!hasActiveVerification && (
              <>
                {automatedAvailable && (
                  <>
                    <h2 className="faq-title" style={{ marginTop: 24 }}>{t("verifyIdAutomatedTitle")}</h2>
                    <p className="workflow-intro" style={{ margin: "4px 0 16px" }}>{t("verifyIdAutomatedBody")}</p>
                    <button className="workflow-submit coral" type="button" disabled={busy} onClick={startAutomated}>
                      {busy ? t("paymentStarting") : t("verifyIdAutomatedAction")}
                    </button>
                  </>
                )}

                <h2 className="faq-title" style={{ marginTop: 28 }}>{t("verifyIdManualTitle")}</h2>
                <p className="workflow-intro" style={{ margin: "4px 0 16px" }}>{t("verifyIdManualBody")}</p>
                <label className="photo-upload-dropzone" aria-disabled={uploading}>
                  <Camera size={26} />
                  <strong>{uploading ? t("uploadingPhotos") : t("verifyIdUploadLabel")}</strong>
                  <span>{t("verifyIdUploadHint")}</span>
                  <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={handlePhotoSelect} />
                </label>
                {pendingPaths.length > 0 && (
                  <>
                    <p className="admin-row-meta">{t("verifyIdPhotosReady", { count: pendingPaths.length })}</p>
                    <button className="workflow-submit coral" type="button" disabled={busy} onClick={submitManual}>
                      {busy ? t("paymentStarting") : t("verifyIdSubmitAction")}
                    </button>
                  </>
                )}
              </>
            )}

            <div className="workflow-lang-bar" />
          </section>
        </div>
      </main>
    </>
  );
}
