"use client";

import Link from "next/link";
import { CarFront, Sparkles, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { convertApprox, defaultCurrencyByLanguage, type CurrencyRate } from "@/lib/currency";
import { formatMoney } from "@/lib/format";

export interface VehicleCardData {
  id: string;
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
  distance_km?: number | null;
}

export function VehicleCard({ vehicle, rates }: { vehicle: VehicleCardData; rates?: CurrencyRate[] }) {
  const { t, language } = useLanguage();
  const preferredCurrency = defaultCurrencyByLanguage[language];
  const approx = rates && preferredCurrency !== vehicle.base_currency
    ? convertApprox(vehicle.daily_price, vehicle.base_currency, preferredCurrency, rates)
    : null;

  return (
    <Link className="vehicle-card" href={`/vehicles/${vehicle.id}`}>
      <div className="vehicle-image vehicle-image-placeholder">
        <CarFront size={40} />
        {vehicle.promoted && <span className="verified-badge promoted-badge"><Sparkles size={13} /> {t("promotedBadge")}</span>}
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
      </div>
    </Link>
  );
}
