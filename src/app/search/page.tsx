"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CarFront, LocateFixed } from "lucide-react";
import { SearchControls, type SearchFilters } from "@/components/search-controls";
import { VehicleCard, type VehicleCardData } from "@/components/vehicle-card";
import { useLanguage } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useCurrencyRates } from "@/lib/use-currency-rates";

const emptyFilters: SearchFilters = { transmission: "", minPrice: "", maxPrice: "", seats: "" };

function SearchResults() {
  const { t } = useLanguage();
  const rates = useCurrencyRates();
  const searchParams = useSearchParams();
  const destination = searchParams.get("location") ?? searchParams.get("destination") ?? "Dominican Republic";
  const [vehicles, setVehicles] = useState<VehicleCardData[] | null>(null);
  const [error, setError] = useState("");
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [dates, setDates] = useState({ startDate: searchParams.get("startDate") ?? "", endDate: searchParams.get("endDate") ?? "" });
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (destination && destination !== "Dominican Republic") params.set("city", destination);
    if (dates.startDate) params.set("startDate", dates.startDate);
    if (dates.endDate) params.set("endDate", dates.endDate);
    if (nearMe) { params.set("lat", String(nearMe.lat)); params.set("lng", String(nearMe.lng)); }
    if (filters.transmission) params.set("transmission", filters.transmission);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.seats) params.set("seats", filters.seats);
    fetch(`/api/vehicles?${params.toString()}`).then(async (response) => {
      const result = await response.json() as { vehicles?: VehicleCardData[]; error?: string };
      if (!response.ok) { setError(result.error ?? "Unable to load vehicles."); setVehicles([]); return; }
      setVehicles(result.vehicles ?? []);
    }).catch(() => { setError("Unable to load vehicles."); setVehicles([]); });
  }, [destination, dates, nearMe, filters]);

  function findNearMe() {
    if (!navigator.geolocation) { setError(t("locationDenied")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { setNearMe({ lat: position.coords.latitude, lng: position.coords.longitude }); setLocating(false); },
      () => { setError(t("locationDenied")); setLocating(false); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkToBrowse")}</Link><Link className="workflow-link" href="/sign-in">{t("signIn")}</Link></div>
        <section className="search-results-head">
          <p className="workflow-kicker">{t("searchKicker")}</p>
          <h1>{t("searchCarsIn")} <em>{destination}</em></h1>
          <p>{t("searchIntro")}</p>
          <SearchControls
            destination={destination}
            startDate={dates.startDate}
            endDate={dates.endDate}
            onDatesChange={(startDate, endDate) => setDates({ startDate, endDate })}
            filters={filters}
            onFiltersChange={setFilters}
          />
          <div className="admin-filters" style={{ marginTop: 14 }}>
            <button className={nearMe ? "active" : ""} type="button" disabled={locating} onClick={findNearMe}>
              <LocateFixed size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("nearMeButton")}
            </button>
          </div>
        </section>
        {error && <p className="workflow-error">{error}</p>}
        {vehicles === null && <p className="workflow-kicker">{t("loadingVehicles")}</p>}
        {vehicles !== null && vehicles.length > 0 && <div className="vehicle-grid">{vehicles.map((vehicle) => <VehicleCard vehicle={vehicle} rates={rates} key={vehicle.id} />)}</div>}
        {vehicles !== null && vehicles.length === 0 && (
          <section className="empty-results">
            <CarFront size={32} />
            <h2>{t("searchNoResultsTitle")}</h2>
            <p>{t("searchNoResultsBody")}</p>
            <Link className="workflow-submit coral" href="/host">{t("listAVehicle")} <ArrowRight size={16} /></Link>
          </section>
        )}
        <div className="workflow-lang-bar"><LanguageSwitcher /></div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <Suspense fallback={null}><SearchResults /></Suspense>;
}
