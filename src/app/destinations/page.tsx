"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import { drDestinations, slugifyDestination } from "@/lib/destinations";

function normalizeCityName(city: string): string {
  return (city ?? "").trim().toLowerCase();
}

export default function DestinationsPage() {
  const { t } = useLanguage();
  // null = still checking which cities have a car — the grid stays
  // empty rather than flashing every city and then shrinking once the
  // real (usually smaller) list loads.
  const [activeCities, setActiveCities] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch("/api/destinations/active-cities").then(async (response) => {
      const result = await response.json() as { cities?: string[] };
      setActiveCities(new Set((result.cities ?? []).map(normalizeCityName)));
    }).catch(() => setActiveCities(new Set()));
  }, []);

  const visibleDestinations = activeCities
    ? drDestinations.filter((destination) => activeCities.has(normalizeCityName(destination.name)))
    : [];

  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="search-results-head destination-detail-head" style={{ backgroundImage: "linear-gradient(180deg, rgba(6,38,44,.2), rgba(6,38,44,.76)), url(https://images.unsplash.com/photo-1780777424838-3ec34be67737?auto=format&fit=crop&w=1800&q=80)" }}>
            <p className="workflow-kicker">{t("startSomewhereBeautiful")}</p>
            <h1>{t("whereWillYouGoLine1")} <em>{t("whereWillYouGoLine2")}</em></h1>
            <p>{t("searchIntro")}</p>
          </section>
          {activeCities && visibleDestinations.length === 0 && (
            <div className="empty-results compact">
              <MapPin size={30} />
              <h2>{t("destinationsEmptyTitle")}</h2>
              <p>{t("destinationsEmptyBody")}</p>
              <Link className="workflow-link" href="/host">{t("becomeAHost")} <ArrowRight size={15} /></Link>
            </div>
          )}
          {visibleDestinations.length > 0 && (
            <div className="destination-tile-grid">
              {visibleDestinations.map((destination) => (
                <Link className="destination-tile" href={`/destinations/${slugifyDestination(destination.name)}`} key={destination.name} style={{ backgroundImage: `url(${destination.photo})` }}>
                  <span>{destination.name}</span>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
