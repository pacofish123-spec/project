"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useLanguage } from "@/lib/i18n";
import { drDestinations, slugifyDestination } from "@/lib/destinations";

export default function DestinationsPage() {
  const { t } = useLanguage();
  return (
    <>
      <AppHeader />
      <main className="workflow-page">
        <div className="page-width">
          <div className="workflow-nav"><Link className="workflow-back" href="/"><ArrowLeft size={16} /> {t("backLinkBrowse")}</Link></div>
          <section className="search-results-head">
            <p className="workflow-kicker">{t("startSomewhereBeautiful")}</p>
            <h1>{t("whereWillYouGoLine1")} <em>{t("whereWillYouGoLine2")}</em></h1>
            <p>{t("searchIntro")}</p>
          </section>
          <div className="destination-tile-grid">
            {drDestinations.map((destination) => (
              <Link className="destination-tile" href={`/destinations/${slugifyDestination(destination.name)}`} key={destination.name} style={{ backgroundImage: `url(${destination.photo})` }}>
                <span>{destination.name}</span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
