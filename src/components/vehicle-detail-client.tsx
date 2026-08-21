"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { BookingForm, type BookingExtraOption } from "@/components/booking-form";
import { PhotoLightbox } from "@/components/photo-lightbox";
import { HostProfileCard, type HostSummary } from "@/components/host-profile-card";
import { useLanguage } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";
import { vehicleAmenities } from "@/lib/vehicle-amenities";

export type { HostSummary };

export interface Vehicle {
  id: string;
  owner_user_id?: string;
  make: string;
  model: string;
  year: number;
  description?: string | null;
  location_city: string;
  country_code: string;
  daily_price: number;
  base_currency: string;
  host_type: "individual" | "business";
  transmission?: string | null;
  seats?: number | null;
  has_ac?: boolean;
  status: string;
  promoted?: boolean;
  verified?: boolean;
  fuel_policy?: string | null;
  cleaning_policy?: string | null;
  amenities?: string[] | null;
  photo_paths?: string[] | null;
}

// The vehicle itself is fetched server-side (see page.tsx) so search
// engines and link-preview bots get real content and metadata on first
// response — this component just renders it and still owns the small
// bit of state that genuinely only matters client-side (the extras
// list, which isn't needed for metadata/SEO).
export function VehicleDetailClient({ vehicleId, initialVehicle, host }: { vehicleId: string; initialVehicle: Vehicle; host: HostSummary | null }) {
  const { t } = useLanguage();
  const [vehicle] = useState<Vehicle>(initialVehicle);
  const [extras, setExtras] = useState<BookingExtraOption[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const photos = (vehicle.photo_paths ?? []).map((path) => vehiclePhotoUrl(path));
  const vehicleLabel = `${vehicle.make} ${vehicle.model}`;
  const selectedAmenities = vehicleAmenities.filter((amenity) => vehicle.amenities?.includes(amenity.value));
  const cleaningPolicyLabel = vehicle.cleaning_policy === "return_clean" ? t("cleaningPolicyReturnClean")
    : vehicle.cleaning_policy === "return_dirty_fee" ? t("cleaningPolicyReturnDirtyFee")
    : vehicle.cleaning_policy;

  // A quick-glance spec sheet generated straight from what the host
  // already entered — no separate field to fill in, no risk of it
  // drifting out of sync with the real transmission/seats/fuel policy.
  const specBullets = [
    t("specModelYear", { year: vehicle.year }),
    vehicle.transmission ? t(vehicle.transmission === "automatic" ? "specTransmissionAutomatic" : "specTransmissionManual") : null,
    vehicle.seats ? t("specSeatCount", { count: vehicle.seats }) : null,
    vehicle.has_ac ? t("specHasAc") : null,
    vehicle.fuel_policy ? t(vehicle.fuel_policy === "as_delivered" ? "specFuelAsDelivered" : "specFuelFull") : null,
  ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}/extras`).then(async (response) => {
      const result = await response.json() as { extras?: BookingExtraOption[] };
      if (response.ok) setExtras(result.extras ?? []);
    }).catch(() => {});
  }, [vehicleId]);

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/search"><ArrowLeft size={16} /> {t("backLinkSearch")}</Link></div>
        <section className="vehicle-detail">
          <div className="vehicle-detail-left">
            <button
              type="button"
              className="vehicle-detail-media"
              style={photos[0] ? { backgroundImage: `url(${photos[0]})`, cursor: "zoom-in" } : undefined}
              disabled={photos.length === 0}
              aria-label={photos.length > 0 ? `View ${vehicleLabel} photos` : undefined}
              onClick={() => photos.length > 0 && setLightboxIndex(0)}
            >
              {!photos[0] && <CarFront size={56} />}
              <div className="vehicle-card-badges">
                {vehicle.verified && <span className="verified-badge verified-status-badge" title={t("verifiedBadgeExplainer")}><ShieldCheck size={13} /> {t("verificationVerified")}</span>}
                {vehicle.promoted && <span className="verified-badge promoted-badge"><Sparkles size={13} /> {t("promotedBadge")}</span>}
              </div>
            </button>

            {photos.length > 1 && (
              <div className="vehicle-detail-thumbs">
                {photos.slice(1).map((url, index) => (
                  <button type="button" key={url} onClick={() => setLightboxIndex(index + 1)} aria-label={`View ${vehicleLabel} photo ${index + 2}`}>
                    <img src={url} alt={`${vehicleLabel} photo ${index + 2}`} />
                  </button>
                ))}
              </div>
            )}

            {selectedAmenities.length > 0 && (
              <div className="vehicle-feature-icons">
                {selectedAmenities.map((amenity) => (
                  <span key={amenity.value} title={t(amenity.labelKey)}><amenity.icon size={18} /><small>{t(amenity.labelKey)}</small></span>
                ))}
              </div>
            )}

            {(vehicle.fuel_policy || cleaningPolicyLabel) && (
              <div className="vehicle-included-card">
                <p className="workflow-kicker">{t("whatsIncludedLabel")}</p>
                <div className="admin-reasons">
                  {vehicle.fuel_policy && <span>{t("fuelPolicyLabel")}: {vehicle.fuel_policy === "as_delivered" ? t("fuelPolicyAsDelivered") : t("fuelPolicyFull")}</span>}
                  {cleaningPolicyLabel && <span>{t("cleaningPolicyLabel")}: {cleaningPolicyLabel}</span>}
                </div>
              </div>
            )}

            {specBullets.length > 0 && (
              <div className="vehicle-specs-card">
                <p className="workflow-kicker">{t("vehicleSpecsLabel")}</p>
                <ul className="vehicle-specs-list">{specBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </div>
            )}

            {vehicle.description && (
              <div className="vehicle-description-card">
                <p className="workflow-kicker">{t("descriptionLabel")}</p>
                <p className="workflow-intro" style={{ margin: 0 }}>{vehicle.description}</p>
              </div>
            )}

            <details className="faq-item cancellation-policy"><summary>{t("cancellationPolicyLabel")}</summary><p>{t("cancellationPolicyBody")}</p></details>
          </div>

          <div className="vehicle-detail-body">
            <HostProfileCard host={host} hostTypeLabel={vehicle.host_type === "individual" ? t("vehiclePersonalOwner") : t("vehicleBusinessLabel")} />
            <h1>{vehicle.make} {vehicle.model}</h1>
            {vehicle.verified && <p className="vehicle-detail-trust"><ShieldCheck size={16} /> {t("verifiedBadgeExplainer")}</p>}
            <p className="vehicle-detail-meta"><MapPin size={15} /> {vehicle.location_city}, {vehicle.country_code} <span>&middot;</span> {vehicle.year}</p>
            <p className="vehicle-detail-price"><strong>{formatMoney(vehicle.daily_price, vehicle.base_currency)}</strong> {t("perDaySuffix")}</p>
            <div className="vehicle-detail-trust"><ShieldCheck size={16} /> {t("vehiclePricingNote")}</div>
            <BookingForm vehicleId={vehicle.id} status={vehicle.status} extras={extras} countryCode={vehicle.country_code} />
          </div>
        </section>
      </div>
      {lightboxIndex !== null && (
        <PhotoLightbox photos={photos} index={lightboxIndex} alt={vehicleLabel} onClose={() => setLightboxIndex(null)} onNavigate={setLightboxIndex} />
      )}
    </main>
  );
}
