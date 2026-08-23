"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

// Dropped into a completed trip card on both sides of /trips (renter
// and host) — a lightweight star + optional comment + explicit consent
// checkbox, since a review can only ever appear on the homepage feed
// if the author checked the box (see submit_review, migration 0042).
// No pre-check for "already reviewed" — reviews.booking_id +
// author_user_id is unique, so a repeat submit just surfaces that as a
// friendly message instead of a second row.
export function ReviewPrompt({ bookingId }: { bookingId: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [consentPublic, setConsentPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"submitted" | "already" | "error" | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, rating, body, consentPublic }),
    });
    const responseBody = await response.json().catch(() => ({})) as { error?: string; code?: string };
    setBusy(false);
    if (response.ok) { setResult("submitted"); return; }
    setResult(responseBody.code === "ALREADY_REVIEWED" ? "already" : "error");
  }

  if (result === "submitted") return <p className="admin-row-meta">{t("reviewPromptThanks")}</p>;
  if (result === "already") return <p className="admin-row-meta">{t("reviewPromptAlready")}</p>;

  if (!open) {
    return <button className="workflow-link" type="button" onClick={() => setOpen(true)}><Star size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{t("reviewPromptCta")}</button>;
  }

  return (
    <div className="review-prompt">
      <div className="review-star-picker">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-label={`${value} star`} onClick={() => setRating(value)}>
            <Star size={18} fill={value <= rating ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("reviewPromptBodyPlaceholder")} maxLength={600} />
      <label className="review-consent-row">
        <input type="checkbox" checked={consentPublic} onChange={(event) => setConsentPublic(event.target.checked)} />
        {t("reviewPromptConsent")}
      </label>
      {result === "error" && <p className="workflow-error">{t("reviewPromptError")}</p>}
      <div className="profile-photo-actions">
        <button className="workflow-submit coral" type="button" disabled={busy} onClick={submit}>{busy ? t("reviewPromptSaving") : t("reviewPromptSubmit")}</button>
        <button className="workflow-link" type="button" disabled={busy} onClick={() => setOpen(false)}>{t("profilePhotoCancel")}</button>
      </div>
    </div>
  );
}
