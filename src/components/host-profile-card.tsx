"use client";

import { useState } from "react";
import { BadgeCheck, Star, UserRound, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

export interface HostSummary {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  member_since: string;
  rating: number | null;
  completed_rentals: number;
  response_rate: number | null;
  identity_verified: boolean;
}

interface HostReview {
  rating: number;
  body: string | null;
  created_at: string;
  author_display_name: string;
}

interface HostDetails {
  reviews: HostReview[];
}

// A small clickable chip (avatar, name, rating) that opens a full
// profile card with the rest of the host's public stats and recent
// reviews, lazy-fetched only once someone actually taps into it —
// the chip itself already has everything it needs from the
// server-rendered page, no fetch required just to show up.
export function HostProfileCard({ host, hostTypeLabel }: { host: HostSummary | null; hostTypeLabel: string }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<HostDetails | null>(null);
  const [loading, setLoading] = useState(false);

  async function openPopover() {
    setOpen(true);
    if (details || !host) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/hosts/${host.id}/public`);
      const result = await response.json() as { reviews?: HostReview[] };
      setDetails({ reviews: result.reviews ?? [] });
    } catch {
      setDetails({ reviews: [] });
    } finally {
      setLoading(false);
    }
  }

  if (!host) return <p className="workflow-kicker">{hostTypeLabel}</p>;

  return (
    <>
      <button type="button" className="host-profile-chip" onClick={openPopover}>
        <span className="host-avatar">{host.avatar_url ? <img src={host.avatar_url} alt="" /> : <UserRound size={20} />}</span>
        <span className="host-chip-text">
          <span className="host-chip-name-row">
            <strong>{host.display_name || t("hostAnonymousLabel")}</strong>
            {host.identity_verified && <span className="id-verified-pill" title={t("idVerifiedBadgeExplainer")}><BadgeCheck size={11} /> {t("idVerifiedBadge")}</span>}
          </span>
          <span className="host-chip-meta">
            {host.rating != null ? <><Star size={12} fill="currentColor" /> {host.rating.toFixed(1)}</> : hostTypeLabel}
          </span>
        </span>
      </button>

      {open && (
        <div className="host-popover-overlay" onClick={() => setOpen(false)}>
          <div className="host-popover-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="drawer-close host-popover-close" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button>
            <div className="host-popover-head">
              <span className="host-avatar large">{host.avatar_url ? <img src={host.avatar_url} alt="" /> : <UserRound size={30} />}</span>
              <div>
                <span className="host-popover-name-row">
                  <strong>{host.display_name || t("hostAnonymousLabel")}</strong>
                  {host.identity_verified && <span className="id-verified-pill" title={t("idVerifiedBadgeExplainer")}><BadgeCheck size={12} /> {t("idVerifiedBadge")}</span>}
                </span>
                <span className="admin-row-meta">{t("hostMemberSince", { date: formatDate(host.member_since, localeFor(language)) })}</span>
              </div>
            </div>
            <div className="host-popover-stats">
              <div><strong>{host.rating != null ? host.rating.toFixed(1) : "—"}</strong><span>{t("hostRatingLabel")}</span></div>
              <div><strong>{host.completed_rentals}</strong><span>{t("hostCompletedRentalsLabel")}</span></div>
              <div><strong>{host.response_rate != null ? `${Math.round(host.response_rate)}%` : "—"}</strong><span>{t("hostResponseRateLabel")}</span></div>
            </div>
            <p className="workflow-kicker" style={{ marginTop: 20 }}>{t("hostReviewsLabel")}</p>
            {loading && <p className="admin-row-meta">{t("hostReviewsLoading")}</p>}
            {details && details.reviews.length === 0 && <p className="admin-row-meta">{t("hostNoReviewsYet")}</p>}
            {details && details.reviews.length > 0 && (
              <div className="host-review-list">
                {details.reviews.map((review, index) => (
                  <div className="host-review-item" key={index}>
                    <div><strong>{review.author_display_name}</strong><span className="rating"><Star size={11} fill="currentColor" /> {review.rating}</span></div>
                    {review.body && <p>{review.body}</p>}
                    <span className="admin-row-meta">{formatDate(review.created_at, localeFor(language))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function localeFor(language: string) {
  return language === "es" ? "es-DO" : language === "fr" ? "fr-FR" : "en-US";
}
