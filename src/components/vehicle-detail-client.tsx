"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { BookingForm, type BookingExtraOption } from "@/components/booking-form";
import { useLanguage } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";
import { vehicleAmenities } from "@/lib/vehicle-amenities";

export interface Vehicle {
  id: string;
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
export function VehicleDetailClient({ vehicleId, initialVehicle }: { vehicleId: string; initialVehicle: Vehicle }) {
  const { t } = useLanguage();
  const [vehicle] = useState<Vehicle>(initialVehicle);
  const [extras, setExtras] = useState<BookingExtraOption[]>([]);
  const photos = (vehicle.photo_paths ?? []).map((path) => vehiclePhotoUrl(path));
  const selectedAmenities = vehicleAmenities.filter((amenity) => vehicle.amenities?.includes(amenity.value));
  const cleaningPolicyLabel = vehicle.cleaning_policy === "return_clean" ? t("cleaningPolicyReturnClean")
    : vehicle.cleaning_policy === "return_dirty_fee" ? t("cleaningPolicyReturnDirtyFee")
    : vehicle.cleaning_policy;

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
          <div className="vehicle-detail-media" style={photos[0] ? { backgroundImage: `url(${photos[0]})` } : undefined}>
            {!photos[0] && <CarFront size={56} />}
            <div className="vehicle-card-badges">
              {vehicle.verified && <span className="verified-badge verified-status-badge" title={t("verifiedBadgeExplainer")}><ShieldCheck size={13} /> {t("verificationVerified")}</span>}
              {vehicle.promoted && <span className="verified-badge promoted-badge"><Sparkles size={13} /> {t("promotedBadge")}</span>}
            </div>
          </div>
          <div className="vehicle-detail-body">
            <p className="workflow-kicker">{vehicle.host_type === "individual" ? t("vehiclePersonalOwner") : t("vehicleBusinessLabel")}</p>
            <h1>{vehicle.make} {vehicle.model}</h1>
            {vehicle.verified && <p className="vehicle-detail-trust"><ShieldCheck size={16} /> {t("verifiedBadgeExplainer")}</p>}
            <p className="vehicle-detail-meta"><MapPin size={15} /> {vehicle.location_city}, {vehicle.country_code} <span>&middot;</span> {vehicle.year}</p>
            {photos.length > 1 && (
              <div className="condition-photo-grid" style={{ marginBottom: 18 }}>
                {photos.slice(1).map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`${vehicle.make} ${vehicle.model} photo ${index + 2}`} /></a>)}
              </div>
            )}
            {vehicle.description && <p className="workflow-intro">{vehicle.description}</p>}
            <div className="vehicle-meta">
              <span>{vehicle.transmission ?? t("filterAutomatic")}</span>
              {vehicle.seats ? <span>{vehicle.seats} {t("seatsLabel").toLowerCase()}</span> : null}
              {vehicle.has_ac ? <span>{t("filterAc")}</span> : null}
            </div>
            {selectedAmenities.length > 0 && (
              <div className="admin-reasons" style={{ marginBottom: 18 }}>
                {selectedAmenities.map((amenity) => <span key={amenity.value}>{t(amenity.labelKey)}</span>)}
              </div>
            )}
            <p className="vehicle-detail-price"><strong>{formatMoney(vehicle.daily_price, vehicle.base_currency)}</strong> {t("perDaySuffix")}</p>
            <div className="vehicle-detail-trust"><ShieldCheck size={16} /> {t("vehiclePricingNote")}</div>
            {(vehicle.fuel_policy || cleaningPolicyLabel) && (
              <div className="admin-reasons" style={{ marginBottom: 18 }}>
                {vehicle.fuel_policy && <span>{t("fuelPolicyLabel")}: {vehicle.fuel_policy === "as_delivered" ? t("fuelPolicyAsDelivered") : t("fuelPolicyFull")}</span>}
                {cleaningPolicyLabel && <span>{t("cleaningPolicyLabel")}: {cleaningPolicyLabel}</span>}
              </div>
            )}
            <details className="faq-item cancellation-policy"><summary>{t("cancellationPolicyLabel")}</summary><p>{t("cancellationPolicyBody")}</p></details>
            <BookingForm vehicleId={vehicle.id} status={vehicle.status} extras={extras} />
          </div>
        </section>
      </div>
    </main>
  );
}
