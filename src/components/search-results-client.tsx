"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CarFront, LocateFixed } from "lucide-react";
import { SearchPanel } from "@/components/search-panel";
import { FiltersButton, type SearchFilters } from "@/components/filters-button";
import { VehicleCard, type VehicleCardData } from "@/components/vehicle-card";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import { useCurrencyRates } from "@/lib/use-currency-rates";
import { findDestinationPhoto } from "@/lib/destinations";

const emptyFilters: SearchFilters = { transmission: "", minPrice: "", maxPrice: "", seats: "" };

interface SearchResultsClientProps {
  initialDestination: string;
  initialStartDate: string;
  initialEndDate: string;
  // Pre-fetched server-side to match the URL that was actually shared/
  // indexed, so the first paint (and any crawler or link-preview bot)
  // sees real results instead of an empty grid. The effect below still
  // re-fetches immediately on mount — this is a first-paint seed, not a
  // replacement for the live client-side filtering that follows.
  initialVehicles: VehicleCardData[];
}

export function SearchResultsClient({ initialDestination, initialStartDate, initialEndDate, initialVehicles }: SearchResultsClientProps) {
  const { t } = useLanguage();
  const rates = useCurrencyRates();
  const [destination, setDestination] = useState(initialDestination);
  const [vehicles, setVehicles] = useState<VehicleCardData[] | null>(initialVehicles);
  const [error, setError] = useState("");
  const [nearMe, setNearMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [dates, setDates] = useState({ startDate: initialStartDate, endDate: initialEndDate });
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (destination) params.set("city", destination);
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
    <>
      <AppHeader />
      <main className="workflow-page">
      <div className="page-width">
        <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkToBrowse")}</Link></div>

        <section className="destination-hero" style={{ backgroundImage: `url(${findDestinationPhoto(destination)})` }}>
          <div>
            <p className="workflow-kicker" style={{ color: "#f5b196" }}>{t("searchKicker")}</p>
            <h1>{destination}</h1>
            <p>{t("searchIntro")}</p>
          </div>
        </section>

        <div className="destination-search-panel">
          <SearchPanel
            initialLocation={destination}
            initialStartDate={dates.startDate}
            initialEndDate={dates.endDate}
            onSearch={(values) => { setDestination(values.location); setDates({ startDate: values.startDate, endDate: values.endDate }); }}
          />
        </div>

        <div className="results-toolbar">
          <FiltersButton filters={filters} onFiltersChange={setFilters} />
          <div className="admin-filters">
            <button className={nearMe ? "active" : ""} type="button" disabled={locating} onClick={findNearMe}>
              <LocateFixed size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{t("nearMeButton")}
            </button>
          </div>
        </div>

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
      </div>
      </main>
    </>
  );
}
