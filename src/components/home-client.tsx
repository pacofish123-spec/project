"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { SearchPanel } from "@/components/search-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthMenu } from "@/components/auth-menu";
import { VehicleCard, type VehicleCardData } from "@/components/vehicle-card";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LanguageDropdown } from "@/components/language-dropdown";
import { NotificationBell } from "@/components/notification-bell";
import { useLanguage } from "@/lib/i18n";
import { useCurrencyRates } from "@/lib/use-currency-rates";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { drDestinations, slugifyDestination } from "@/lib/destinations";
import { rentalTermOptions } from "@/lib/rental-terms";
import {
  ArrowRight,
  CarFront,
  ClipboardCheck,
  Compass,
  Globe2,
  MapPin,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

// Vehicles arrive pre-fetched from the server (see page.tsx) so search
// engines and the first paint get real listing content instead of an
// empty grid waiting on a client fetch. Everything else here (menu,
// filters, auth state, language) is genuinely client-only interaction.
export function HomeClient({ initialVehicles, activeCities }: { initialVehicles: VehicleCardData[]; activeCities: string[] }) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hostFilter, setHostFilter] = useState("All vehicles");
  const [termFilter, setTermFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [vehicles] = useState<VehicleCardData[]>(initialVehicles);
  // undefined = still checking, false = signed out, true = signed in
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const rates = useCurrencyRates();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) { queueMicrotask(() => setSignedIn(false)); return; }
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  const filteredVehicles = vehicles.filter((vehicle) =>
    (hostFilter === "All vehicles" ||
      (hostFilter === "Personal owners" && vehicle.host_type === "individual") ||
      (hostFilter === "Businesses" && vehicle.host_type === "business"))
    && (termFilter === "all" || (vehicle.rental_terms ?? []).includes(termFilter)),
  );

  const normalizedActiveCities = new Set(activeCities.map((city) => city.trim().toLowerCase()));
  const curatedDestinations = [
    { name: "Punta Cana", detail: t("destPuntaCanaDetail"), image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80" },
    { name: "Santo Domingo", detail: t("destSantoDomingoDetail"), image: "https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?auto=format&fit=crop&w=900&q=80" },
    { name: "Samaná", detail: t("destSamanaDetail"), image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=900&q=80" },
  ];
  // Only show a destination once a host has actually published
  // something there — an empty-handed "explore Punta Cana" card is a
  // dead end. Backfill from the full city list so this section still
  // shows up to 3 real destinations even if none of the 3 curated ones
  // have a car live yet.
  const destinations = curatedDestinations.filter((destination) => normalizedActiveCities.has(destination.name.trim().toLowerCase()));
  if (destinations.length < 3) {
    for (const candidate of drDestinations) {
      if (destinations.length >= 3) break;
      if (destinations.some((destination) => destination.name === candidate.name)) continue;
      if (!normalizedActiveCities.has(candidate.name.trim().toLowerCase())) continue;
      destinations.push({ name: candidate.name, detail: t("destinationGenericDetail"), image: candidate.photo });
    }
  }

  return (
    <main>
      <section className="hero-shell">
        <nav className="site-nav page-width">
          <Link className="brand" href="/" aria-label="yoRento home"><Brand light /></Link>
          <div className="desktop-nav"><a href="#cars">{t("navExploreCars")}</a><a href="#destinations">{t("navDestinations")}</a><a href="#trust">{t("navWhyYorento")}</a></div>
          <div className="nav-actions"><LanguageDropdown /><a className="host-link" href="/host">{t("listYourCar")} <ArrowRight size={15} /></a><NotificationBell /><ThemeToggle /><AuthMenu /><button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={22} /></button></div>
        </nav>
        {menuOpen && <div className="mobile-menu"><div className="mobile-menu-panel"><div className="mobile-menu-header"><Link className="menu-brand" href="/" onClick={() => setMenuOpen(false)}><Brand /></Link><button className="close-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X /></button></div><p className="menu-kicker">{t("menuKicker")}</p><div className="mobile-menu-links"><a className="menu-item" href="#cars" onClick={() => setMenuOpen(false)}><span className="menu-icon"><Compass size={19} /></span><span><strong>{t("navExploreCars")}</strong><small>{t("menuExploreCarsDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="#destinations" onClick={() => setMenuOpen(false)}><span className="menu-icon"><MapPin size={19} /></span><span><strong>{t("navDestinations")}</strong><small>{t("menuDestinationsDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="/host" onClick={() => setMenuOpen(false)}><span className="menu-icon"><CarFront size={19} /></span><span><strong>{t("listYourCar")}</strong><small>{t("menuListYourCarDetail")}</small></span><ArrowRight size={17} /></a><a className="menu-item" href="#trust" onClick={() => setMenuOpen(false)}><span className="menu-icon"><ShieldCheck size={19} /></span><span><strong>{t("navWhyYorento")}</strong><small>{t("menuWhyYorentoDetail")}</small></span><ArrowRight size={17} /></a></div>{signedIn === false && <div className="mobile-menu-bottom mobile-menu-auth"><a className="menu-auth-link primary" href="/sign-up" onClick={() => setMenuOpen(false)}>{t("signInCreateAccountLink")} <ArrowRight size={15} /></a><span>{t("menuAlreadyHaveAccount")} <a href="/sign-in" onClick={() => setMenuOpen(false)}>{t("signIn")}</a></span></div>}<div className="mobile-menu-lang"><LanguageSwitcher /></div></div></div>}

        <div className="hero-content page-width" id="top">
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> {t("heroEyebrow")}</p><h1>{t("heroTitleLine1")}<br /><em>{t("heroTitleLine2")}</em></h1><p className="hero-description">{t("heroDescription")}</p></div>
          <SearchPanel />
          <div className="hero-note"><ShieldCheck size={17} /> {t("heroNote")}</div>
        </div>
      </section>

      <section className="section page-width how-it-works">
        <div className="section-heading"><div><p className="eyebrow muted">{t("howItWorksKicker")}</p><h2>{t("howItWorksTitleLine1")} <em>{t("howItWorksTitleLine2")}</em></h2></div></div>
        <div className="how-it-works-grid">
          <div><span className="how-it-works-step">01</span><Search size={22} /><h3>{t("howItWorksStep1Title")}</h3><p>{t("howItWorksStep1Body")}</p></div>
          <div><span className="how-it-works-step">02</span><ClipboardCheck size={22} /><h3>{t("howItWorksStep2Title")}</h3><p>{t("howItWorksStep2Body")}</p></div>
          <div><span className="how-it-works-step">03</span><MessageCircle size={22} /><h3>{t("howItWorksStep3Title")}</h3><p>{t("howItWorksStep3Body")}</p></div>
          <div><span className="how-it-works-step">04</span><CarFront size={22} /><h3>{t("howItWorksStep4Title")}</h3><p>{t("howItWorksStep4Body")}</p></div>
        </div>
      </section>

      <section className="section page-width" id="cars">
        <div className="section-heading"><div><p className="eyebrow muted">{t("readyWhenYouAre")}</p><h2>{t("carsHeadingLine1")} <em>{t("carsHeadingLine2")}</em></h2></div><a className="text-link" href="/search">{t("viewAllCars")} <ArrowRight size={16} /></a></div>
        <div className="filter-tabs rental-term-tabs">
          <button className={termFilter === "all" ? "active" : ""} onClick={() => setTermFilter("all")}>{t("filterRentalTermAll")}</button>
          {rentalTermOptions.map((term) => <button key={term.value} className={termFilter === term.value ? "active" : ""} onClick={() => setTermFilter(term.value)}>{t(term.labelKey)}</button>)}
        </div>
        <div className="filter-row"><div className="filter-tabs">{["All vehicles", "Personal owners", "Businesses"].map((filter) => <button key={filter} className={hostFilter === filter ? "active" : ""} onClick={() => setHostFilter(filter)}>{filter === "All vehicles" ? t("filterAll") : filter === "Personal owners" ? t("filterPersonal") : t("filterBusiness")}</button>)}</div><button className="filter-button" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} /> {t("filters")}</button></div>
        <p className="filter-hint">{hostFilter === "Personal owners" ? t("filterExplainerPersonal") : hostFilter === "Businesses" ? t("filterExplainerBusiness") : t("filterExplainerAll")}</p>
        {filtersOpen && <div className="filter-panel"><span>{t("moreFilters")}</span><button onClick={() => setFiltersOpen(false)}>{t("filterAutomatic")}</button><button onClick={() => setFiltersOpen(false)}>{t("filterSeats")}</button><button onClick={() => setFiltersOpen(false)}>{t("filterAc")}</button></div>}
        {filteredVehicles.length > 0 && <div className="vehicle-grid">{filteredVehicles.map((vehicle) => <VehicleCard vehicle={vehicle} rates={rates} key={vehicle.id} />)}</div>}
        {filteredVehicles.length === 0 && <section className="empty-results compact"><CarFront size={32} /><h2>{t("noVehiclesTitle")}</h2><p>{t("noVehiclesBody")}</p><Link className="workflow-submit coral" href="/host">{t("listAVehicle")} <ArrowRight size={16} /></Link></section>}
      </section>

      <section className="trust-strip" id="trust"><div className="page-width trust-grid"><div><ShieldCheck size={25} /><h3>{t("trustBuiltInTitle")}</h3><p>{t("trustBuiltInBody")}</p></div><div><Sparkles size={25} /><h3>{t("madeForJourneyTitle")}</h3><p>{t("madeForJourneyBody")}</p></div><div><Globe2 size={25} /><h3>{t("oneAccountTitle")}</h3><p>{t("oneAccountBody")}</p></div></div></section>

      {destinations.length > 0 && <section className="section page-width" id="destinations"><div className="section-heading"><div><p className="eyebrow muted">{t("startSomewhereBeautiful")}</p><h2>{t("whereWillYouGoLine1")} <em>{t("whereWillYouGoLine2")}</em></h2></div><Link className="text-link" href="/destinations">{t("exploreDestinations")} <ArrowRight size={16} /></Link></div><div className="destination-grid">{destinations.map((destination) => <Link className="destination-card" href={`/destinations/${slugifyDestination(destination.name)}`} key={destination.name} style={{ backgroundImage: `url(${destination.image})` }}><div><strong>{destination.name}</strong><span>{destination.detail}</span></div><ArrowRight size={18} /></Link>)}</div></section>}

      <section className="host-cta page-width" id="host"><div><p className="eyebrow">{t("forOwnersBusinesses")}</p><h2>{t("rentCarLine1")}<br /><em>{t("rentCarLine2")}</em></h2><p>{t("hostCtaBody")}</p><a className="button-light" href="/host">{t("becomeAHost")} <ArrowRight size={16} /></a></div><div className="host-stat"><span>01</span><strong>{t("hostStat1Line1")}<br />{t("hostStat1Line2")}</strong><span>02</span><strong>{t("hostStat2Line1")}<br />{t("hostStat2Line2")}</strong></div></section>

      <footer className="site-footer"><div className="page-width footer-inner"><a className="brand" href="#top"><Brand light /></a><p>{t("footerTagline")}</p><div><a href="/about">{t("about")}</a><a href="/host">{t("host")}</a><a href="/trust">{t("trustSafety")}</a><LanguageSwitcher /></div></div></footer>
    </main>
  );
}
