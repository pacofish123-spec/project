"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { VerifiedAvatar } from "@/components/verified-avatar";

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  vehicle_label: string | null;
}

// Homepage social-proof strip — only ever fed reviews whose author
// checked "show this publicly" (consent_public, migration 0042); see
// loadPublicReviews in page.tsx for the query. Renders nothing at all
// when there's not at least one yet, rather than an empty section.
export function PublicReviews({ reviews }: { reviews: PublicReview[] }) {
  const { t } = useLanguage();
  if (reviews.length === 0) return null;

  return (
    <section className="section page-width" id="reviews">
      <div className="section-heading">
        <div>
          <p className="eyebrow muted">{t("publicReviewsEyebrow")}</p>
          <h2>{t("publicReviewsTitleLine1")} <em>{t("publicReviewsTitleLine2")}</em></h2>
        </div>
      </div>
      <div className="public-review-grid">
        {reviews.map((review) => (
          <div className="public-review-card" key={review.id}>
            <div className="public-review-head">
              <VerifiedAvatar avatarUrl={review.author_avatar_url} />
              <div>
                <strong>{review.author_display_name || t("hostAnonymousLabel")}</strong>
                <span className="rating">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={12} fill={index < review.rating ? "currentColor" : "none"} />)}</span>
              </div>
            </div>
            {review.body && <p>{review.body}</p>}
            {review.vehicle_label && <span className="admin-row-meta">{review.vehicle_label}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
