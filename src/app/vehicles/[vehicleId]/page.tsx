"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, MapPin, Sparkles, ShieldCheck } from "lucide-react";
import { BookingForm, type BookingExtraOption } from "@/components/booking-form";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import { formatMoney } from "@/lib/format";

interface Vehicle {
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
  fuel_policy?: string | null;
  cleaning_policy?: string | null;
}

export default function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params);
  const { t } = useLanguage();
  const [vehicle, setVehicle] = useState<Vehicle | null | undefined>(undefined);
  const [extras, setExtras] = useState<BookingExtraOption[]>([]);

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}`).then(async (response) => {
      const result = await response.json() as { vehicle?: Vehicle };
      setVehicle(response.ok ? result.vehicle ?? null : null);
    }).catch(() => setVehicle(null));

    fetch(`/api/vehicles/${vehicleId}/extras`).then(async (response) => {
      const result = await response.json() as { extras?: BookingExtraOption[] };
      if (response.ok) setExtras(result.extras ?? []);
    }).catch(() => {});
  }, [vehicleId]);

  return (
    <>
      <AppHeader />
      <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/search"><ArrowLeft size={16} /> {t("backLinkSearch")}</Link></div>
        {vehicle === undefined && <p className="workflow-kicker">{t("loadingVehicles")}</p>}
        {vehicle === null && <p className="workflow-error">{t("searchNoResultsTitle")}</p>}
        {vehicle && (
          <section className="vehicle-detail">
            <div className="vehicle-detail-media">
              <CarFront size={56} />
              {vehicle.promoted && <span className="verified-badge promoted-badge"><Sparkles size={13} /> {t("promotedBadge")}</span>}
            </div>
            <div className="vehicle-detail-body">
              <p className="workflow-kicker">{vehicle.host_type === "individual" ? t("vehiclePersonalOwner") : t("vehicleBusinessLabel")}</p>
              <h1>{vehicle.make} {vehicle.model}</h1>
              <p className="vehicle-detail-meta"><MapPin size={15} /> {vehicle.location_city}, {vehicle.country_code} <span>&middot;</span> {vehicle.year}</p>
              {vehicle.description && <p className="workflow-intro">{vehicle.description}</p>}
              <div className="vehicle-meta">
                <span>{vehicle.transmission ?? t("filterAutomatic")}</span>
                {vehicle.seats ? <span>{vehicle.seats} {t("seatsLabel").toLowerCase()}</span> : null}
                {vehicle.has_ac ? <span>{t("filterAc")}</span> : null}
              </div>
              <p className="vehicle-detail-price"><strong>{formatMoney(vehicle.daily_price, vehicle.base_currency)}</strong> {t("perDaySuffix")}</p>
              <div className="vehicle-detail-trust"><ShieldCheck size={16} /> {t("vehiclePricingNote")}</div>
              {(vehicle.fuel_policy || vehicle.cleaning_policy) && (
                <div className="admin-reasons" style={{ marginBottom: 18 }}>
                  {vehicle.fuel_policy && <span>{t("fuelPolicyLabel")}: {vehicle.fuel_policy === "as_delivered" ? t("fuelPolicyAsDelivered") : t("fuelPolicyFull")}</span>}
                  {vehicle.cleaning_policy && <span>{t("cleaningPolicyLabel")}: {vehicle.cleaning_policy}</span>}
                </div>
              )}
              <BookingForm vehicleId={vehicle.id} status={vehicle.status} extras={extras} />
            </div>
          </section>
        )}
      </div>
      </main>
    </>
  );
}
