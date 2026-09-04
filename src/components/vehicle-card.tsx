"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CarFront, ShieldCheck, Smartphone, Sparkles, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { convertApprox, defaultCurrencyByLanguage, type CurrencyRate } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { vehiclePhotoUrl } from "@/lib/storage-url";
import { PLATFORM_DEPOSIT_USD } from "@/lib/platform-policy";

export interface VehicleCardData {
  id: string;
  owner_user_id: string;
  make: string;
  model: string;
  year: number;
  location_city: string;
  daily_price: number;
  base_currency: string;
  host_type: "individual" | "business";
  transmission?: string | null;
  seats?: number | null;
  has_ac?: boolean;
  promoted?: boolean;
  verified?: boolean;
  host_identity_verified?: boolean;
  vin_verified?: boolean;
  phone_verified?: boolean;
  photo_paths?: string[] | null;
  amenities?: string[] | null;
  rental_terms?: string[] | null;
  distance_km?: number | null;
}

export function VehicleCard({ vehicle, rates }: { vehicle: VehicleCardData; rates?: CurrencyRate[] }) {
  const { t, language } = useLanguage();
  const preferredCurrency = defaultCurrencyByLanguage[language];
  const approx = rates && preferredCurrency !== vehicle.base_currency
    ? convertApprox(vehicle.daily_price, vehicle.base_currency, preferredCurrency, rates)
    : null;
  const photoUrl = vehicle.photo_paths?.[0] ? vehiclePhotoUrl(vehicle.photo_paths[0]) : null;

  return (
    <Link className="vehicle-card" href={`/vehicles/${vehicle.id}`}>
      <div className={`vehicle-image ${photoUrl ? "" : "vehicle-image-placeholder"}`}>
        {photoUrl && <Image src={photoUrl} alt={`${vehicle.make} ${vehicle.model}`} fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" style={{ objectFit: "cover" }} />}
        {!photoUrl && <CarFront size={40} />}
        <div className="vehicle-card-badges">
          {/* Three trust badges, each a distinct claim — ID (identity
              document check), Specs (VIN-decoded against the listing,
              folds in what the old generic "Verified" admin-review
              badge used to gesture at ambiguously), Phone (OTP via
              WhatsApp or SMS). Never more than one badge implying the
              same thing. */}
          {vehicle.host_identity_verified && <span className="verified-badge id-verified-badge" title={t("idVerifiedBadgeExplainer")}><BadgeCheck size={13} /> {t("idVerifiedBadge")}</span>}
          {vehicle.vin_verified && <span className="verified-badge verified-status-badge" title={t("specsVerifiedBadgeExplainer")}><ShieldCheck size={13} /> {t("specsVerifiedBadge")}</span>}
          {vehicle.phone_verified && <span className="verified-badge phone-verified-badge" title={t("phoneVerifiedBadgeExplainer")}><Smartphone size={13} /> {t("phoneVerifiedBadge")}</span>}
          {vehicle.promoted && <span className="verified-badge promoted-badge"><Sparkles size={13} /> {t("promotedBadge")}</span>}
        </div>
      </div>
      <div className="vehicle-info">
        <div className="vehicle-title">
          <div>
            <h3>{vehicle.make} {vehicle.model}</h3>
            <p>{vehicle.year} <span>&middot;</span> {vehicle.location_city}{vehicle.distance_km != null && <> <span>&middot;</span> {t("distanceAway", { km: vehicle.distance_km })}</>}</p>
          </div>
        </div>
        <div className="vehicle-meta">
          <span>{vehicle.transmission ?? t("filterAutomatic")}</span>
          {vehicle.seats ? <span>{vehicle.seats} {t("seatsLabel").toLowerCase()}</span> : null}
          {vehicle.has_ac ? <span>{t("acShort")}</span> : null}
        </div>
        <div className="vehicle-footer">
          <strong>
            {formatMoney(vehicle.daily_price, vehicle.base_currency)}<small> {t("perDaySuffix")}</small>
            {approx !== null && <small className="approx-price"> &middot; ~{preferredCurrency} {approx.toFixed(0)}</small>}
          </strong>
          <span className="host-label">
            {vehicle.host_type === "individual" ? <UserRound size={14} /> : <span className="business-mark">B</span>}
            {vehicle.host_type === "individual" ? t("vehiclePersonalOwner") : t("vehicleBusinessLabel")}
          </span>
        </div>
        <p className="vehicle-deposit-note">{t("vehicleCardDepositNote", { amount: String(PLATFORM_DEPOSIT_USD) })}</p>
      </div>
    </Link>
  );
}
