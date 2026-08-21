"use client";

import { useState } from "react";
import { BadgeCheck, Star, UserRound, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

interface PublicProfile {
  display_name: string | null;
  avatar_url: string | null;
  member_since: string;
}

interface PublicStats {
  rating: number | null;
  completed_rentals: number;
  response_rate: number | null;
}

interface PublicReview {
  rating: number;
  body: string | null;
  created_at: string;
  author_display_name: string;
}

// A clickable name that fetches and shows someone's public profile —
// avatar, member-since, rating, and recent reviews — on demand. Used
// wherever a host currently sees only a bare renter name (dashboard
// pending requests, the per-vehicle request list) with nothing to
// click through to actually see who they are.
export function PublicProfilePopover({ userId, displayName }: { userId: string; displayName: string }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [identityVerified, setIdentityVerified] = useState(false);

  async function openPopover() {
    setOpen(true);
    if (profile) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/hosts/${userId}/public`);
      const result = await response.json() as { profile?: PublicProfile; stats?: PublicStats; reviews?: PublicReview[]; identityVerified?: boolean };
      setProfile(result.profile ?? { display_name: displayName, avatar_url: null, member_since: "" });
      setStats(result.stats ?? { rating: null, completed_rentals: 0, response_rate: null });
      setReviews(result.reviews ?? []);
      setIdentityVerified(Boolean(result.identityVerified));
    } catch {
      setProfile({ display_name: displayName, avatar_url: null, member_since: "" });
      setStats({ rating: null, completed_rentals: 0, response_rate: null });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="workflow-link" onClick={openPopover}>{displayName}</button>

      {open && (
        <div className="host-popover-overlay" onClick={() => setOpen(false)}>
          <div className="host-popover-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="drawer-close host-popover-close" aria-label={t("close")} onClick={() => setOpen(false)}><X size={18} /></button>
            {loading && !profile && <p className="admin-row-meta">{t("hostReviewsLoading")}</p>}
            {profile && (
              <>
                <div className="host-popover-head">
                  <span className="host-avatar large">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={30} />}</span>
                  <div>
                    <span className="host-popover-name-row">
                      <strong>{profile.display_name || displayName}</strong>
                      {identityVerified && <span className="id-verified-pill" title={t("idVerifiedBadgeExplainer")}><BadgeCheck size={12} /> {t("idVerifiedBadge")}</span>}
                    </span>
                    {profile.member_since && <span className="admin-row-meta">{t("hostMemberSince", { date: formatDate(profile.member_since, localeFor(language)) })}</span>}
                  </div>
                </div>
                {stats && (
                  <div className="host-popover-stats">
                    <div><strong>{stats.rating != null ? stats.rating.toFixed(1) : "—"}</strong><span>{t("hostRatingLabel")}</span></div>
                    <div><strong>{stats.completed_rentals}</strong><span>{t("hostCompletedRentalsLabel")}</span></div>
                    <div><strong>{stats.response_rate != null ? `${Math.round(stats.response_rate)}%` : "—"}</strong><span>{t("hostResponseRateLabel")}</span></div>
                  </div>
                )}
                <p className="workflow-kicker" style={{ marginTop: 20 }}>{t("hostReviewsLabel")}</p>
                {reviews.length === 0 && <p className="admin-row-meta">{t("hostNoReviewsYet")}</p>}
                {reviews.length > 0 && (
                  <div className="host-review-list">
                    {reviews.map((review, index) => (
                      <div className="host-review-item" key={index}>
                        <div><strong>{review.author_display_name}</strong><span className="rating"><Star size={11} fill="currentColor" /> {review.rating}</span></div>
                        {review.body && <p>{review.body}</p>}
                        <span className="admin-row-meta">{formatDate(review.created_at, localeFor(language))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
