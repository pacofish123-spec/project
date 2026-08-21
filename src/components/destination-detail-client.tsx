"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SearchPanel } from "@/components/search-panel";
import { VehicleCard, type VehicleCardData } from "@/components/vehicle-card";
import { useLanguage } from "@/lib/i18n";
import { useCurrencyRates } from "@/lib/use-currency-rates";
import type { Destination } from "@/lib/destinations";

export function DestinationDetailClient({ destination, vehicles }: { destination: Destination; vehicles: VehicleCardData[] }) {
  const { t } = useLanguage();
  const rates = useCurrencyRates();

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/destinations"><ArrowLeft size={16} /> {t("navDestinations")}</Link></div>
        <section className="search-results-head destination-detail-head" style={{ backgroundImage: `linear-gradient(180deg, rgba(10,34,27,.1), rgba(10,34,27,.75)), url(${destination.photo})` }}>
          <h1>{destination.name}</h1>
          <p>{t("destinationPageIntro", { name: destination.name })}</p>
          {vehicles.length > 0 && <p className="destination-detail-count">{t("destinationCarsAvailable", { count: vehicles.length, name: destination.name })}</p>}
        </section>

        <div className="destination-detail-search"><SearchPanel initialLocation={destination.name} /></div>

        {vehicles.length > 0 ? (
          <div className="vehicle-grid">{vehicles.map((vehicle) => <VehicleCard vehicle={vehicle} rates={rates} key={vehicle.id} />)}</div>
        ) : (
          <section className="empty-results compact">
            <p>{t("noVehiclesBody")}</p>
            <Link className="workflow-submit coral" href="/search">{t("viewAllCars")} <ArrowRight size={16} /></Link>
          </section>
        )}
      </div>
    </main>
  );
}
